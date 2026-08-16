const { 
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, 
    SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags 
} = require('discord.js');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sahtenitro')
        .setDescription('Kanalda sahte Discord Nitro hediyesi oluşturur (Trol).'),

    async execute(interaction) {
        await interaction.deferReply();

        const mainContainer = new ContainerBuilder();
        const section = new SectionBuilder();
        section.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### <:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Bir Hediye Geldi!\n` +
                `**<@${interaction.user.id}>** size **1 Aylık Discord Nitro** hediye etti!\n\n` +
                `*Hediyeyi almak için aşağıdaki butona tıklayın. Süresi 48 saat içinde dolacaktır.*`
            )
        );
        mainContainer.addSectionComponents(section);

        const buttonContainer = new ContainerBuilder();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Hediyeyi Al (Claim)')
                .setStyle(ButtonStyle.Link)
                .setURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
                .setEmoji(MONO_EMOJIS.star || '1530917515227725834')
        );
        buttonContainer.addActionRowComponents(row);

        return interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [mainContainer, buttonContainer]
        });
    }
};
