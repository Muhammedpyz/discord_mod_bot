const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { renderAchievements } = require('../../utils/achievements');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('basarim')
        .setDescription('Başarımlarını görüntülersin (sayfalı kart).'),

    async execute(interaction) {
        await renderAchievements(interaction, 0);
    }
};
