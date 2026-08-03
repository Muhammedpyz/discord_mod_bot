const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../../db');
const { createRoomPanel } = require('../../utils/roomPanel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('odapanel')
        .setDescription('Özel odanızın yönetim panelini sohbet kanalına yeniden gönderir.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        let conn;
        try {
            const config = require('../config.json');
            conn = await pool().getConnection();
            
            // Kullanıcının bulunduğu ses kanalını al
            const voiceChannel = interaction.member.voice.channel;
            let channelIdToUse = null;
            let realOwnerId = interaction.user.id;

            if (voiceChannel) {
                // Bulunduğu kanal özel oda mı kontrol et
                const checkRoom = await conn.query('SELECT owner_id FROM active_rooms WHERE channel_id = ?', [voiceChannel.id]);
                if (checkRoom.length > 0) {
                    const ownerId = checkRoom[0].owner_id;
                    // Odanın sahibi mi VEYA süper admin/yönetici mi?
                    if (ownerId === interaction.user.id || require('../../utils/systemNode').checkSystemNode(interaction.user.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                        channelIdToUse = voiceChannel.id;
                        realOwnerId = ownerId;
                    }
                }
            }

            // Eğer bulunduğu kanaldan bulamadıysa, sahip olduğu odayı ara
            if (!channelIdToUse) {
                const rows = await conn.query('SELECT channel_id FROM active_rooms WHERE owner_id = ? AND guild_id = ?', [interaction.user.id, interaction.guild.id]);
                if (rows.length === 0) {
                    return interaction.editReply({ content: 'Şu anda size ait aktif bir özel oda bulunmuyor veya bulunduğunuz odayı yönetme yetkiniz yok.' });
                }
                channelIdToUse = rows[0].channel_id;
                realOwnerId = interaction.user.id;
            }

            const channel = interaction.guild.channels.cache.get(channelIdToUse);

            if (!channel) {
                await conn.query('DELETE FROM active_rooms WHERE channel_id = ?', [channelIdToUse]);
                return interaction.editReply({ content: 'Odanız bulunamadı veya silinmiş.' });
            }

            const realOwnerUser = await interaction.client.users.fetch(realOwnerId).catch(() => interaction.user);
            const panelData = createRoomPanel(realOwnerUser, channel.id);
            const panelMsg = await channel.send(panelData);
            await panelMsg.pin().catch(() => {});

            await interaction.editReply({ content: `Oda paneli başarıyla odanıza (<#${channel.id}>) gönderildi.` });

        } catch (err) {
            console.error("odapanel hatası:", err);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(()=>{});
        } finally {
            if (conn) conn.release();
        }
    }
};
