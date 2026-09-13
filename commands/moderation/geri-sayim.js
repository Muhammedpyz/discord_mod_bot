const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { parseFancyDuration, fmtDuration } = require('../../utils/theme');

function renderKalan(bitis) {
    return fmtDuration(Math.max(0, bitis - Date.now()));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('geri-sayım')
        .setDescription('Canlı geri sayım kartı başlatır (aynı mesaj güncellenir).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(o => o.setName('sure').setDescription('Süre (örn: 10dk, 1s30dk, 2gün)').setRequired(true))
        .addStringOption(o => o.setName('baslik').setDescription('Başlık').setRequired(true).setMaxLength(100))
        .addChannelOption(o => o.setName('kanal').setDescription('Kanal (boşsa burası)').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sure = interaction.options.getString('sure');
        const baslik = interaction.options.getString('baslik');
        const kanal = interaction.options.getChannel('kanal') || interaction.channel;
        const ms = parseFancyDuration(sure);
        if (!ms) {
            return interaction.editReply(createContainerMessage('Hata', 'Geçersiz süre! Örn: `10dk`, `1s30dk`.', '#ED4245', [], [], false, true));
        }
        if (!kanal.isTextBased()) {
            return interaction.editReply(createContainerMessage('Hata', 'Metin kanalı seçmelisin.', '#ED4245', [], [], false, true));
        }
        try {
            const bitis = Date.now() + ms;
            const res = await db.pool.query('INSERT INTO geri_sayim (guild_id, channel_id, baslik, bitis) VALUES (?, ?, ?, ?)', [interaction.guild.id, kanal.id, baslik, bitis]);
            const id = Number(res.insertId);
            const payload = createContainerMessage(baslik, `Kalan süre: **${renderKalan(bitis)}**`, '#5865F2');
            const msg = await kanal.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
            await db.pool.query('UPDATE geri_sayim SET message_id = ? WHERE id = ?', [msg.id, id]);
            await interaction.editReply(createContainerMessage('Başlatıldı', `<:mono:${MONO_EMOJIS.check}> Geri sayım <#${kanal.id}> kanalında başladı, kart otomatik güncellenir.`, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[GeriSayım]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
