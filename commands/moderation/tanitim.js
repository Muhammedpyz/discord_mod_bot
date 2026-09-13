const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tanıtım')
        .setDescription('Sunucu tanıtımı yayınla veya kanalını ayarla.')
        .addSubcommand(s => s.setName('kanal')
            .setDescription('Tanıtım kanalını ayarlar (yönetici).')
            .addChannelOption(o => o.setName('kanal').setDescription('Tanıtım kanalı').setRequired(true))
            .addIntegerOption(o => o.setName('cooldown').setDescription('Kullanıcı başına saat (varsayılan 6)').setRequired(false).setMinValue(1).setMaxValue(72)))
        .addSubcommand(s => s.setName('gönder')
            .setDescription('Tanıtımını yayınlar.')
            .addStringOption(o => o.setName('mesaj').setDescription('Tanıtım metni + davet linki').setRequired(true).setMaxLength(1000))),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'kanal') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.editReply(createContainerMessage('Yetki Yok', 'Sunucuyu Yönet yetkin lazım.', '#ED4245', [], [], false, true));
                }
                const kanal = interaction.options.getChannel('kanal');
                const cd = interaction.options.getInteger('cooldown') || 6;
                await db.pool.query('INSERT INTO tanitim_config (guild_id, channel_id, cooldown_hours) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), cooldown_hours=VALUES(cooldown_hours)', [interaction.guild.id, kanal.id, cd]);
                return interaction.editReply(createContainerMessage('Ayarlandı', `<:mono:${MONO_EMOJIS.check}> Tanıtım kanalı <#${kanal.id}> oldu (üye başına ${cd} saat).`, '#57F287', [], [], false, true));
            }
            const cfg = await db.pool.query('SELECT * FROM tanitim_config WHERE guild_id = ?', [interaction.guild.id]);
            if (cfg.length === 0) {
                return interaction.editReply(createContainerMessage('Bilgi', 'Tanıtım kanalı ayarlanmamış. Yetkililer `/tanıtım kanal` ile ayarlasın.', '#3498DB', [], [], false, true));
            }
            const cdMs = Number(cfg[0].cooldown_hours) * 3600000;
            const log = await db.pool.query('SELECT last_at FROM tanitim_log WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
            if (log[0] && Date.now() - Number(log[0].last_at) < cdMs) {
                const kalan = Math.ceil((cdMs - (Date.now() - Number(log[0].last_at))) / 3600000);
                return interaction.editReply(createContainerMessage('Bekle', `Tekrar tanıtım için **${kalan} saat** beklemelisin.`, '#FEE75C', [], [], false, true));
            }
            const kanal = interaction.guild.channels.cache.get(cfg[0].channel_id);
            if (!kanal || !kanal.isTextBased()) {
                return interaction.editReply(createContainerMessage('Hata', 'Tanıtım kanalı bulunamadı.', '#ED4245', [], [], false, true));
            }
            const mesaj = interaction.options.getString('mesaj');
            const payload = createContainerMessage(`${interaction.guild.name} — Tanıtım`, `**Sahibi:** <@${interaction.user.id}>\n**Üye:** ${interaction.guild.memberCount}\n\n${mesaj}`, '#5865F2');
            await kanal.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
            await db.pool.query('INSERT INTO tanitim_log (guild_id, user_id, last_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_at=VALUES(last_at)', [interaction.guild.id, interaction.user.id, Date.now()]);
            await interaction.editReply(createContainerMessage('Yayınlandı', `<:mono:${MONO_EMOJIS.check}> Tanıtımın <#${kanal.id}> kanalında yayınlandı!`, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[Tanıtım]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
