const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

function achEmoji(def) {
    const key = def && def.emoji;
    const id = key && MONO_EMOJIS[key];
    return id ? `<:mono:${id}>` : '';
}

async function unlock(guildId, userId, code) {
    try {
        const defs = await db.pool.query('SELECT * FROM achievement_definitions WHERE code = ?', [code]);
        if (defs.length === 0) return null;
        const has = await db.pool.query('SELECT 1 FROM user_achievements WHERE guild_id = ? AND user_id = ? AND achievement_code = ?', [guildId, userId, code]);
        if (has.length > 0) return null;
        await db.pool.query('INSERT INTO user_achievements (guild_id, user_id, achievement_code) VALUES (?, ?, ?)', [guildId, userId, code]);
        const def = defs[0];
        if (Number(def.reward_coins) > 0) {
            try { require('./globalEco').addBalance(userId, Number(def.reward_coins)).catch(() => {}); } catch {}
        }
        return def;
    } catch {
        return null;
    }
}

async function notifyUnlock(client, guildId, userId, def) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        const member = await guild.members.fetch(userId).catch(() => null);
        const target = member ? member.user : await client.users.fetch(userId).catch(() => null);
        if (!target) return;
        const payload = createContainerMessage(
            'Başarım Kazanıldı',
            `${achEmoji(def)} **${def.name}**\n${def.description}${Number(def.reward_coins) > 0 ? `\n\n**Ödül:** ${def.reward_coins} Jeton` : ''}`,
            '#FEE75C'
        );
        await target.send({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    } catch {}
}

let _client = null;
function initAchievements(client) { _client = client; }
function notify(def, guildId, userId) {
    if (_client) notifyUnlock(_client, guildId, userId, def).catch(() => {});
}

