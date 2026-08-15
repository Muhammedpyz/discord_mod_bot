const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getGuildPrefixes, renderPrefixPanel } = require('../../utils/prefixSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Sunucuya özel çoklu prefix (ön ek) yönetim paneli.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (e) {
            return;
        }

        try {
            const prefixes = await getGuildPrefixes(interaction.guild.id);
            const payload = renderPrefixPanel(interaction.guild, prefixes);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('Prefix command error:', error);
            await interaction.editReply({ content: 'Prefix paneli açılırken bir hata oluştu.' }).catch(() => {});
        }
    }
};
