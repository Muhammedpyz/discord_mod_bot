const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dogum-gunu')
        .setDescription('Doğum günü sistemi')
        .addSubcommand(subcmd => 
            subcmd.setName('kaydet')
                .setDescription('Doğum gününüzü kaydeder')
                .addIntegerOption(opt => opt.setName('gun').setDescription('Gün (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
                .addIntegerOption(opt => opt.setName('ay').setDescription('Ay (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('goruntule')
                .setDescription('Bir kullanıcının doğum gününü görüntüler')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(false))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('sil')
                .setDescription('Kaydedilmiş doğum gününüzü siler')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('yaklasanlar')
                .setDescription('Yaklaşan doğum günlerini listeler')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'kaydet') {
                const day = interaction.options.getInteger('gun');
                const month = interaction.options.getInteger('ay');

                await conn.query(
                    'INSERT INTO birthdays (user_id, guild_id, birth_day, birth_month) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE birth_day = ?, birth_month = ?',
                    [interaction.user.id, interaction.guild.id, day, month, day, month]
                );
                await interaction.editReply(createContainerMessage(`${EMOJIS.announcement} Başarılı`, `Doğum gününüz **${day}/${month}** olarak kaydedildi.`, '#2B2D31'));
            } else if (subcommand === 'goruntule') {
                const targetUser = interaction.options.getUser('kullanici') || interaction.user;
                const rows = await conn.query('SELECT birth_day, birth_month FROM birthdays WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
                if (rows.length > 0) {
                    await interaction.editReply(createContainerMessage(`${EMOJIS.announcement} Doğum Günü`, `<@${targetUser.id}> kullanıcısının doğum günü: **${rows[0].birth_day}/${rows[0].birth_month}**`, '#2B2D31'));
                } else {
                    await interaction.editReply(createContainerMessage(`${EMOJIS.cross} Bilgi Yok`, `Bu kullanıcının doğum günü bilgisi bulunmuyor.`, '#2B2D31'));
                }
            } else if (subcommand === 'sil') {
                await conn.query('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
                await interaction.editReply(createContainerMessage(`${EMOJIS.check} Başarılı`, `Doğum günü bilginiz silindi.`, '#2B2D31'));
            } else if (subcommand === 'yaklasanlar') {
                const rows = await conn.query('SELECT user_id, birth_day, birth_month FROM birthdays WHERE guild_id = ?', [interaction.guild.id]);
                
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentDay = now.getDate();

                const sorted = rows.map(r => {
                    let nextDate = new Date(now.getFullYear(), r.birth_month - 1, r.birth_day);
                    if (nextDate < now) {
                        nextDate = new Date(now.getFullYear() + 1, r.birth_month - 1, r.birth_day);
                    }
                    return { ...r, nextDate };
                }).sort((a, b) => a.nextDate - b.nextDate).slice(0, 10);

                if (sorted.length === 0) {
                    return await interaction.editReply(createContainerMessage(`${EMOJIS.announcement} Yaklaşan Doğum Günleri`, `Kayıtlı doğum günü bulunmuyor.`, '#2B2D31'));
                }

                let text = '';
                for (const b of sorted) {
                    text += `• <@${b.user_id}> - ${b.birth_day}/${b.birth_month}\n`;
                }

                await interaction.editReply(createContainerMessage(`${EMOJIS.announcement} Yaklaşan Doğum Günleri`, text, '#2B2D31'));
            }

        } catch (error) {
            console.error('Error in dogum-gunu command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
