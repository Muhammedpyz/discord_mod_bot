const { SlashCommandBuilder } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hatirlat')
        .setDescription('Belirtilen süre sonra size hatırlatma yapar.')
        .addStringOption(opt => opt.setName('sure').setDescription('Süre (örn: 10m, 2h, 1d)').setRequired(true))
        .addStringOption(opt => opt.setName('not').setDescription('Hatırlatılacak not').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        let conn;
        try {
            const sureStr = interaction.options.getString('sure');
            const note = interaction.options.getString('not');

            let multiplier = 0;
            if (sureStr.endsWith('m')) multiplier = 60 * 1000;
            else if (sureStr.endsWith('h')) multiplier = 60 * 60 * 1000;
            else if (sureStr.endsWith('d')) multiplier = 24 * 60 * 60 * 1000;
            else {
                return await interaction.editReply(createContainerMessage(`${EMOJIS.cross} Hata`, 'Geçersiz süre formatı. Geçerli formatlar: 10m, 2h, 1d', '#2B2D31'));
            }

            const val = parseInt(sureStr.slice(0, -1));
            if (isNaN(val) || val <= 0) {
                return await interaction.editReply(createContainerMessage(`${EMOJIS.cross} Hata`, 'Geçersiz süre değeri.', '#2B2D31'));
            }

            const ms = val * multiplier;
            const remindAt = new Date(Date.now() + ms);

            conn = await pool.getConnection();
            const res = await conn.query(
                'INSERT INTO reminders (guild_id, user_id, channel_id, reminder_text, remind_at) VALUES (?, ?, ?, ?, ?)',
                [interaction.guild.id, interaction.user.id, interaction.channel.id, note, remindAt]
            );
            const reminderId = res.insertId;

            await interaction.editReply(createContainerMessage(`${EMOJIS.check} Başarılı`, `Hatırlatmanız kuruldu. **${sureStr}** sonra size hatırlatacağım.`, '#2B2D31'));

            if (ms <= 24 * 60 * 60 * 1000) {
                setTimeout(async () => {
                    let timeoutConn;
                    try {
                        timeoutConn = await pool.getConnection();
                        const rows = await timeoutConn.query('SELECT is_sent FROM reminders WHERE id = ?', [reminderId]);
                        if (rows.length > 0 && !rows[0].is_sent) {
                            await timeoutConn.query('UPDATE reminders SET is_sent = TRUE WHERE id = ?', [reminderId]);
                            interaction.channel.send({
                                content: `<@${interaction.user.id}>`,
                                embeds: [],
                                components: [],
                                ...createContainerMessage(`${EMOJIS.pin} Hatırlatıcı`, `Hatırlatmanız: ${note}`, '#2B2D31')
                            }).catch(() => {});
                        }
                    } catch (e) {
                        console.error('Reminder timeout error:', e);
                    } finally {
                        if (timeoutConn) timeoutConn.release();
                    }
                }, ms);
            }

        } catch (error) {
            console.error('Error in hatirlat command:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
