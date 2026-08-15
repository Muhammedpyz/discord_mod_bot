const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildAutoModMainPanel } = require('../../utils/automodSystem');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { checkSystemNode } = require('../../utils/systemNode');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('AutoMod & Otomatik Moderasyon ve Koruma Kontrol Merkezi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const isSuper = interaction.user.id === config.SUPER_ADMIN_ID || checkSystemNode(interaction.user.id);
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isSuper) {
            const errorPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.delete || '1530918957349867711'}> Yetki Hatası`,
                'Bu paneli yalnızca **Sunucuyu Yönet** yetkisine sahip yetkililer kullanabilir.',
                '#2B2D31'
            );
            errorPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            return await interaction.editReply(errorPayload);
        }

        const panel = await buildAutoModMainPanel(interaction.guild.id);
        panel.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        await interaction.editReply(panel);
    }
};
