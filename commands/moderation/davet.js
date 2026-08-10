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
                const [inviteCountRes] = await conn.query(
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
                const [invitedByRes] = await conn.query(
                    'SELECT inviter_id, joined_at FROM invite_tracking WHERE guild_id = ? AND user_id = ? LIMIT 1',
                    [guildId, targetUser.id]
                );

                let inviterInfo = 'Bilinmiyor veya kendi linkiyle/özel linkle gelmiş.';
                let inviterId = invitedByRes ? (invitedByRes.inviter_id || (invitedByRes[0] ? invitedByRes[0].inviter_id : null)) : null;

                if (inviterId) {
                    if (inviterId === 'BİLİNMİYOR') {
                        inviterInfo = 'Özel Davet Bağlantısı (Vanity URL) veya Bot';
                    } else {
                        inviterInfo = `<@${inviterId}> tarafından davet edilmiş.`;
                    }
                }

                const payload = createV2Container({
                    title: `Davet Bilgileri`,
                    description: `**Kullanıcı:** <@${targetUser.id}>\n\n**Davet Ettiği Kişi Sayısı:** \`${inviteCount}\` kişi.\n\n**Kim Davet Etti:**\n${inviterInfo}`,
                    color: COLORS.INFO
                });

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
