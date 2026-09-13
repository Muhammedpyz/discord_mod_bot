const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { withGuard } = require('../../utils/interactionGuard');
const eco = require('../../utils/globalEco');

const JOBS = [
    ['Kuryelik yaptın', 40, 70], ['Garsonluk yaptın', 45, 80], ['Taksicilik yaptın', 50, 95],
    ['Bahçıvanlık yaptın', 35, 65], ['Köpek gezdirdin', 40, 70], ['Evcil hayvan baktın', 40, 75],
    ['Kütüphanede çalıştın', 50, 90], ['Streamer oldun', 55, 100], ['Fotoğraf çektin', 45, 80],
    ['Tamir işi yaptın', 55, 100]
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('çalış')
        .setDescription('Çalışıp Jeton kazanırsın (30dk cooldown).'),

    async execute(interaction) {
        await withGuard(interaction, { cooldown: 30 * 60 * 1000, cooldownKey: 'eco_work' }, async () => {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const [job, min, max] = JOBS[Math.floor(Math.random() * JOBS.length)];
            const kazanc = min + Math.floor(Math.random() * (max - min));
            await eco.addBalance(interaction.user.id, kazanc);
            await interaction.editReply(createContainerMessage('Çalışma', `<:mono:${MONO_EMOJIS.check}> ${job} ve **${kazanc}** Jeton kazandın!\n\n-# 30 dakika sonra tekrar çalışabilirsin.`, '#57F287'));
        });
    }
};
