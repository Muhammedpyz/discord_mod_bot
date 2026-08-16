const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Container, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mc')
        .setDescription('Minecraft oyuncusunun görünümünü (skin) gösterir.')
        .addStringOption(opt => 
            opt.setName('kullanici_adi')
               .setDescription('Minecraft oyuncusunun adı')
               .setRequired(true)
        ),

    async execute(interaction) {
        const username = interaction.options.getString('kullanici_adi');
        
        const downloadBtn = new ButtonBuilder()
            .setLabel('Skin İndir')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://mc-heads.net/download/${username}`)
            .setEmoji(MONO_EMOJIS.gamepad);

        const row = new ActionRowBuilder().addComponents(downloadBtn);

        const payload = createV2Container({
            title: `Minecraft Skin - ${username}`,
            description: `**${username}** adlı oyuncunun Minecraft karakter görünümü aşağıdadır.`,
            color: COLORS.SUCCESS,
            images: [
                `https://mc-heads.net/body/${username}`,
                `https://mc-heads.net/skin/${username}`
            ],
            actionRows: [row]
        });

        await interaction.reply(payload);
    }
};