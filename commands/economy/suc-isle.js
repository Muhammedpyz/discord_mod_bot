const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { withGuard } = require('../../utils/interactionGuard');
const eco = require('../../utils/globalEco');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suç-işle')
        .setDescription('Bir üyeyi soymayı denersin. Riskli! (30dk cooldown).')
        .addUserOption(o => o.setName('hedef').setDescription('Soyulacak üye').setRequired(true)),

    async execute(interaction) {
        await withGuard(interaction, { cooldown: 30 * 60 * 1000, cooldownKey: 'eco_crime' }, async () => {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const hedef = interaction.options.getUser('hedef');
            if (hedef.id === interaction.user.id || hedef.bot) {
                return interaction.editReply(createContainerMessage('Hata', 'Kendini veya botları soyamazsın.', '#ED4245', [], [], false, true));
            }
            const [ben, o] = await Promise.all([eco.getWallet(interaction.user.id), eco.getWallet(hedef.id)]);
            const theirs = Number(o.balance || 0);

            if (Math.random() < 0.35 && theirs >= 50) {
                const calinan = Math.min(theirs, 40 + Math.floor(Math.random() * Math.max(40, theirs * 0.12)));
                const ok = await eco.takeBalance(hedef.id, calinan);
                if (ok) await eco.addBalance(interaction.user.id, calinan);
                await interaction.editReply(createContainerMessage('Soygun Başarılı', `<:mono:${MONO_EMOJIS.check}> <@${hedef.id}> üyesinden **${calinan}** Jeton çaldın! Kimseye söyleme.`, '#57F287'));
            } else {
                const mine = Number(ben.balance || 0);
                const ceza = Math.min(mine, 60 + Math.floor(Math.random() * 90));
                if (ceza > 0) {
                    await eco.takeBalance(interaction.user.id, ceza);
                    await eco.addBalance(hedef.id, ceza);
                }
                await interaction.editReply(createContainerMessage('Yakalandın', `<:mono:${MONO_EMOJIS.cross}> Polise yakalandın! <@${hedef.id}> üyesine **${ceza}** Jeton tazminat ödedin.`, '#ED4245'));
            }
        });
    }
};
