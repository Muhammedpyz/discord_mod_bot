const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji-ekle')
        .setDescription('Sunucuya emoji ekler (emoji yaz ya da dosya yükle).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addStringOption(o => o.setName('isim').setDescription('Emoji adı').setRequired(true).setMaxLength(32))
        .addStringOption(o => o.setName('emoji').setDescription('Kopyalanacak emoji (örn: :ornek:)').setRequired(false))
        .addAttachmentOption(o => o.setName('dosya').setDescription('Resim dosyası').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const isim = interaction.options.getString('isim').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const emojiStr = interaction.options.getString('emoji');
        const dosya = interaction.options.getAttachment('dosya');
        try {
            let url = null;
            if (emojiStr) {
                const m = emojiStr.match(/<(a)?:\w+:(\d+)>/);
                if (!m) {
                    return interaction.editReply(createContainerMessage('Hata', 'Geçerli bir özel emoji yapıştır (sunucudaki emojilerden).', '#ED4245', [], [], false, true));
                }
                url = `https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? 'gif' : 'png'}`;
            } else if (dosya) {
                if (!dosya.contentType || !dosya.contentType.startsWith('image/')) {
                    return interaction.editReply(createContainerMessage('Hata', 'Resim dosyası yükle.', '#ED4245', [], [], false, true));
                }
                url = dosya.url;
            } else {
                return interaction.editReply(createContainerMessage('Hata', 'Emoji ya da dosya vermelisin.', '#ED4245', [], [], false, true));
            }
            const em = await interaction.guild.emojis.create({ attachment: url, name: isim });
            await interaction.editReply(createContainerMessage('Eklendi', `<:mono:${MONO_EMOJIS.check}> ${em} sunucuya **:${isim}:** olarak eklendi!`, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[EmojiEkle]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Eklenemedi (slot dolu, boyut büyük ya da yetki eksik olabilir).', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
