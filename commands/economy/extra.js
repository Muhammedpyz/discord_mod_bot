const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { withGuard } = require('../../utils/interactionGuard');
const eco = require('../../utils/globalEco');

const DILEN = [
    ['Sokakta şarkı söyledin', 5, 30], ['Cam sildin', 8, 28], ['Yaşlıya yardım ettin', 10, 45],
    ['Kimse para vermedi', 0, 3], ['Cömert biri çıktı', 25, 70], ['Yerde para buldun', 3, 20]
];

module.exports = [
    {
        data: new SlashCommandBuilder().setName('dilen').setDescription('Sokakta dilenirsin (5dk cooldown).'),
        async execute(interaction) {
            await withGuard(interaction, { cooldown: 5 * 60 * 1000, cooldownKey: 'eco_beg' }, async () => {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                const [olay, min, max] = DILEN[Math.floor(Math.random() * DILEN.length)];
                const k = min + Math.floor(Math.random() * (max - min + 1));
                if (k > 0) await eco.addBalance(interaction.user.id, k);
                await interaction.editReply(createContainerMessage('Dilenme', `${olay}: **${k > 0 ? `+${k}` : '0'}** Jeton`, k > 0 ? '#57F287' : '#FEE75C'));
            });
        }
    },
    {
        data: new SlashCommandBuilder().setName('saatlik').setDescription('Saatlik ödülünü alırsın.'),
        async execute(interaction) {
            await withGuard(interaction, { cooldown: 60 * 60 * 1000, cooldownKey: 'eco_hourly' }, async () => {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                const k = 15 + Math.floor(Math.random() * 26);
                await eco.addBalance(interaction.user.id, k);
                await interaction.editReply(createContainerMessage('Saatlik Ödül', `<:mono:${MONO_EMOJIS.check}> **${k}** Jeton kazandın! 1 saat sonra tekrar gel.`, '#57F287'));
            });
        }
    },
    {
        data: new SlashCommandBuilder().setName('hediye').setDescription('Sürpriz hediye açarsın (6 saat cooldown).'),
        async execute(interaction) {
            await withGuard(interaction, { cooldown: 6 * 60 * 60 * 1000, cooldownKey: 'eco_gift' }, async () => {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                const r = Math.random();
                let k, not;
                if (r < 0.65) { k = 20 + Math.floor(Math.random() * 50); not = 'Küçük kutu'; }
                else if (r < 0.93) { k = 70 + Math.floor(Math.random() * 100); not = 'Büyük kutu'; }
                else { k = 200 + Math.floor(Math.random() * 200); not = 'EFSANEVİ kutu'; }
                await eco.addBalance(interaction.user.id, k);
                await interaction.editReply(createContainerMessage('Sürpriz Hediye', `<:mono:${MONO_EMOJIS.gift}> **${not}** açıldı: **+${k}** Jeton!`, '#FEE75C'));
            });
        }
    },
    {
        data: new SlashCommandBuilder().setName('para-ver').setDescription('Üyeye para verirsin (yönetici).')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
            .addIntegerOption(o => o.setName('miktar').setDescription('Miktar').setRequired(true).setMinValue(1)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getUser('uye');
            const m = interaction.options.getInteger('miktar');
            await eco.addBalance(uye.id, m);
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> üyesine **${m}** Jeton verildi (global).`, '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder().setName('para-al').setDescription('Üyeden para alırsın (yönetici).')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
            .addIntegerOption(o => o.setName('miktar').setDescription('Miktar').setRequired(true).setMinValue(1)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getUser('uye');
            const m = interaction.options.getInteger('miktar');
            await eco.takeBalance(uye.id, m);
            await interaction.editReply(createContainerMessage('Tamam', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> üyesinden **${m}** Jeton alındı.`, '#57F287', [], [], false, true));
        }
    }
];
