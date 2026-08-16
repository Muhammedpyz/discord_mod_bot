const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Botun ses kanalında 7/24 kesintisiz kalma modunu açar veya kapatır.')
        .addStringOption(opt => 
            opt.setName('durum')
                .setDescription('7/24 Modu Durumu')
                .setRequired(true)
                .addChoices(
                    { name: 'Aktif (7/24 Kanalda Kal)', value: 'on' },
                    { name: 'Deaktif (Sıra Bitince Çık)', value: 'off' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client) {
        await interaction.deferReply();
        const mode = interaction.options.getString('durum') === 'on';
        const guildId = interaction.guildId;

        await db.updateMusicConfig(guildId, { is_247_enabled: mode ? 1 : 0 });

        const payload = createContainerMessage(
            `<:mono:${MONO_EMOJIS.clock || '1530917536806469783'}> 7/24 Radyo Modu Güncellendi`,
            `7/24 Ses Modu: **${mode ? 'AKTİF (Bot ses kanalından hiç çıkmayacak)' : 'DEAKTİF (Sıra bitince otomatik ayrılacak)'}**`,
            mode ? '#57F287' : '#FEE75C'
        );
        return await interaction.editReply(payload);
    }
};
