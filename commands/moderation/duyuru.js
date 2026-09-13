const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duyuru')
        .setDescription('Duyuru yayınla veya düzenle.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(s => s.setName('yayınla')
            .setDescription('V2 duyuru kartı yayınlar.')
            .addChannelOption(o => o.setName('kanal').setDescription('Kanal').setRequired(true))
            .addStringOption(o => o.setName('baslik').setDescription('Başlık').setRequired(true).setMaxLength(100))
            .addStringOption(o => o.setName('mesaj').setDescription('Duyuru metni').setRequired(true).setMaxLength(2000))
            .addRoleOption(o => o.setName('rol').setDescription('Etiketlenecek rol').setRequired(false)))
        .addSubcommand(s => s.setName('düzenle')
            .setDescription('Yayınlanan duyuruyu düzenler (aynı mesaj).')
            .addStringOption(o => o.setName('mesaj-id').setDescription('Duyuru mesaj ID').setRequired(true))
            .addStringOption(o => o.setName('yeni-mesaj').setDescription('Yeni metin').setRequired(true).setMaxLength(2000))),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'yayınla') {
                const kanal = interaction.options.getChannel('kanal');
                const baslik = interaction.options.getString('baslik');
                const mesaj = interaction.options.getString('mesaj');
                const rol = interaction.options.getRole('rol');
                if (!kanal.isTextBased()) {
                    return interaction.editReply(createContainerMessage('Hata', 'Metin kanalı seçmelisin.', '#ED4245', [], [], false, true));
                }
                const body = `${rol ? `<@&${rol.id}>\n\n` : ''}${mesaj}`;
                const payload = createContainerMessage(baslik, body, '#5865F2');
                const sent = await kanal.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
                await interaction.editReply(createContainerMessage('Yayınlandı', `<:mono:${MONO_EMOJIS.check}> Duyuru <#${kanal.id}> kanalına atıldı. (ID: \`${sent.id}\`)`, '#57F287', [], [], false, true));
            } else {
                const mid = interaction.options.getString('mesaj-id');
                const yeni = interaction.options.getString('yeni-mesaj');
                let found = null;
                for (const ch of interaction.guild.channels.cache.values()) {
                    if (!ch.isTextBased()) continue;
                    const m = await ch.messages.fetch(mid).catch(() => null);
                    if (m && m.author.id === interaction.client.user.id) { found = m; break; }
                }
                if (!found) {
                    return interaction.editReply(createContainerMessage('Hata', 'Botun attığı böyle bir mesaj bulunamadı.', '#ED4245', [], [], false, true));
                }
                const comps = found.components;
                if (!comps || comps.length === 0) {
                    await found.edit({ content: yeni }).catch(() => {});
                } else {
                    // V2 container içindeki ilk metni güncelle (aynı mesaj, yeni mesaj yok)
                    const json = comps[0].toJSON();
                    const inner = json.components || [];
                    const idx = inner.findIndex(c => c.type === 10);
                    if (idx > -1) inner[idx] = { type: 10, content: yeni.slice(0, 3900) };
                    await found.edit({ components: [{ ...json, components: inner }] }).catch(() => {});
                }
                await interaction.editReply(createContainerMessage('Düzenlendi', `<:mono:${MONO_EMOJIS.check}> Duyuru aynı mesaj üzerinde güncellendi.`, '#57F287', [], [], false, true));
            }
        } catch (e) {
            console.error('[Duyuru]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
