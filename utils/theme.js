/**
 * Ortak Tema + V2 Yardımcıları (0.6 Görsel Tutarlılık)
 * KURAL: embed ASLA kullanılmaz. Her mesaj Components V2 + Container + butonludur.
 * Her modül accent/renk için buradan çeker.
 */
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SectionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} = require('discord.js');

const COLORS = {
    brand: 0x5865F2,
    success: 0x57F287,
    error: 0xED4245,
    warning: 0xFEE75C,
    info: 0x3498DB,
    // Geriye dönük uyumluluk (büyük harf kullanan eski kodlar için)
    BRAND: 0x5865F2,
    SUCCESS: 0x57F287,
    ERROR: 0xED4245,
    WARNING: 0xFEE75C,
    INFO: 0x3498DB,
    LOG: 0x3498DB,
    PRIMARY: 0x2B2D31
};

const V2_FLAGS = MessageFlags.IsComponentsV2;
const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

/**
 * Tek tip V2 kart: başlık + gövde + buton satırları.
 * SÜREKLİ MESAJ ATMA — bu payload ile message.edit() yapın.
 */
function v2Card({ title, body = '', buttons = [], selects = [], footer = null }) {
    const container = new ContainerBuilder();
    if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
    if (body) {
        const chunks = String(body).split('---SEPARATOR---').map(s => s.trim()).filter(Boolean);
        chunks.forEach((c, i) => {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(c.slice(0, 3900)));
            if (i < chunks.length - 1) container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        });
    }
    const rows = [...buttons, ...selects].filter(Boolean);
    if (rows.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        for (const r of rows) container.addActionRowComponents(r);
    }
    if (footer) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    return { flags: V2_FLAGS, components: [container] };
}

function v2Ephemeral(payload) {
    return { ...payload, flags: V2_EPHEMERAL };
}

/** custom_id konvansiyonu: {modul}_{aksiyon}_{id} — 100 karakter sınırı için id kısa tutulur. */
function cid(modul, aksiyon, ...ids) {
    const raw = [modul, aksiyon, ...ids].join('_');
    return raw.slice(0, 100);
}

/** "1s30dk", "2saat15dk", "1gün2saat" gibi serbest süreleri ms'e çevirir. */
function parseFancyDuration(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
    // Tekil basit format: 10dk, 2s(=saat), 1g, 30sn
    const unitMap = { sn: 1000, sns: 1000, dk: 60000, dakika: 60000, s: 3600000, saat: 3600000, g: 86400000, gün: 86400000, gun: 86400000, h: 3600000, hafta: 604800000 };
    let total = 0;
    const re = /(\d+)(gün|gun|hafta|saat|dakika|sn|sns|dk|s|g|h)/gi;
    let m; let found = false;
    while ((m = re.exec(s)) !== null) {
        found = true;
        const val = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        total += (val * (unitMap[unit] || 0));
    }
    if (!found || total <= 0) return null;
    if (total > 1000 * 86400 * 365 * 2) return null; // 2 yıldan uzun süreleri reddet
    return total;
}

function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}sn`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}dk`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}sa ${m % 60}dk`;
    const d = Math.floor(h / 24);
    return `${d}g ${h % 24}sa`;
}

function progressBar(percent, len = 10) {
    const p = Math.max(0, Math.min(100, percent));
    const filled = Math.round((p / 100) * len);
    return '█'.repeat(filled) + '░'.repeat(len - filled);
}

module.exports = {
    COLORS, V2_FLAGS, V2_EPHEMERAL,
    v2Card, v2Ephemeral, cid,
    parseFancyDuration, fmtDuration, progressBar,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags
};
