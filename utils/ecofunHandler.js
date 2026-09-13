const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const eco = require('./globalEco');

// Kısa ömürlü blackjack masaları + crash oyunları
const tables = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, t] of tables.entries()) {
        if (t.timer) continue; // crash timer kendisi temizler
        if (now - t.t > 10 * 60 * 1000) tables.delete(k);
    }
}, 5 * 60 * 1000);

function gid() {
    return Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
}

const SLOT_KEYS = ['star', 'gem', 'coins', 'crown', 'bell'];
function slotSym(k) {
    return `<:mono:${MONO_EMOJIS[k]}>`;
}

function bjValue(hand) {
    let total = 0; let aces = 0;
    for (const c of hand) {
        if (c === 'A') { total += 11; aces++; }
        else if (['J', 'Q', 'K'].includes(c)) total += 10;
        else total += parseInt(c, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function drawCard() {
    const faces = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    return faces[Math.floor(Math.random() * faces.length)];
}

function bjRows(id) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bj_hit_${id}`).setLabel('Kart Al').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.plus),
        new ButtonBuilder().setCustomId(`bj_stand_${id}`).setLabel('Dur').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.check)
    )];
}

function bjText(t) {
    return `Elin: **${t.player.join(' • ')}** (${bjValue(t.player)})\nKrupiye: **${t.dealer[0]} • ?**\n\n-# Bahis: ${t.bet} Jeton`;
}

async function handleEcoFunInteractions(interaction) {
    const { customId } = interaction;

    // ===== Crash çekilme =====
    if (customId.startsWith('crash_out_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const g = tables.get('crash' + id);
        if (!g || g.over) return;
        if (interaction.user.id !== g.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu oyun senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        g.over = true;
        clearInterval(g.timer);
        tables.delete('crash' + id);
        const win = Math.floor(g.bet * g.mult);
        await eco.addBalance(interaction.user.id, win);
        const payload = createContainerMessage('Crash', `**${g.mult.toFixed(2)}x** noktasında çekildin!\nBahis: ${g.bet} → Kazanç: **+${win}** Jeton`, '#57F287', []);
        await interaction.editReply(payload).catch(() => {});
        return;
    }

    // ===== Balık tekrar =====
    if (customId === 'fish_again') {
        const { withGuard } = require('./interactionGuard');
        await withGuard(interaction, { cooldown: 10 * 60 * 1000, cooldownKey: 'eco_fish' }, async () => {
            await interaction.deferUpdate().catch(() => {});
            const FISH = [['Hamsi', 15, 30], ['İstavrit', 20, 40], ['Levrek', 40, 70], ['Çipura', 50, 85], ['Palamut', 60, 100], ['Orkinos', 90, 150], ['Eski Bot', 2, 8]];
            const f = FISH[Math.floor(Math.random() * FISH.length)];
            const deger = f[1] + Math.floor(Math.random() * (f[2] - f[1]));
            await eco.addBalance(interaction.user.id, deger);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('fish_again').setLabel('Tekrar Dene').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            await interaction.editReply(createContainerMessage('Balık Tutma', `Olta sallandı... **${f[0]}** yakaladın!\nSatıldı: **+${deger}** Jeton`, '#57F287', [row])).catch(() => {});
        });
        return;
    }

    // ===== Slots tekrar =====
    if (customId.startsWith('slot_go_')) {
        await interaction.deferUpdate().catch(() => {});
        const bet = Math.max(10, Math.min(10000, parseInt(customId.split('_')[2], 10) || 50));
        const paid = await eco.takeBalance(interaction.user.id, bet);
        if (!paid) {
            return interaction.followUp(createContainerMessage('Yetersiz Bakiye', `Bahis için ${bet} Jeton lazım.`, '#FEE75C', [], [], false, true)).catch(() => {});
        }

        const r = [SLOT_KEYS[Math.floor(Math.random() * SLOT_KEYS.length)], SLOT_KEYS[Math.floor(Math.random() * SLOT_KEYS.length)], SLOT_KEYS[Math.floor(Math.random() * SLOT_KEYS.length)]];
        let mult = 0; let note = 'Kaybettin.';
        if (r[0] === r[1] && r[1] === r[2]) { mult = 3; note = 'JACKPOT! 3x kazandın!'; }
        else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { mult = 1.2; note = 'İkili! Paranın bir kısmı döndü.'; }
        let win = 0;
        if (mult > 0) {
            win = Math.floor(bet * mult);
            await eco.addBalance(interaction.user.id, win);
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`slot_go_${bet}`).setLabel(`Tekrar Çevir (${bet})`).setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.refresh)
        );
        const payload = createContainerMessage('Slots', `${slotSym(r[0])} ${slotSym(r[1])} ${slotSym(r[2])}\n\n${note}${win > 0 ? ` **+${win}** Jeton` : ` **-${bet}** Jeton`}`, mult >= 3 ? '#57F287' : mult > 0 ? '#FEE75C' : '#ED4245', [row]);
        await interaction.editReply(payload).catch(() => {});
        return;
    }

    // ===== Blackjack =====
    if (customId.startsWith('bj_hit_') || customId.startsWith('bj_stand_')) {
        await interaction.deferUpdate().catch(() => {});
        const id = customId.split('_')[2];
        const t = tables.get('bj' + id);
        if (!t) return;
        if (interaction.user.id !== t.user) {
            return interaction.followUp(createContainerMessage('Bilgi', 'Bu masa senin değil.', '#FEE75C', [], [], false, true)).catch(() => {});
        }
        if (customId.startsWith('bj_hit_')) {
            t.player.push(drawCard());
            const v = bjValue(t.player);
            if (v > 21) {
                tables.delete('bj' + id);
                const payload = createContainerMessage('Blackjack', `Elin: **${t.player.join(' • ')}** (${v})\nKrupiye: **${t.dealer.join(' • ')}** (${bjValue(t.dealer)})\n\nBattın! **-${t.bet}** Jeton`, '#ED4245', []);
                await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                return;
            }
            if (v !== 21) {
                await interaction.message.edit({ ...createContainerMessage('Blackjack', bjText(t), '#5865F2', bjRows(id)), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                return;
            }
        }
        while (bjValue(t.dealer) < 17) t.dealer.push(drawCard());
        const pv = bjValue(t.player); const dv = bjValue(t.dealer);
        tables.delete('bj' + id);
        let msg; let color = '#5865F2'; let mult = 0;
        if (dv > 21) { mult = 2; msg = `Krupiye battı! Kazandın.`; color = '#57F287'; }
        else if (pv > dv) { mult = 2; msg = `Kazandın! (${pv} vs ${dv})`; color = '#57F287'; }
        else if (pv === dv) { mult = 1; msg = `Berabere, bahis iade. (${pv} vs ${dv})`; color = '#FEE75C'; }
        else { mult = 0; msg = `Kaybettin. (${pv} vs ${dv})`; color = '#ED4245'; }
        let win = 0;
        if (mult > 0) {
            win = Math.floor(t.bet * mult);
            await eco.addBalance(interaction.user.id, win);
        }
        const payload = createContainerMessage('Blackjack', `Elin: **${t.player.join(' • ')}** (${pv})\nKrupiye: **${t.dealer.join(' • ')}** (${dv})\n\n${msg}${win > 0 ? ` **+${win}** Jeton` : mult === 0 ? ` **-${t.bet}** Jeton` : ''}`, color, []);
        await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
}

module.exports = { handleEcoFunInteractions, tables, gid, slotSym, bjRows, bjText, bjValue, drawCard };
