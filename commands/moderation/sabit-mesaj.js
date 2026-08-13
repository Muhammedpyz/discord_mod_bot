const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sabit-mesaj')
        .setDescription('Kanalda her zaman en altta kalacak mesajı ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Sabit bir mesaj ayarlar.')
                .addStringOption(option =>
                    option.setName('mesaj')
                        .setDescription('Sabitlenecek mesajın içeriği')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Mesajın sabitleneceği kanal (boş bırakılırsa mevcut kanal)')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Kanal için ayarlanmış sabit mesajı kapatır.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Sabit mesajın kapatılacağı kanal')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
        let conn;

        try {
            conn = await pool.getConnection();

            if (subcommand === 'ayarla') {
                const content = interaction.options.getString('mesaj');

                await conn.query(
                    `INSERT INTO sticky_messages (guild_id, channel_id, content) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE content = ?`, 
                    [interaction.guild.id, targetChannel.id, content, content]
                );
                
                const payload = createContainerMessage(
                    `${EMOJIS.pin} Sabit Mesaj Ayarlandı`,
                    `Sabit mesaj başarıyla ${targetChannel} kanalına ayarlandı.\nYeni bir mesaj gönderildiğinde bu mesaj her zaman en altta kalacaktır.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Sabit Mesaj Ayarlandı',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Moderatör', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Kanal', value: `<#${targetChannel.id}>`, inline: true },
                        { name: 'İçerik', value: content.length > 1024 ? content.substring(0, 1021) + '...' : content, inline: false }
                    ]
                );
                await sendLog(interaction.guild, logPayload);

            } else if (subcommand === 'kapat') {
                const result = await conn.query('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?', [interaction.guild.id, targetChannel.id]);
                
                if (result.affectedRows > 0) {
                    const payload = createContainerMessage(
                        `${EMOJIS.check} Sabit Mesaj Kapatıldı`,
                        `${targetChannel} kanalı için ayarlanmış sabit mesaj kaldırıldı.`,
                        '#2B2D31'
                    );
                    await interaction.editReply(payload);

                    const logPayload = createContainerMessage(
                        'Sabit Mesaj Kapatıldı',
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
                        `${targetChannel} kanalında ayarlanmış bir sabit mesaj bulunamadı.`,
                        '#ED4245'
                    );
                    await interaction.editReply(payload);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
