const { SlashCommandBuilder } = require('discord.js');
const { pool } = require('../../db');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('davet')
        .setDescription('Kullanıcının davet istatistiklerini ve kırılımını görüntüler.')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Davetlerine bakılacak kullanıcı (boş bırakırsanız kendiniz)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
        const guildId = interaction.guild.id;

        let conn;
        try {
            conn = await pool.getConnection();

            // 1. Ensure bonus_invites table exists
            await conn.query(`
                CREATE TABLE IF NOT EXISTS bonus_invites (
                    guild_id VARCHAR(25) NOT NULL,
                    user_id VARCHAR(25) NOT NULL,
                    bonus_amount INT DEFAULT 0,
                    PRIMARY KEY (guild_id, user_id)
                )
            `);

            // 2. Fetch Invite Stats Breakdown
            const [regularRows, leftRows, fakeRows, bonusRows, inviterRows] = await Promise.all([
                // Giren (Aktif, ayrılmamış ve sahte olmayan)
                conn.query(
                    'SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND has_left = FALSE AND is_fake = FALSE',
                    [guildId, targetUser.id]
                ),
                // Ayrılan (Sunucudan çıkmış olanlar)
                conn.query(
                    'SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND has_left = TRUE',
                    [guildId, targetUser.id]
                ),
                // Sahte (7 günden yeni açılmış şüpheli hesaplar)
                conn.query(
                    'SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND is_fake = TRUE',
                    [guildId, targetUser.id]
                ),
                // Bonus davetler
                conn.query(
                    'SELECT bonus_amount FROM bonus_invites WHERE guild_id = ? AND user_id = ? LIMIT 1',
                    [guildId, targetUser.id]
                ),
                // Kullanıcıyı kim davet etti?
                conn.query(
                    'SELECT inviter_id, invite_code FROM invite_tracking WHERE guild_id = ? AND user_id = ? LIMIT 1',
                    [guildId, targetUser.id]
                )
            ]);

            const regularCount = Number(regularRows[0]?.cnt || 0);
            const leftCount = Number(leftRows[0]?.cnt || 0);
            const fakeCount = Number(fakeRows[0]?.cnt || 0);
            const bonusCount = Number(bonusRows[0]?.bonus_amount || 0);
            const totalCount = regularCount + bonusCount;

            let inviterText = 'Bilinmiyor';
            if (inviterRows && inviterRows.length > 0 && inviterRows[0].inviter_id) {
                const invId = inviterRows[0].inviter_id;
                if (invId === 'BİLİNMİYOR' || invId === 'VANITY') {
                    inviterText = 'Özel Davet Bağlantısı (Vanity URL) veya Bot';
                } else {
                    inviterText = `<@${invId}>`;
                }
            }

            const eSparkles = getMonoEmoji('wand_sparkles') || getMonoEmoji('sparkles');
            const eUser = getMonoEmoji('user');
            const eSignal = getMonoEmoji('signal') || getMonoEmoji('chart');

            const payload = buildModBResponse({
                title: `${eSparkles} ${targetUser.username} — Davetler:`,
                thumbnail: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
                textLines: [
                    `» ${eUser} **Davet Ettiği:** ${totalCount}`,
                    `» ${eSignal} **Kırılım:** ${regularCount} giren · ${leftCount} ayrılan · ${fakeCount} sahte · ${bonusCount} bonus`,
                    `» ${eUser} **Onu Davet Eden:** ${inviterText}`,
                    '---SEPARATOR---',
                    '-# Sayılar bot kapalıyken gelenleri ve özel (vanity) davet linkini kapsamaz.'
                ]
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Davet komutu hatası:', error);
            await interaction.editReply({ content: 'Davet bilgileri yüklenirken bir hata oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    }
};
