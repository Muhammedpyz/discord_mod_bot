const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('evlen')
            .setDescription('Bir üyeye evlilik teklif edersin.')
            .addUserOption(o => o.setName('uye').setDescription('Teklif edilecek üye').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getUser('uye');
            if (uye.id === interaction.user.id || uye.bot) {
                return interaction.editReply(createContainerMessage('Hata', 'Kendine veya bota teklif edemezsin.', '#ED4245', [], [], false, true));
            }
            try {
                const [a, b] = await Promise.all([
                    db.pool.query('SELECT partner_id FROM user_profiles WHERE user_id = ?', [interaction.user.id]),
                    db.pool.query('SELECT partner_id FROM user_profiles WHERE user_id = ?', [uye.id])
                ]);
                if (a[0]?.partner_id) {
                    return interaction.editReply(createContainerMessage('Olmaz', 'Zaten evlisin! Önce boşanmalısın.', '#ED4245', [], [], false, true));
                }
                if (b[0]?.partner_id) {
                    return interaction.editReply(createContainerMessage('Olmaz', 'Bu üye zaten evli!', '#ED4245', [], [], false, true));
                }
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`evlen_kabul_${interaction.user.id}_${uye.id}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.heart),
                    new ButtonBuilder().setCustomId(`evlen_red_${interaction.user.id}_${uye.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross)
                );
                // Teklif herkese açık karta gider (hedef butona basabilsin)
                const teklif = createContainerMessage('Evlilik Teklifi', `<@${interaction.user.id}> sana evlilik teklif etti <@${uye.id}>!\n\nKarar senin:`, '#FEE75C', [row]);
                await interaction.channel.send({ ...teklif, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                await interaction.editReply(createContainerMessage('Gönderildi', `Teklifin kanala iletildi, <@${uye.id}> cevaplayınca sonuç aynı kartta görünecek.`, '#57F287', [], [], false, true));
                // Teklif edilen kişiye DM ile haber ver
                try {
                    const dm = createContainerMessage('Evlilik Teklifi', `<@${interaction.user.id}> sana **${interaction.guild.name}** sunucusunda evlilik teklif etti! Komutu çalıştırıp butonlardan cevap ver.`, '#FEE75C');
                    const u = await interaction.client.users.fetch(uye.id).catch(() => null);
                    if (u) await u.send({ ...dm, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                } catch {}
            } catch (e) {
                console.error('[Evlen]:', e.message);
                await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('boşan')
            .setDescription('Evliliğini bitirirsin (onaylı).'),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            try {
                const p = await db.getUserProfile(interaction.user.id);
                if (!p?.partner_id) {
                    return interaction.editReply(createContainerMessage('Bilgi', 'Zaten evli değilsin.', '#3498DB', [], [], false, true));
                }
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bosan_onay').setLabel('Evet, Boşan').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.check),
                    new ButtonBuilder().setCustomId('bosan_iptal').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.cross)
                );
                await interaction.editReply(createContainerMessage('Boşanma Onayı', `<@${p.partner_id}> ile evliliğini bitirmek istiyor musun?`, '#FEE75C', [row]));
            } catch (e) {
                console.error('[Boşan]:', e.message);
                await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
            }
        }
    }
];
