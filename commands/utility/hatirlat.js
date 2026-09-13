const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { parseFancyDuration } = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hatirlat')
        .setDescription('Hatırlatıcı kur, listele ve yönet.')
        .addSubcommand(sub =>
            sub.setName('kur')
                .setDescription('Belirtilen süre sonunda hatırlatma gönderir.')
                .addStringOption(opt => opt.setName('sure').setDescription('Süre (Örn: 10dk, 1s30dk, 2gün)').setRequired(true))
                .addStringOption(opt => opt.setName('mesaj').setDescription('Sana ne hatırlatmamı istersin?').setRequired(true))
                .addBooleanOption(opt => opt.setName('dm').setDescription('DM üzerinden mi hatırlatayım?').setRequired(false))
                .addStringOption(opt => opt.setName('tekrar').setDescription('Tekrarlama').setRequired(false).addChoices(
                    { name: 'Tek seferlik', value: 'none' },
                    { name: 'Her gün', value: 'daily' },
                    { name: 'Her hafta', value: 'weekly' }
                ))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Aktif hatırlatıcılarını listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Bir hatırlatıcıyı siler.')
                .addIntegerOption(opt => opt.setName('id').setDescription('Silinecek hatırlatıcı ID').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();

        let conn;
        try {
            conn = await db.pool.getConnection();

            if (sub === 'kur') {
                const sureStr = interaction.options.getString('sure');
                const mesaj = interaction.options.getString('mesaj');
                const isDm = interaction.options.getBoolean('dm') || false;
                const recurring = interaction.options.getString('tekrar') || 'none';

                const durationMs = parseFancyDuration(sureStr);
                if (!durationMs) {
                    return interaction.editReply(createContainerMessage('Hata', 'Geçersiz süre! Örn: `10dk`, `2s`, `1g`, `1s30dk`, `2gün3saat`.', '#ED4245', [], [], false, true));
                }

                const remindAt = new Date(Date.now() + durationMs);
                const res = await conn.query(
                    'INSERT INTO reminders (guild_id, user_id, channel_id, message, remind_at, is_dm, recurring) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [interaction.guild.id, interaction.user.id, interaction.channel.id, mesaj, remindAt, isDm, recurring]
                );
                const rid = Number(res.insertId);
                try { require('../../utils/achievements').trackReminder(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rem_snooze_${rid}`).setLabel('10dk Ertele').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.clock),
                    new ButtonBuilder().setCustomId(`rem_del_${rid}`).setLabel('Sil').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete)
                );
                await interaction.editReply(createContainerMessage(
                    'Hatırlatıcı Kuruldu',
                    `Sana <t:${Math.floor(remindAt.getTime() / 1000)}:R> şunu hatırlatacağım:\n\n\`${mesaj}\`${recurring !== 'none' ? `\n-# Tekrar: ${recurring === 'daily' ? 'her gün' : 'her hafta'}` : ''}`,
                    '#57F287', [row]
                ));
            }

            else if (sub === 'liste') {
                const rows = await conn.query('SELECT * FROM reminders WHERE guild_id = ? AND user_id = ? AND sent = FALSE ORDER BY remind_at ASC LIMIT 10', [interaction.guild.id, interaction.user.id]);
                if (rows.length === 0) {
                    return interaction.editReply(createContainerMessage('Hatırlatıcılar', 'Aktif hatırlatıcın yok.', '#3498DB', [], [], false, true));
                }
                let list = '';
                for (const r of rows) {
                    list += `\`#${r.id}\` <t:${Math.floor(new Date(r.remind_at).getTime() / 1000)}:R> — ${String(r.message).slice(0, 80)}\n`;
                }
                const firstRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rem_del_${rows[0].id}`).setLabel(`#${rows[0].id} Sil`).setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.delete)
                );
                await interaction.editReply(createContainerMessage('Aktif Hatırlatıcıların', list, '#5865F2', [firstRow]));
            }

            else if (sub === 'sil') {
                const id = interaction.options.getInteger('id');
                const res = await conn.query('DELETE FROM reminders WHERE id = ? AND guild_id = ? AND user_id = ?', [id, interaction.guild.id, interaction.user.id]);
                if (res.affectedRows > 0) {
                    await interaction.editReply(createContainerMessage('Silindi', `#${id} numaralı hatırlatıcı silindi.`, '#57F287', [], [], false, true));
                } else {
                    await interaction.editReply(createContainerMessage('Hata', 'Böyle bir hatırlatıcın bulunamadı.', '#ED4245', [], [], false, true));
                }
            }
        } catch (e) {
            console.error('Reminder error:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Bir sorun oluştu.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
