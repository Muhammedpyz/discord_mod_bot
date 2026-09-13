const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starboard')
        .setDescription('Starboard (Yıldız Panosu) Yönetimi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Starboard sistemini açar ve yapılandırır.')
                .addChannelOption(opt => opt.setName('kanal').setDescription('Yıldızlanan mesajların gideceği kanal').setRequired(true))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Kaç yıldıza ulaşınca panoya düşsün? (Varsayılan 3)').setRequired(false).setMinValue(1))
                .addStringOption(opt => opt.setName('emoji').setDescription('Tepki emojisi (Varsayılan yıldız)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Starboard sistemini kapatır.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();

        let conn;
        try {
            conn = await db.pool.getConnection();
            if (sub === 'ayarla') {
                const channel = interaction.options.getChannel('kanal');
                const threshold = interaction.options.getInteger('limit') || 3;
                const emoji = interaction.options.getString('emoji') || MONO_EMOJIS.star;

                await conn.query(
                    "INSERT INTO starboard_config (guild_id, channel_id, emoji, threshold) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id=?, emoji=?, threshold=?",
                    [interaction.guild.id, channel.id, emoji, threshold, channel.id, emoji, threshold]
                );

                const msg = createContainerMessage('Starboard Kuruldu', `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Pano başarıyla <#${channel.id}> kanalına ayarlandı.\nBir mesaj **${threshold}** adet ${emoji} alırsa panoda sergilenecek!`, '#FEE75C');
                await interaction.editReply(msg);
            } else if (sub === 'kapat') {
                await conn.query("DELETE FROM starboard_config WHERE guild_id = ?", [interaction.guild.id]);
                await interaction.editReply(createContainerMessage('Başarılı', 'Starboard sistemi kapatıldı.', '#ED4245', [], [], false, true));
            }
        } catch (e) {
            console.error('Starboard cmd err:', e);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    }
};
