const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oy-ayarla')
        .setDescription('Oy verme linki ve ödülünü ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('link').setDescription('top.gg oy linki').setRequired(true))
        .addIntegerOption(o => o.setName('odul').setDescription('Jeton ödülü').setRequired(false).setMinValue(10).setMaxValue(5000)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const link = interaction.options.getString('link');
        const odul = interaction.options.getInteger('odul') || 200;
        if (!/^https?:\/\//i.test(link)) {
            return interaction.editReply(createContainerMessage('Hata', 'Geçerli bir link gir (https:// ile başlamalı).', '#ED4245', [], [], false, true));
        }
        await db.pool.query('INSERT INTO oy_config (guild_id, vote_url, odul) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote_url=VALUES(vote_url), odul=VALUES(odul)', [interaction.guild.id, link, odul]);
        await interaction.editReply(createContainerMessage('Ayarlandı', `<:mono:${MONO_EMOJIS.check}> Oy linki ve **${odul}** Jeton ödül kaydedildi.`, '#57F287', [], [], false, true));
    }
};
