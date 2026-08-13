const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yasakli-kanal')
        .setDescription('Belirli kanallarda bot komutlarının kullanımını veya level gibi sistemleri engeller.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Bir kanalı yasaklı kanallar listesine ekler.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Yasaklanacak kanal')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Bir kanalı yasaklı kanallar listesinden çıkarır.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Yasaklı listeden çıkarılacak kanal')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Yasaklı kanallar listesini gösterir.')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        let conn;

        try {
            conn = await pool.getConnection();

            if (subcommand === 'ekle') {
                const targetChannel = interaction.options.getChannel('kanal');

                try {
                    await conn.query('INSERT INTO blocked_channels (guild_id, channel_id) VALUES (?, ?)', [interaction.guild.id, targetChannel.id]);
                    
                    const payload = createContainerMessage(
                        `${EMOJIS.lock} Kanal Yasaklandı`,
                        `${targetChannel} başarıyla yasaklı kanallar listesine eklendi.`,
                        '#2B2D31'
                    );
                    await interaction.editReply(payload);

                    const logPayload = createContainerMessage(
                        'Yasaklı Kanal Eklendi',
                        '',
                        '#2B2D31',
                        [],
                        [
                            { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Kanal', value: `<#${targetChannel.id}>`, inline: true }
                        ]
                    );
                    await sendLog(interaction.guild, logPayload);
                } catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        const payload = createContainerMessage(
                            `${EMOJIS.cross} İşlem Başarısız`,
                            `${targetChannel} zaten yasaklı kanallar listesinde.`,
                            '#ED4245'
                        );
                        return await interaction.editReply(payload);
                    }
                    throw err;
                }
            } else if (subcommand === 'sil') {
                const targetChannel = interaction.options.getChannel('kanal');
                const result = await conn.query('DELETE FROM blocked_channels WHERE guild_id = ? AND channel_id = ?', [interaction.guild.id, targetChannel.id]);
                
                if (result.affectedRows > 0) {
                    const payload = createContainerMessage(
                        `${EMOJIS.unlock} Kanal Yasağı Kaldırıldı`,
                        `${targetChannel} başarıyla yasaklı kanallar listesinden çıkarıldı.`,
                        '#2B2D31'
                    );
                    await interaction.editReply(payload);

                    const logPayload = createContainerMessage(
                        'Yasaklı Kanal Kaldırıldı',
                        '',
                        '#2B2D31',
                        [],
                        [
                            { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Kanal', value: `<#${targetChannel.id}>`, inline: true }
                        ]
                    );
                    await sendLog(interaction.guild, logPayload);
                } else {
                    const payload = createContainerMessage(
                        `${EMOJIS.cross} İşlem Başarısız`,
                        `${targetChannel} yasaklı kanallar listesinde bulunamadı.`,
                        '#ED4245'
                    );
                    await interaction.editReply(payload);
                }
            } else if (subcommand === 'liste') {
                const rows = await conn.query('SELECT channel_id FROM blocked_channels WHERE guild_id = ?', [interaction.guild.id]);
                
                if (rows.length === 0) {
                    const payload = createContainerMessage(
                        `${EMOJIS.lock} Yasaklı Kanallar`,
                        `Bu sunucu için ayarlanmış yasaklı kanal bulunmuyor.`,
                        '#2B2D31'
                    );
                    return await interaction.editReply(payload);
                }

                const channelList = rows.map(r => `<#${r.channel_id}>`).join('\n');
                const payload = createContainerMessage(
                    `${EMOJIS.lock} Yasaklı Kanallar Listesi`,
                    channelList,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            }
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
