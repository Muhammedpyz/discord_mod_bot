const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildLevelPanel } = require('../../utils/levelManager');
const { createContainerMessage, COLORS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Seviye ve XP sistemi yönetim paneli')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const errPayload = createContainerMessage(
                'Yetki Yetersiz',
                'Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.',
                COLORS.ERROR || '#ED4245'
            );
            return await interaction.editReply(errPayload);
        }

        const payload = await buildLevelPanel(interaction.guildId);
        await interaction.editReply(payload);
    }
};
