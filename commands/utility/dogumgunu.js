const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dogumgunu')
        .setDescription('Doğum Günü Sistemi Yönetimi')
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Kendi doğum gününüzü ayarlayın.')
                .addIntegerOption(opt => opt.setName('gun').setDescription('Doğduğunuz Gün (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
                .addIntegerOption(opt => opt.setName('ay').setDescription('Doğduğunuz Ay (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
                .addIntegerOption(opt => opt.setName('yil').setDescription('Doğduğunuz Yıl (İsteğe Bağlı)').setRequired(false).setMinValue(1900).setMaxValue(new Date().getFullYear()))
        )
        .addSubcommand(sub =>
            sub.setName('kanal-ayarla')
                .setDescription('Sunucu için doğum günü kutlama kanalını belirler.')
                .addChannelOption(opt => opt.setName('kanal').setDescription('Kutlama Mesajı Kanalı').setRequired(true))
                .addRoleOption(opt => opt.setName('rol').setDescription('Günün Çocuğu Rolü (İsteğe Bağlı)').setRequired(false))
                .addStringOption(opt => opt.setName('mesaj').setDescription('Kutlama Şablonu ({user}, {age})').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Kaydedilmiş doğum günlerini listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('yaklasan')
                .setDescription('Önümüzdeki 30 günün doğum günlerini gösterir.')
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Kendi doğum günü kaydını siler.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

        let conn;
        try {
            conn = await db.pool.getConnection();
            if (sub === 'ayarla') {
                const day = interaction.options.getInteger('gun');
                const month = interaction.options.getInteger('ay');
                const year = interaction.options.getInteger('yil');

                await conn.query(
                    'INSERT INTO user_birthdays (guild_id, user_id, day, month, year) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE day=?, month=?, year=?',
                    [interaction.guild.id, interaction.user.id, day, month, year, day, month, year]
                );

                return interaction.editReply(createContainerMessage('Doğum Günü Kaydedildi', `<:mono:${MONO_EMOJIS.check}> Doğum günün **${day}/${month}${year ? '/' + year : ''}** olarak kaydedildi! O gün geldiğinde kutlamayı unutmayacağız.`, '#57F287', [], [], false, true));
            }
            else if (sub === 'kanal-ayarla') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.editReply(createContainerMessage('Hata', 'Sunucuyu Yönet yetkin yok.', '#ED4245', [], [], false, true));
                }

                const channel = interaction.options.getChannel('kanal');
                const role = interaction.options.getRole('rol');
                const msg = interaction.options.getString('mesaj') || 'İyi ki doğdun {user}! Harika bir yaş dileriz.';

                await conn.query(
                    'INSERT INTO birthday_config (guild_id, channel_id, message_template, temp_role_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id=?, message_template=?, temp_role_id=?',
                    [interaction.guild.id, channel.id, msg, role?.id || null, channel.id, msg, role?.id || null]
                );

                return interaction.editReply(createContainerMessage('Sistem Aktif', `<:mono:${MONO_EMOJIS.check}> Doğum günü sistemi açıldı!\nKanal: <#${channel.id}>\nRol: ${role ? '<@&' + role.id + '>' : 'Yok'}`, '#57F287', [], [], false, true));
            }
            else if (sub === 'liste') {
                const rows = await conn.query('SELECT user_id, day, month, year FROM user_birthdays WHERE guild_id = ? ORDER BY month ASC, day ASC LIMIT 20', [interaction.guild.id]);
                if (rows.length === 0) {
                    return interaction.editReply(createContainerMessage('Doğum Günleri', 'Kayıtlı doğum günü yok.', '#3498DB', [], [], false, true));
                }
                let list = '';
                for (const r of rows) {
                    list += `<@${r.user_id}> — **${r.day}/${r.month}**${r.year ? `/${r.year}` : ''}\n`;
                }
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bday_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
                );
                return interaction.editReply(createContainerMessage('Kayıtlı Doğum Günleri', list, '#5865F2', [row]));
            }
            else if (sub === 'yaklasan') {
                const rows = await conn.query('SELECT user_id, day, month, year FROM user_birthdays WHERE guild_id = ?', [interaction.guild.id]);
                const now = new Date();
                const upcoming = [];
                for (const r of rows) {
                    const thisYear = new Date(now.getFullYear(), r.month - 1, r.day);
                    let next = thisYear;
                    if (thisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                        next = new Date(now.getFullYear() + 1, r.month - 1, r.day);
                    }
                    const diffDays = Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
                    if (diffDays <= 30) upcoming.push({ ...r, diffDays });
                }
                upcoming.sort((a, b) => a.diffDays - b.diffDays);
                if (upcoming.length === 0) {
                    return interaction.editReply(createContainerMessage('Yaklaşan Doğum Günleri', 'Önümüzdeki 30 günde doğum günü yok.', '#3498DB', [], [], false, true));
                }
                let list = '';
                for (const u of upcoming.slice(0, 15)) {
                    list += `<@${u.user_id}> — **${u.day}/${u.month}** (${u.diffDays === 0 ? 'bugün' : u.diffDays + ' gün sonra'})\n`;
                }
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bday_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
                );
                return interaction.editReply(createContainerMessage('Yaklaşan Doğum Günleri', list, '#5865F2', [row]));
            }
            else if (sub === 'sil') {
                const res = await conn.query('DELETE FROM user_birthdays WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
                if (res.affectedRows > 0) {
                    return interaction.editReply(createContainerMessage('Silindi', 'Doğum günü kaydın silindi.', '#57F287', [], [], false, true));
                }
                return interaction.editReply(createContainerMessage('Bilgi', 'Kayıtlı doğum günün yok.', '#3498DB', [], [], false, true));
            }
        } catch (e) {
            console.error('Birthday cmd err:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