// --- Hook'lar (diğer modüllerden çağrılır, sessizce geçilir) ---
async function trackMessages(guildId, userId) {
    try {
        const row = await db.pool.query('SELECT messages FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        const count = Number(row[0]?.messages || 0);
        const checks = [[1, 'ilk_adim'], [100, 'muhabbetci'], [1000, 'fenomen']];
        for (const [need, code] of checks) {
            if (count >= need) {
                const def = await unlock(guildId, userId, code);
                if (def) notify(def, guildId, userId);
            }
        }
    } catch {}
}

async function trackBalance(guildId, userId) {
    try {
        const w = await require('./globalEco').getWallet(userId);
        const total = Number(w.balance || 0) + Number(w.bank_balance || 0);
        const checks = [[10000, 'birikimci'], [100000, 'zengin']];
        for (const [need, code] of checks) {
            if (total >= need) {
                const def = await unlock(guildId, userId, code);
                if (def) notify(def, guildId, userId);
            }
        }
    } catch {}
}

async function trackDailyStreak(guildId, userId, streak) {
    try {
        if (Number(streak) >= 7) {
            const def = await unlock(guildId, userId, 'sadakat');
            if (def) notify(def, guildId, userId);
        }
    } catch {}
}

async function trackPollVote(guildId, userId) {
    try {
        const row = await db.pool.query('SELECT COUNT(*) as c FROM poll_votes WHERE user_id = ? AND poll_id IN (SELECT id FROM polls WHERE guild_id = ?)', [userId, guildId]);
        const count = Number(row[0]?.c || 0);
        const checks = [[1, 'secmen'], [10, 'demokrat']];
        for (const [need, code] of checks) {
            if (count >= need) {
                const def = await unlock(guildId, userId, code);
                if (def) notify(def, guildId, userId);
            }
        }
    } catch {}
}

async function trackPollCreate(guildId, userId) {
    try {
        const def = await unlock(guildId, userId, 'secmen');
        if (def) { const c = clientRef(); if (c && c.guilds) notifyUnlock(c, guildId, userId, def).catch(() => {}); }
    } catch {}
}

async function trackRoleTake(guildId, userId, member) {
    try {
        const opts = await db.pool.query('SELECT o.role_id FROM reaction_role_options o JOIN reaction_role_panels p ON o.panel_id = p.id WHERE p.guild_id = ?', [guildId]);
        if (opts.length === 0 || !member) return;
        const panelRoleIds = new Set(opts.map(o => o.role_id));
        let count = 0;
        for (const rid of panelRoleIds) {
            if (member.roles.cache.has(rid)) count++;
        }
        if (count >= 5) {
            const def = await unlock(guildId, userId, 'rol_avcisi');
            if (def) notify(def, guildId, userId);
        }
    } catch {}
}

async function trackReminder(guildId, userId) {
    try {
        const row = await db.pool.query('SELECT COUNT(*) as c FROM reminders WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (Number(row[0]?.c || 0) >= 5) {
            const def = await unlock(guildId, userId, 'hatirlatici');
            if (def) notify(def, guildId, userId);
        }
    } catch {}
}

async function trackOyun(guildId, userId) {
    try {
        const def = await unlock(guildId, userId, 'oyuncu');
        if (def) notify(def, guildId, userId);
    } catch {}
}

async function trackDavet(guildId, userId) {
    try {
        const def = await unlock(guildId, userId, 'davetci');
        if (def) notify(def, guildId, userId);
    } catch {}
}

// --- /basarim kartı (sayfalı, TEK mesaj edit) ---
const PAGE_SIZE = 5;

async function renderAchievements(interaction, page) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const defs = await db.pool.query('SELECT * FROM achievement_definitions ORDER BY requirement_value ASC');
    const mine = await db.pool.query('SELECT achievement_code FROM user_achievements WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    const mineSet = new Set(mine.map(m => m.achievement_code));

    const totalPages = Math.max(1, Math.ceil(defs.length / PAGE_SIZE));
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = defs.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);

    let body = '';
    for (const d of slice) {
        const has = mineSet.has(d.code);
        body += `${achEmoji(d)} **${d.name}** ${has ? '(Kazanıldı)' : ''}\n-# ${d.description}${Number(d.reward_coins) > 0 ? ` • Ödül: ${d.reward_coins} Jeton` : ''}\n\n`;
    }
    body += `-# Sayfa ${p + 1}/${totalPages} • Toplam ${mineSet.size}/${defs.length} başarım`;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ach_page_${p - 1}`).setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(`ach_page_${p + 1}`).setLabel('İleri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_right).setDisabled(p >= totalPages - 1),
        new ButtonBuilder().setCustomId('ach_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
    );
    const payload = createContainerMessage('Başarımlarım', body.trim(), '#FEE75C', [row]);
    await interaction.editReply(payload).catch(() => {});
}

async function handleAchievementInteractions(interaction) {
    if (interaction.customId.startsWith('ach_page_')) {
        await interaction.deferUpdate().catch(() => {});
        const page = parseInt(interaction.customId.split('_')[2], 10) || 0;
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const defs = await db.pool.query('SELECT * FROM achievement_definitions ORDER BY requirement_value ASC');
        const mine = await db.pool.query('SELECT achievement_code FROM user_achievements WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        const mineSet = new Set(mine.map(m => m.achievement_code));
        const totalPages = Math.max(1, Math.ceil(defs.length / PAGE_SIZE));
        const p = Math.max(0, Math.min(page, totalPages - 1));
        const slice = defs.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
        let body = '';
        for (const d of slice) {
            const has = mineSet.has(d.code);
            const id = MONO_EMOJIS[d.emoji];
            body += `${id ? `<:mono:${id}>` : ''} **${d.name}** ${has ? '(Kazanıldı)' : ''}\n-# ${d.description}${Number(d.reward_coins) > 0 ? ` • Ödül: ${d.reward_coins} Jeton` : ''}\n\n`;
        }
        body += `-# Sayfa ${p + 1}/${totalPages} • Toplam ${mineSet.size}/${defs.length} başarım`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ach_page_${p - 1}`).setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_left).setDisabled(p === 0),
            new ButtonBuilder().setCustomId(`ach_page_${p + 1}`).setLabel('İleri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_right).setDisabled(p >= totalPages - 1),
            new ButtonBuilder().setCustomId('ach_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        await interaction.editReply(createContainerMessage('Başarımlarım', body.trim(), '#FEE75C', [row])).catch(() => {});
        return;
    }
    if (interaction.customId === 'ach_refresh') {
        await interaction.deferUpdate().catch(() => {});
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const defs = await db.pool.query('SELECT * FROM achievement_definitions ORDER BY requirement_value ASC');
        const mine = await db.pool.query('SELECT achievement_code FROM user_achievements WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        const mineSet = new Set(mine.map(m => m.achievement_code));
        const slice = defs.slice(0, PAGE_SIZE);
        let body = '';
        for (const d of slice) {
            const has = mineSet.has(d.code);
            const id = MONO_EMOJIS[d.emoji];
            body += `${id ? `<:mono:${id}>` : ''} **${d.name}** ${has ? '(Kazanıldı)' : ''}\n-# ${d.description}\n\n`;
        }
        body += `-# Toplam ${mineSet.size}/${defs.length} başarım`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ach_page_1').setLabel('İleri').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.arrow_right),
            new ButtonBuilder().setCustomId('ach_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
        );
        await interaction.editReply(createContainerMessage('Başarımlarım', body.trim(), '#FEE75C', [row])).catch(() => {});
    }
}

module.exports = {
    initAchievements,
    renderAchievements,
    handleAchievementInteractions,
    trackMessages,
    trackBalance,
    trackDailyStreak,
    trackPollVote,
    trackPollCreate,
    trackRoleTake,
    trackReminder,
    trackOyun,
    trackDavet
};
