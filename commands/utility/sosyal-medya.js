const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sosyal-medya')
        .setDescription('Sosyal Medya Bildirimleri Yönetimi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('ekle')
                .setDescription('Yeni bir bildirim aboneliği ekler.')
                .addStringOption(opt => opt.setName('platform').setDescription('Platform').setRequired(true).addChoices(
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'Twitch', value: 'twitch' },
                    { name: 'Kick', value: 'kick' }
                ))
                .addStringOption(opt => opt.setName('isim').setDescription('Kanal Adı veya ID (örn: UC... veya yayıncıadı)').setRequired(true))
                .addChannelOption(opt => opt.setName('kanal').setDescription('Bildirimin atılacağı Discord kanalı').setRequired(true))
                .addStringOption(opt => opt.setName('sablon').setDescription('Mesaj şablonu ({title}, {url}, {name})').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Aktif bildirimleri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Bir bildirimi siler.')
                .addIntegerOption(opt => opt.setName('id').setDescription('Silinecek abonelik ID').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();

        let conn;
        try {
            conn = await db.pool.getConnection();
            if (sub === 'ekle') {
                const platform = interaction.options.getString('platform');
                const ident = interaction.options.getString('isim');
                const channel = interaction.options.getChannel('kanal');
                const template = interaction.options.getString('sablon') || null;

                const res = await conn.query(
                    'INSERT INTO social_subscriptions (guild_id, platform, channel_identifier, discord_channel_id, message_template) VALUES (?, ?, ?, ?, ?)',
                    [interaction.guild.id, platform, ident, channel.id, template]
                );

                await interaction.editReply(createContainerMessage('Bildirim Eklendi', `<:mono:${MONO_EMOJIS.check}> **${ident}** (${platform.toUpperCase()}) yeni içerik/canlı yayın durumunda <#${channel.id}> kanalına V2 kart olarak bildirilecek!\n-# Abonelik ID: ${Number(res.insertId)}`, '#57F287'));
            } else if (sub === 'liste') {
                const subs = await conn.query('SELECT * FROM social_subscriptions WHERE guild_id = ?', [interaction.guild.id]);
                if (subs.length === 0) return interaction.editReply(createContainerMessage('Bilgi', 'Hiç aktif bildirimin yok.', '#3498DB'));

                let list = '';
                for (const s of subs) {
                    const live = s.is_currently_live ? ' (ŞU AN CANLI)' : '';
                    list += `\`#${s.id}\` **${s.platform.toUpperCase()}**: ${s.channel_identifier} → <#${s.discord_channel_id}>${live}\n`;
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('social_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
                );
                await interaction.editReply(createContainerMessage('Aktif Bildirimler', list, '#5865F2', [row]));
            } else if (sub === 'sil') {
                const id = interaction.options.getInteger('id');
                const res = await conn.query('DELETE FROM social_subscriptions WHERE id = ? AND guild_id = ?', [id, interaction.guild.id]);
                if (res.affectedRows > 0) {
                    await interaction.editReply(createContainerMessage('Silindi', `#${id} numaralı abonelik silindi.`, '#57F287', [], [], false, true));
                } else {
                    await interaction.editReply(createContainerMessage('Hata', 'Abonelik bulunamadı.', '#ED4245', [], [], false, true));
                }
            }
        } catch (e) {
            console.error('Social media err:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Bir sorun oluştu.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
