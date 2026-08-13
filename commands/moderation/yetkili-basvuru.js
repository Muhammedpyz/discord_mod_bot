const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkili-basvuru')
        .setDescription('Yetkili başvuru sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcmd => 
            subcmd.setName('kur')
                .setDescription('Başvuru panelini kurar')
                .addChannelOption(opt => opt.setName('kanal').setDescription('Panel kanalı').setRequired(true))
                .addChannelOption(opt => opt.setName('sonuc-kanal').setDescription('Başvuruların düşeceği kanal').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('kapat')
                .setDescription('Başvuru sistemini kapatır')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'kur') {
                const panelChannel = interaction.options.getChannel('kanal');
                const resultChannel = interaction.options.getChannel('sonuc-kanal');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('staff_apply_btn')
                        .setLabel('Başvur')
                        .setStyle(ButtonStyle.Primary)
                );

                const panelMsg = createContainerMessage(
                    `${EMOJIS.ticket} Yetkili Başvurusu`,
                    `Sunucumuzda yetkili olmak istiyorsanız aşağıdaki butona tıklayarak başvuru yapabilirsiniz.`,
                    '#2B2D31',
                    [row]
                );

                const sentMessage = await panelChannel.send(panelMsg);

                await conn.query(
                    `INSERT INTO staff_applications (guild_id, panel_channel_id, panel_message_id, result_channel_id) 
                     VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE panel_channel_id = ?, panel_message_id = ?, result_channel_id = ?`,
                    [interaction.guild.id, panelChannel.id, sentMessage.id, resultChannel.id, panelChannel.id, sentMessage.id, resultChannel.id]
                );

                await interaction.editReply(createContainerMessage(
                    `${EMOJIS.check} Başarılı`,
                    `Yetkili başvuru paneli <#${panelChannel.id}> kanalına kuruldu. Başvurular <#${resultChannel.id}> kanalına gidecek.`,
                    '#2B2D31'
                ));
            } else {
                await conn.query('DELETE FROM staff_applications WHERE guild_id = ?', [interaction.guild.id]);
                await interaction.editReply(createContainerMessage(
                    `${EMOJIS.check} Başarılı`,
                    `Yetkili başvuru sistemi kapatıldı.`,
                    '#2B2D31'
                ));
            }

        } catch (error) {
            console.error('Error in yetkili-basvuru command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
