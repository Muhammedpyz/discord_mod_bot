const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { updateSayac } = require('../../utils/kayitHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sayaç')
        .setDescription('Üye sayaç kanalı ayarlar/kapatır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('ayarla')
            .setDescription('Sayaç kanalını ayarlar.')
            .addChannelOption(o => o.setName('kanal').setDescription('Ses kanalı').setRequired(true))
            .addIntegerOption(o => o.setName('hedef').setDescription('Üye hedefi').setRequired(true).setMinValue(10))
            .addStringOption(o => o.setName('sablon').setDescription('İsim şablonu ({sayi}, {hedef})').setRequired(false)))
        .addSubcommand(s => s.setName('kapat').setDescription('Sayacı kapatır.')),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'ayarla') {
                const kanal = interaction.options.getChannel('kanal');
                const hedef = interaction.options.getInteger('hedef');
                const sablon = interaction.options.getString('sablon') || 'Uye: {sayi}/{hedef}';
                await db.pool.query('INSERT INTO sayac_config (guild_id, channel_id, hedef, sablon) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), hedef=VALUES(hedef), sablon=VALUES(sablon)', [interaction.guild.id, kanal.id, hedef, sablon]);
                await updateSayac(interaction.guild);
                await interaction.editReply(createContainerMessage('Sayaç Açık', `<:mono:${MONO_EMOJIS.check}> Sayaç <#${kanal.id}> kanalına kuruldu. Üye girip çıktıkça isim güncellenir.`, '#57F287', [], [], false, true));
            } else {
                await db.pool.query('DELETE FROM sayac_config WHERE guild_id = ?', [interaction.guild.id]);
                await interaction.editReply(createContainerMessage('Kapatıldı', 'Sayaç kapatıldı.', '#FEE75C', [], [], false, true));
            }
        } catch (e) {
            console.error('[Sayaç]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
