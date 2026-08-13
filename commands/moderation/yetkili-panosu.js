const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkili-panosu')
        .setDescription('Belirli yetkili rollerine sahip kullanıcıların bulunduğu panoyu kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('kur')
                .setDescription('Panoyu belirtilen kanala kurar.')
                .addChannelOption(option => option.setName('kanal').setDescription('Panonun kurulacağı kanal').setRequired(true))
                .addRoleOption(option => option.setName('rol1').setDescription('Gösterilecek 1. rol').setRequired(true))
                .addRoleOption(option => option.setName('rol2').setDescription('Gösterilecek 2. rol (opsiyonel)').setRequired(false))
                .addRoleOption(option => option.setName('rol3').setDescription('Gösterilecek 3. rol (opsiyonel)').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('guncelle')
                .setDescription('Panoyu günceller.')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            const subcommand = interaction.options.getSubcommand();
            conn = await pool.getConnection();

            if (subcommand === 'kur') {
                const channel = interaction.options.getChannel('kanal');
                const role1 = interaction.options.getRole('rol1');
                const role2 = interaction.options.getRole('rol2');
                const role3 = interaction.options.getRole('rol3');

                const roles = [role1.id];
                if (role2) roles.push(role2.id);
                if (role3) roles.push(role3.id);

                const roleIdsStr = roles.join(',');

                // Fetch members to create the initial message
                await interaction.guild.members.fetch();
                
                let boardText = '';
                for (const roleId of roles) {
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) {
                        const members = role.members.map(m => `<@${m.id}>`);
                        boardText += `**${role.name}**\n${members.length > 0 ? members.join(', ') : 'Kimse yok'}\n\n`;
                    }
                }

                const boardPayload = createContainerMessage(
                    `${EMOJIS.crown} Yetkili Panosu`,
                    boardText,
                    '#2B2D31'
                );

                const message = await channel.send(boardPayload);

                await conn.query(
                    'INSERT INTO staff_board (guild_id, channel_id, message_id, role_ids) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?, message_id = ?, role_ids = ?',
                    [interaction.guild.id, channel.id, message.id, roleIdsStr, channel.id, message.id, roleIdsStr]
                );

                const payload = createContainerMessage(
                    `${EMOJIS.check} Yetkili Panosu Kuruldu`,
                    `Pano başarıyla ${channel} kanalına kuruldu.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Yetkili Panosu Kuruldu',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Kanal', value: `${channel}`, inline: true },
                        { name: 'Yetkili', value: `${interaction.user}`, inline: true }
                    ]
                );
                await sendLog(interaction.guild, logPayload);

            } else if (subcommand === 'guncelle') {
                const rows = await conn.query('SELECT channel_id, message_id, role_ids FROM staff_board WHERE guild_id = ?', [interaction.guild.id]);
                if (rows.length === 0) {
                    return interaction.editReply({ content: 'Bu sunucuda kurulmuş bir yetkili panosu bulunmuyor.' });
                }

                const { channel_id, message_id, role_ids } = rows[0];
                const roles = role_ids.split(',');

                const channel = interaction.guild.channels.cache.get(channel_id);
                if (!channel) {
                    return interaction.editReply({ content: 'Pano kanalı bulunamadı.' });
                }

                let message;
                try {
                    message = await channel.messages.fetch(message_id);
                } catch (e) {
                    return interaction.editReply({ content: 'Pano mesajı bulunamadı.' });
                }

                await interaction.guild.members.fetch();
                
                let boardText = '';
                for (const roleId of roles) {
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) {
                        const members = role.members.map(m => `<@${m.id}>`);
                        boardText += `**${role.name}**\n${members.length > 0 ? members.join(', ') : 'Kimse yok'}\n\n`;
                    }
                }

                const boardPayload = createContainerMessage(
                    `${EMOJIS.crown} Yetkili Panosu`,
                    boardText,
                    '#2B2D31'
                );

                await message.edit(boardPayload);

                const payload = createContainerMessage(
                    `${EMOJIS.check} Yetkili Panosu Güncellendi`,
                    `Pano başarıyla güncellendi.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Yetkili Panosu Güncellendi',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Kanal', value: `${channel}`, inline: true },
                        { name: 'Yetkili', value: `${interaction.user}`, inline: true }
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
