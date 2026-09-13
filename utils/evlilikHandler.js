const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

async function handleEvlenInteractions(interaction) {
    const { customId } = interaction;

    // Aile: evlat edinme cevabı
    if (customId.startsWith('aile_kabul_') || customId.startsWith('aile_red_')) {
        await interaction.deferUpdate().catch(() => {});
        const kabul = customId.startsWith('aile_kabul_');
        const parts = customId.split('_');
        const ebeveyn = parts[2];
        const hedef = parts[3];
        if (interaction.user.id !== hedef) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu teklife sadece ilgili kişi cevap verebilir.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        if (!kabul) {
            await interaction.editReply({ ...createContainerMessage('Reddedildi', 'Teklif reddedildi.', '#ED4245'), components: [] }).catch(() => {});
            return;
        }
        await db.pool.query('INSERT INTO aile (user_id, parent_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE parent_id=VALUES(parent_id)', [hedef, ebeveyn]);
        await interaction.editReply({ ...createContainerMessage('Aile', `<:mono:${MONO_EMOJIS.heart}> <@${hedef}> artık <@${ebeveyn}> üyesinin evladı!`, '#57F287'), components: [] }).catch(() => {});
        return;
    }

    // Evlilik teklifi cevabı: evlen_kabul_{eden}_{hedef} / evlen_red_{eden}_{hedef}
    if (customId.startsWith('evlen_kabul_') || customId.startsWith('evlen_red_')) {
        await interaction.deferUpdate().catch(() => {});
        const kabul = customId.startsWith('evlen_kabul_');
        const parts = customId.split('_');
        const edenId = parts[2];
        const hedefId = parts[3];
        if (interaction.user.id !== hedefId) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu teklife sadece evlilik teklif edilen kişi cevap verebilir.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        try {
            if (!kabul) {
                await interaction.editReply({ ...createContainerMessage('Reddedildi', `<@${interaction.user.id}> teklifi reddetti.`, '#ED4245'), components: [] }).catch(() => {});
                return;
            }
            // İkisi de boşta mı?
            const [a, b] = await Promise.all([
                db.pool.query('SELECT partner_id FROM user_profiles WHERE user_id = ?', [edenId]),
                db.pool.query('SELECT partner_id FROM user_profiles WHERE user_id = ?', [interaction.user.id])
            ]);
            if ((a[0]?.partner_id) || (b[0]?.partner_id)) {
                await interaction.editReply({ ...createContainerMessage('Olmaz', 'Taraflardan biri zaten evli!', '#ED4245'), components: [] }).catch(() => {});
                return;
            }
            await db.setMarriage(edenId, interaction.user.id);
            await interaction.editReply({ ...createContainerMessage('Evlilik', `<:mono:${MONO_EMOJIS.heart}> <@${edenId}> ve <@${interaction.user.id}> evlendi! Mutluluklar!`, '#57F287'), components: [] }).catch(() => {});
        } catch (e) {
            console.error('[Evlen]:', e.message);
        }
        return;
    }

    // Boşanma onayı
    if (customId === 'bosan_onay') {
        await interaction.deferUpdate().catch(() => {});
        try {
            const ok = await db.removeMarriage(interaction.user.id);
            if (ok) {
                await interaction.editReply({ ...createContainerMessage('Boşanma', 'Evlilik sona erdirildi.', '#FEE75C'), components: [] }).catch(() => {});
            } else {
                await interaction.editReply({ ...createContainerMessage('Bilgi', 'Evli değilsin.', '#3498DB'), components: [] }).catch(() => {});
            }
        } catch (e) {
            console.error('[Boşan]:', e.message);
        }
        return;
    }

    if (customId === 'bosan_iptal') {
        await interaction.deferUpdate().catch(() => {});
        await interaction.editReply({ ...createContainerMessage('İptal', 'Boşanmaktan vazgeçtin, evlilik devam ediyor.', '#57F287'), components: [] }).catch(() => {});
        return;
    }

    // Profil yenile
    if (customId.startsWith('profil_yenile_')) {
        await interaction.deferUpdate().catch(() => {});
        const targetId = customId.split('_')[2];
        try {
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const name = member ? member.user.username : 'Kullanıcı';
            const [lvl, ecoW, ach, rep, prof] = await Promise.all([
                db.pool.query('SELECT xp, level, messages FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]).catch(() => []),
                require('./globalEco').getWallet(targetId).catch(() => ({ balance: 0, bank_balance: 0 })),
                db.pool.query('SELECT COUNT(*) as c FROM user_achievements WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]).catch(() => [{ c: 0 }]),
                db.pool.query('SELECT COUNT(*) as c FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetId]).catch(() => [{ c: 0 }]),
                db.pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [targetId]).catch(() => [])
            ]);
            const seviye = lvl[0] ? `Sv.${lvl[0].level} (${Number(lvl[0].xp).toLocaleString('tr-TR')} XP)` : 'Kayıt yok';
            const para = `${(Number(ecoW.balance || 0) + Number(ecoW.bank_balance || 0)).toLocaleString('tr-TR')} Jeton (global)`;
            const p = prof[0];
            const body = `**Seviye:** ${seviye}\n**Servet:** ${para}\n**Başarım:** ${Number(ach[0]?.c || 0)} adet\n**İtibar:** ${Number(rep[0]?.c || 0)} puan\n**Evlilik:** ${p?.partner_id ? `<@${p.partner_id}>` : 'Yalnız'}${p?.bio ? `\n\n**Hakkında:** ${String(p.bio).slice(0, 300)}` : ''}`;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`profil_yenile_${targetId}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            await interaction.editReply(createContainerMessage(`${name} — Profil`, body, '#5865F2', [row])).catch(() => {});
        } catch (e) {
            console.error('[ProfilYenile]:', e.message);
        }
    }
}

module.exports = { handleEvlenInteractions };
