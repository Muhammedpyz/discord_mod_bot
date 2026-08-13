const { SlashCommandBuilder } = require('discord.js');
const { pool } = require('../../db');
const { createV2Container, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('davet')
        .setDescription('Davet istatistiklerinizi veya sunucu davet sıralamasını görüntüler.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('bilgi')
                .setDescription('Bir kullanıcının davet istatistiklerini görüntüler.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('İstatistiklerine bakılacak kullanıcı (boş bırakırsanız kendiniz)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('siralama')
                .setDescription('Sunucudaki en çok davet yapanları görüntüler.')),

    async execute(interaction, client) {
        const subCommand = interaction.options.getSubcommand();
        await interaction.deferReply();

        let conn;
        try {
            conn = await pool.getConnection();
            const guildId = interaction.guildId;

            if (subCommand === 'bilgi') {
                const targetUser = interaction.options.getUser('user') || interaction.user;

                // Kullanıcının davet ettiği kişi sayısı
                const inviteCountRes = await conn.query(
                    'SELECT COUNT(*) as total FROM invite_tracking WHERE guild_id = ? AND inviter_id = ?',
                    [guildId, targetUser.id]
                );
                
                let inviteCount = 0;
                if (inviteCountRes && inviteCountRes.total !== undefined) {
                    inviteCount = inviteCountRes.total;
                } else if (inviteCountRes && inviteCountRes[0] && inviteCountRes[0].total !== undefined) {
                    inviteCount = inviteCountRes[0].total; // Fallback just in case
                }

                // Kullanıcıyı kim davet etmiş?
                const invitedByRows = await conn.query(
                    'SELECT inviter_id, joined_at FROM invite_tracking WHERE guild_id = ? AND user_id = ? LIMIT 1',
                    [guildId, targetUser.id]
                );

                let inviterInfo = 'Bilinmiyor veya kendi linkiyle/özel linkle gelmiş.';
                let inviterId = null;
                if (invitedByRows && invitedByRows.length > 0) {
                    inviterId = invitedByRows[0].inviter_id;
                }

                if (inviterId) {
                    if (inviterId === 'BİLİNMİYOR') {
                        inviterInfo = 'Özel Davet Bağlantısı (Vanity URL) veya Bot';
                    } else {
                        inviterInfo = `<@${inviterId}> tarafından davet edilmiş.`;
                    }
                }
                
                // Kullanıcının davet ettikleri
                const allInvited = await conn.query(
                    'SELECT user_id, joined_at FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? ORDER BY joined_at DESC',
                    [guildId, targetUser.id]
                );
                
                let invitedUsers = Array.isArray(allInvited) ? allInvited.filter(row => row.user_id !== undefined) : [];
                
                let invitedText = '';
                let files = [];
                
                if (invitedUsers.length > 0) {
                    if (invitedUsers.length > 10) {
                        const top10 = invitedUsers.slice(0, 10);
                        invitedText = top10.map((u, i) => `${i + 1}. <@${u.user_id}>`).join('\n') + `\n\n...ve **${invitedUsers.length - 10} kişi** daha. (Tam liste ekte)`;
                        
                        let fullListText = `DAVET EDİLEN KİŞİLER LİSTESİ (${targetUser.tag})\n\n`;
                        invitedUsers.forEach((u, i) => {
                            fullListText += `${i + 1}. Kullanıcı ID: ${u.user_id} - Katılma: ${u.joined_at ? new Date(u.joined_at).toLocaleString('tr-TR') : 'Bilinmiyor'}\n`;
                        });
                        
                        const { AttachmentBuilder } = require('discord.js');
                        const attachment = new AttachmentBuilder(Buffer.from(fullListText, 'utf-8'), { name: `davet-listesi-${targetUser.username}.txt` });
                        files.push(attachment);
                    } else {
                        invitedText = invitedUsers.map((u, i) => `${i + 1}. <@${u.user_id}>`).join('\n');
                    }
                } else {
                    invitedText = 'Henüz kimseyi davet etmemiş.';
                }

                const payload = createV2Container({
                    title: `Davet Bilgileri`,
                    description: `**Kullanıcı:** <@${targetUser.id}>\n\n**Davet Ettiği Kişi Sayısı:** \`${inviteCount}\` kişi.\n\n**Kim Davet Etti:**\n${inviterInfo}\n\n**Son Davet Ettikleri:**\n${invitedText}`,
                    color: COLORS.INFO
                });
                
                if (files.length > 0) payload.files = files;

                await interaction.editReply(payload);

            } else if (subCommand === 'siralama') {
                // En çok davet yapan ilk 10 kişi
                const topInvites = await conn.query(
                    'SELECT inviter_id, COUNT(*) as total FROM invite_tracking WHERE guild_id = ? AND inviter_id != "BİLİNMİYOR" GROUP BY inviter_id ORDER BY total DESC LIMIT 10',
                    [guildId]
                );

                let rows = topInvites;
                if (!Array.isArray(topInvites)) {
                    // if it returned multiple result sets or an object
                    rows = topInvites[0] || [];
                }
                
                // Fallback structure fix for mariadb returns
                if (!rows || rows.length === 0 || (rows.length === 1 && rows[0].inviter_id === undefined && rows.inviter_id === undefined)) {
                    rows = Array.isArray(topInvites) ? topInvites : Object.values(topInvites);
                    if (rows.length > 0 && Array.isArray(rows[0])) rows = rows[0];
                }

                if (!rows || rows.length === 0) {
                    return await interaction.editReply(createV2Container({
                        title: 'Davet Sıralaması',
                        description: 'Henüz sunucuda kaydedilmiş bir davet bulunmuyor.',
                        color: COLORS.WARNING
                    }));
                }

                let desc = '**— EN ÇOK DAVET YAPANLAR —**\n\n';
                let rank = 1;
                for (const row of rows) {
                    if (row.inviter_id && row.total) {
                        desc += `**${rank}.** <@${row.inviter_id}> — \`${row.total}\` davet\n`;
                        rank++;
                    }
                }

                if (rank === 1) {
                    desc = 'Geçerli bir davet verisi bulunamadı.';
                }

                const payload = createV2Container({
                    title: 'Sunucu Davet Sıralaması',
                    description: desc,
                    color: COLORS.PRIMARY
                });

                await interaction.editReply(payload);
            }
        } catch (error) {
            console.error('Davet komutu hatası:', error);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    },
};
