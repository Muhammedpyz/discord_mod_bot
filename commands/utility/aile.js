const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = [
    {
        data: new SlashCommandBuilder().setName('evlat-edin').setDescription('Bir üyeyi evlat edinirsin (onaylı).')
            .addUserOption(o => o.setName('uye').setDescription('Evlat').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getUser('uye');
            if (uye.id === interaction.user.id || uye.bot) {
                return interaction.editReply(createContainerMessage('Hata', 'Kendini veya botu evlat edinemezsin.', '#ED4245', [], [], false, true));
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`aile_kabul_${interaction.user.id}_${uye.id}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check),
                new ButtonBuilder().setCustomId(`aile_red_${interaction.user.id}_${uye.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross)
            );
            const teklif = createContainerMessage('Evlat Edinme', `<@${interaction.user.id}> seni evlat edinmek istiyor <@${uye.id}>!\n\nKarar senin:`, '#FEE75C', [row]);
            await interaction.channel.send({ ...teklif, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            await interaction.editReply(createContainerMessage('Gönderildi', 'Teklif kanala iletildi.', '#57F287', [], [], false, true));
        }
    },
    {
        data: new SlashCommandBuilder().setName('ailem').setDescription('Aile ağacını gösterir.')
            .addUserOption(o => o.setName('uye').setDescription('Kimin ailesi?').setRequired(false)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getUser('uye') || interaction.user;
            const rows = await db.pool.query('SELECT * FROM aile WHERE user_id = ?', [uye.id]);
            const kids = await db.pool.query('SELECT user_id FROM aile WHERE parent_id = ?', [uye.id]);
            const a = rows[0] || {};
            const prof = await db.pool.query('SELECT partner_id FROM user_profiles WHERE user_id = ?', [uye.id]).catch(() => []);
            const es = a.partner_id || prof[0]?.partner_id;
            let body = `**Eş:** ${es ? `<@${es}>` : 'Yok'}\n**Ebeveyn:** ${a.parent_id ? `<@${a.parent_id}>` : 'Yok'}\n**Çocuklar:** ${kids.length > 0 ? kids.map(k => `<@${k.user_id}>`).join(', ') : 'Yok'}`;
            await interaction.editReply(createContainerMessage(`${uye.username} — Aile`, body, '#5865F2'));
        }
    },
    {
        data: new SlashCommandBuilder().setName('evlatlıktan-red').setDescription('Evladını reddedersin (onaylı).')
            .addUserOption(o => o.setName('uye').setDescription('Evlat').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const uye = interaction.options.getUser('uye');
            const res = await db.pool.query('UPDATE aile SET parent_id = NULL WHERE user_id = ? AND parent_id = ?', [uye.id, interaction.user.id]);
            if (res.affectedRows > 0) {
                await interaction.editReply(createContainerMessage('Tamam', `<@${uye.id}> evlatlıktan reddedildi.`, '#FEE75C', [], [], false, true));
            } else {
                await interaction.editReply(createContainerMessage('Bilgi', 'Bu üye senin evladın değil.', '#3498DB', [], [], false, true));
            }
        }
    }
];
