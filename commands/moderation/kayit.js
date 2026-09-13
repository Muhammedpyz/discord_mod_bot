const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kayıt')
        .setDescription('Üye kaydı yapar (isim + yaş + rol).')
        .addUserOption(o => o.setName('uye').setDescription('Kaydedilecek üye').setRequired(true))
        .addStringOption(o => o.setName('isim').setDescription('Üye ismi').setRequired(true).setMaxLength(30))
        .addIntegerOption(o => o.setName('yas').setDescription('Üye yaşı').setRequired(true).setMinValue(5).setMaxValue(100))
        .addStringOption(o => o.setName('cinsiyet').setDescription('Cinsiyet rolü').setRequired(false).addChoices(
            { name: 'Erkek', value: 'erkek' },
            { name: 'Kız', value: 'kiz' }
        )),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getMember('uye');
        const isim = interaction.options.getString('isim');
        const yas = interaction.options.getInteger('yas');
        const cinsiyet = interaction.options.getString('cinsiyet');

        if (!uye || uye.user.bot) {
            return interaction.editReply(createContainerMessage('Hata', 'Geçerli bir üye etiketle.', '#ED4245', [], [], false, true));
        }

        let conn;
        try {
            conn = await db.pool.getConnection();
            const cfgRows = await conn.query('SELECT * FROM kayit_config WHERE guild_id = ?', [interaction.guild.id]);
            const cfg = cfgRows[0] || {};

            const yetkiliRol = cfg.yetkili_role_id;
            const canRegister = interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)
                || (yetkiliRol && interaction.member.roles.cache.has(yetkiliRol));
            if (!canRegister) {
                return interaction.editReply(createContainerMessage('Yetki Yok', 'Kayıt yetkin bulunmuyor.', '#ED4245', [], [], false, true));
            }

            const nick = `${isim} | ${yas}`;
            await uye.setNickname(nick).catch(() => {});

            const verilecek = [];
            if (cinsiyet === 'erkek' && cfg.erkek_role_id) verilecek.push(cfg.erkek_role_id);
            if (cinsiyet === 'kiz' && cfg.kiz_role_id) verilecek.push(cfg.kiz_role_id);
            for (const r of verilecek) await uye.roles.add(r, 'Kayıt').catch(() => {});
            if (cfg.kayitsiz_role_id && uye.roles.cache.has(cfg.kayitsiz_role_id)) {
                await uye.roles.remove(cfg.kayitsiz_role_id, 'Kayıt tamamlandı').catch(() => {});
            }

            await conn.query('INSERT INTO kayitlar (guild_id, user_id, admin_id, isim, yas) VALUES (?, ?, ?, ?, ?)', [interaction.guild.id, uye.id, interaction.user.id, isim, yas]);

            if (cfg.log_channel_id) {
                const logCh = interaction.guild.channels.cache.get(cfg.log_channel_id);
                if (logCh && logCh.isTextBased()) {
                    const payload = createContainerMessage('Yeni Kayıt', `**Üye:** <@${uye.id}>\n**İsim Yaş:** ${nick}\n**Yetkili:** <@${interaction.user.id}>`, '#57F287');
                    await logCh.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
            }

            await interaction.editReply(createContainerMessage('Kayıt Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> kaydedildi: **${nick}**`, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[Kayıt]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Kayıt sırasında sorun oluştu (rol sırası/nick yetkisini kontrol et).', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
