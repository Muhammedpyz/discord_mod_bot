const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kayıtsız')
        .setDescription('Üyeyi kayıtsıza atar.')
        .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getMember('uye');
        const sebep = interaction.options.getString('sebep') || 'Belirtilmedi';
        if (!uye || uye.user.bot) {
            return interaction.editReply(createContainerMessage('Hata', 'Geçerli bir üye etiketle.', '#ED4245', [], [], false, true));
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.editReply(createContainerMessage('Yetki Yok', 'Kayıt yetkin bulunmuyor.', '#ED4245', [], [], false, true));
        }
        try {
            const rows = await db.pool.query('SELECT kayitsiz_role_id FROM kayit_config WHERE guild_id = ?', [interaction.guild.id]);
            const kayitsiz = rows[0]?.kayitsiz_role_id;
            const alinacak = uye.roles.cache.filter(r => r.id !== interaction.guild.id && r.id !== kayitsiz).map(r => r.id);
            if (alinacak.length > 0) await uye.roles.remove(alinacak, `Kayıtsıza atıldı: ${sebep}`).catch(() => {});
            if (kayitsiz) await uye.roles.add(kayitsiz, 'Kayıtsız').catch(() => {});
            await uye.setNickname('• Kayıtsız', `Kayıtsız: ${sebep}`).catch(() => {});
            await interaction.editReply(createContainerMessage('Kayıtsız', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> kayıtsıza atıldı. (Sebep: ${sebep})`, '#FEE75C', [], [], false, true));
        } catch (e) {
            console.error('[Kayıtsız]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız (rol sırasını kontrol et).', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
