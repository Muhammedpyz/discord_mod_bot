const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { withGuard } = require('../../utils/interactionGuard');
const eco = require('../../utils/globalEco');

const FISH = [
    ['Hamsi', 15, 30, 50], ['İstavrit', 20, 40, 30], ['Levrek', 40, 70, 14],
    ['Çipura', 50, 85, 8], ['Palamut', 60, 100, 5], ['Orkinos', 90, 150, 2],
    ['Eski Bot', 2, 8, 12], ['Yosun', 1, 4, 20]
];

function catchFish() {
    const total = FISH.reduce((s, f) => s + f[3], 0);
    let r = Math.random() * total;
    for (const f of FISH) {
        r -= f[3];
        if (r <= 0) return f;
    }
    return FISH[0];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balık-tut')
        .setDescription('Balık tut, otomatik satılsın (10dk cooldown).'),

    async execute(interaction) {
        await withGuard(interaction, { cooldown: 10 * 60 * 1000, cooldownKey: 'eco_fish' }, async () => {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const [name, min, max] = catchFish();
            const deger = min + Math.floor(Math.random() * (max - min));
            await eco.addBalance(interaction.user.id, deger);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('fish_again').setLabel('Tekrar Dene').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            await interaction.editReply(createContainerMessage('Balık Tutma', `Olta sallandı... **${name}** yakaladın!\nSatıldı: **+${deger}** Jeton`, '#57F287', [row]));
            try { require('../../utils/achievements').trackBalance(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
        });
    }
};
