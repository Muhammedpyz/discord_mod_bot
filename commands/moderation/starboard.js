const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starboard')
        .setDescription('Starboard (yıldızlı mesajlar) sistemini ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Starboard kanalını ve eşik değerini ayarlar.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Starboard mesajlarının gönderileceği kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('esik')
                        .setDescription('Gereken minimum yıldız tepkisi sayısı (varsayılan: 3)')
                        .setMinValue(1)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Starboard sistemini kapatır.')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        let conn;

        try {
            conn = await pool.getConnection();

            if (subcommand === 'ayarla') {
                const targetChannel = interaction.options.getChannel('kanal');
                const threshold = interaction.options.getInteger('esik') || 3;

                await conn.query(
                    `INSERT INTO guild_config (guild_id, starboard_channel_id, starboard_threshold) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE starboard_channel_id = VALUES(starboard_channel_id), starboard_threshold = VALUES(starboard_threshold)`, 
                    [interaction.guild.id, targetChannel.id, threshold]
                );
                
                const payload = createContainerMessage(
                    `${EMOJIS.crown} Starboard Ayarlandı`,
                    `Starboard kanalı başarıyla ${targetChannel} olarak ayarlandı.\nBir mesaj starboard'a düşmek için en az **${threshold}** yıldız tepkisi almalıdır.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Starboard Sistemi Açıldı/Güncellendi',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Kanal', value: `<#${targetChannel.id}>`, inline: true },
                        { name: 'Eşik (Gereken Yıldız)', value: `${threshold}`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);

            } else if (subcommand === 'kapat') {
                await conn.query(
                    `UPDATE guild_config SET starboard_channel_id = NULL WHERE guild_id = ?`, 
                    [interaction.guild.id]
                );
                
                const payload = createContainerMessage(
                    `${EMOJIS.check} Starboard Kapatıldı`,
                    `Starboard sistemi bu sunucu için başarıyla kapatıldı.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Starboard Sistemi Kapatıldı',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);
            }
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
