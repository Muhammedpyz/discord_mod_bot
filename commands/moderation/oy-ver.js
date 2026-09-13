const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oy-ver')
        .setDescription('Bota oy ver, Jeton ödülü kazan (12 saatte bir).'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        try {
            const cfg = await db.pool.query('SELECT * FROM oy_config WHERE guild_id = ?', [interaction.guild.id]);
            const url = cfg[0]?.vote_url || 'https://top.gg/';
            const odul = Number(cfg[0]?.odul || 200);
            const rows = [];
            if (url) {
                try {
                    rows.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Oy Ver').setURL(url)
                    ));
                } catch {}
            }
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('oy_al').setLabel(`Ödülü Al (${odul} Jeton)`).setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.gift)
            ));
            await interaction.editReply(createContainerMessage('Oy Ver', `Butona basıp oy verdikten sonra **Ödülü Al** butonuna bas, **${odul}** Jeton hesabına geçsin!\n\n-# 12 saatte bir alınabilir.`, '#FEE75C', rows));
        } catch (e) {
            console.error('[OyVer]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
