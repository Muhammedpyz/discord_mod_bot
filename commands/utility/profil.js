const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kullanıcı profil kartını gösterir (seviye + ekonomi + rozet).')
        .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const target = interaction.options.getUser('kullanici') || interaction.user;
        try {
            const [lvl, ecoW, ach, rep, prof] = await Promise.all([
                db.pool.query('SELECT xp, level, messages FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, target.id]).catch(() => []),
                require('../../utils/globalEco').getWallet(target.id).catch(() => ({ balance: 0, bank_balance: 0 })),
                db.pool.query('SELECT COUNT(*) as c FROM user_achievements WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, target.id]).catch(() => [{ c: 0 }]),
                db.pool.query('SELECT COUNT(*) as c FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, target.id]).catch(() => [{ c: 0 }]),
                db.pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [target.id]).catch(() => [])
            ]);
            const seviye = lvl[0] ? `Sv.${lvl[0].level} (${Number(lvl[0].xp).toLocaleString('tr-TR')} XP, ${lvl[0].messages} mesaj)` : 'Kayıt yok';
            const para = `${(Number(ecoW.balance || 0) + Number(ecoW.bank_balance || 0)).toLocaleString('tr-TR')} Jeton (global)`;
            const p = prof[0];
            let es = 'Yalnız';
            if (p?.partner_id) {
                es = `<@${p.partner_id}>`;
            }
            const bio = p?.bio ? `\n\n**Hakkında:** ${String(p.bio).slice(0, 300)}` : '';
            const body = `**Seviye:** ${seviye}\n**Servet:** ${para}\n**Başarım:** ${Number(ach[0]?.c || 0)} adet\n**İtibar:** ${Number(rep[0]?.c || 0)} puan\n**Evlilik:** ${es}${bio}`;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`profil_yenile_${target.id}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            await interaction.editReply(createContainerMessage(`${target.username} — Profil`, body, '#5865F2', [row]));
        } catch (e) {
            console.error('[Profil]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Profil alınamadı.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
