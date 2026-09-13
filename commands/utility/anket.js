const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { withGuard } = require('../../utils/interactionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anket')
        .setDescription('Gelişmiş Anket Oluşturur (Canlı Sonuçlu)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await withGuard(interaction, { permission: PermissionFlagsBits.ManageMessages, cooldown: 5000, cooldownKey: 'poll_create' }, async () => {
            const modal = new ModalBuilder()
                .setCustomId('poll_create_modal')
                .setTitle('Yeni Anket Oluştur');

            const qInput = new TextInputBuilder()
                .setCustomId('poll_question')
                .setLabel('Anket Sorusu')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(255)
                .setRequired(true);

            const optionsInput = new TextInputBuilder()
                .setCustomId('poll_options')
                .setLabel('Seçenekler (Her satıra bir tane, max 10)')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(true);
                
            const durationInput = new TextInputBuilder()
                .setCustomId('poll_duration')
                .setLabel('Süre (Örn: 24s, 30dk)')
                .setPlaceholder('Boş bırakılırsa sınırsız olur')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(10)
                .setRequired(false);

            const multipleInput = new TextInputBuilder()
                .setCustomId('poll_multiple')
                .setLabel('Çoklu Seçim (evet/hayır)')
                .setPlaceholder('evet = kullanıcı birden fazla seçeneğe oy verebilir')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(5)
                .setRequired(false);

            const anonymousInput = new TextInputBuilder()
                .setCustomId('poll_anonymous')
                .setLabel('Anonim (evet/hayır)')
                .setPlaceholder('evet = kimin oy verdiği görünmez')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(5)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(qInput),
                new ActionRowBuilder().addComponents(optionsInput),
                new ActionRowBuilder().addComponents(durationInput),
                new ActionRowBuilder().addComponents(multipleInput),
                new ActionRowBuilder().addComponents(anonymousInput)
            );

            await interaction.showModal(modal);
        });
    }
};
