const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('doğrulama')
        .setDescription('Doğrulama paneli kurar/kapatır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('kur')
            .setDescription('Doğrulama paneli yayınlar.')
            .addChannelOption(o => o.setName('kanal').setDescription('Panel kanalı').setRequired(true))
            .addRoleOption(o => o.setName('rol').setDescription('Doğrulananlara verilecek rol').setRequired(true)))
        .addSubcommand(s => s.setName('kapat').setDescription('Doğrulamayı kapatır.')),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();
        let conn;
        try {
            conn = await db.pool.getConnection();
            if (sub === 'kur') {
                const kanal = interaction.options.getChannel('kanal');
                const rol = interaction.options.getRole('rol');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('dogrula_btn').setLabel('Doğrula').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.shield)
                );
                const payload = createContainerMessage('Doğrulama', 'Sunucuya erişmek için aşağıdaki butona bas ve çıkan matematik sorusunu cevapla.', '#57F287', [row]);
                const msg = await kanal.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
                await conn.query('INSERT INTO dogrulama_config (guild_id, channel_id, message_id, role_id, is_active) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=VALUES(message_id), role_id=VALUES(role_id), is_active=TRUE', [interaction.guild.id, kanal.id, msg.id, rol.id]);
                await interaction.editReply(createContainerMessage('Yayınlandı', `<:mono:${MONO_EMOJIS.check}> Doğrulama paneli <#${kanal.id}> kanalına kuruldu.`, '#57F287', [], [], false, true));
            } else {
                await conn.query('UPDATE dogrulama_config SET is_active=FALSE WHERE guild_id = ?', [interaction.guild.id]);
                await interaction.editReply(createContainerMessage('Kapatıldı', 'Doğrulama sistemi kapatıldı.', '#FEE75C', [], [], false, true));
            }
        } catch (e) {
            console.error('[Doğrulama]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
