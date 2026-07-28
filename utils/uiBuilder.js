const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder,
    MediaGalleryBuilder, MediaGalleryItemBuilder,
    ButtonBuilder, ButtonStyle,
    MessageFlags
} = require('discord.js');

const BRAND_URL = 'https://turklion.net';
const BRAND_FOOTER = 'turklion.net';
const DEFAULT_BANNER_URL = "https://cdn.discordapp.com/attachments/1529916823150133459/1530497564665708655/F75E13D7-AC38-4B77-B9AB-DEAFCA8990E4.jpg?ex=6a65ca6e&is=6a6478ee&hm=b71a066c1e619da7ff83e82a460262845c3f50bdba638193104b5cb267729c71&";

const MONO_EMOJIS = {
    twitch: "1531752985472925726",
    ticket: "1531753001629388820",
    tiktok: "1531752988106817576",
    spotify: "1531752988106817576", // fallback
    settings: "1531753003625742516",
    status: "1531753003625742516",
    shield: "1531753006708822076",
    arrow_left: "1531752489034973304",
    pin: "1531753003625742516",
    kofi: "1531752980578041897",
    delete: "1531752503237152858",
    unlock: "1531752498509910199",
    crown: "1531752493812547594",
    paypal: "1531752492269047992",
    reddit: "1531752490691854528",
    arrow_right: "1531752489034973304",
    lock: "1531752487067975963",
    kick: "1531753039592030248",
    mail: "1531752978392940564",
    invite: "1531752982167949412",
    instagram: "1531753011427282964",
    discord: "1531753009841836184",
    github: "1531754214534021160",
    cross: "1531752989663166625",
    check: "1531752991265263676",
    ban: "1531752993983037601",
    add: "1531752983568842842",
    youtube: "1531753008483012759",
    announcement: "1531753005127303249",
    warning: "1531752996768186428",
    x_twitter: "1531753000152862820",
    website: "1531752980578041897",
    web: "1531752980578041897"
};

const EMOJIS = {};
for (const [name, id] of Object.entries(MONO_EMOJIS)) {
    EMOJIS[name] = `<:${name}:${id}>`;
}

const COLORS = {
    PRIMARY: 0x2B2D31,
    BRAND: 0xC0392B
};

function resolveColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
        if (color.startsWith('#')) return parseInt(color.slice(1), 16);
        return COLORS.BRAND; // default to brand for any named color if we are keeping it minimal
    }
    return COLORS.PRIMARY;
}

// YENİ STRICT KURAL: MOD A (Bilgilendirme Panelleri - Banner + Sections)
function buildModAPanel({ title, description, bannerUrl = DEFAULT_BANNER_URL, actionRows = [], navRow = null, showSocials = true }) {
    const container = new ContainerBuilder().setAccentColor(COLORS.PRIMARY);

    if (title) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title.toUpperCase()}`));
    }
    
    if (navRow) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(navRow);
    }

    if (description) {
        const descLines = description.split('\n\n');
        for (const line of descLines) {
            if (line.trim()) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line.trim()));
            }
        }
    }

    if (actionRows.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        for (const row of actionRows) container.addActionRowComponents(row);
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (showSocials) {
        // Sabit Pattern B Linkleri (Sol text, Sağ buton + Mono SVG)
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# **Web sitemiz & sunucu bilgisi**"))
                .setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("turklion.net").setEmoji(MONO_EMOJIS.web).setURL(BRAND_URL)),
            
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# **Etkinlikler & ozel cekilisler**"))
                .setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Instagram").setEmoji(MONO_EMOJIS.instagram).setURL("https://instagram.com/turklion")),
            
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# **Tanitim & ozel videolar**"))
                .setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("YouTube").setEmoji(MONO_EMOJIS.youtube).setURL("https://youtube.com/@turklion"))
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${BRAND_FOOTER}`));
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

// YENİ STRICT KURAL: MOD B (İşlevsel/Operasyonel - Sadece Metin + Butonlar)
function buildModBResponse({ title, textLines = [], fields = [], actionRows = [], color = COLORS.PRIMARY, files = [] }) {
    const { FileBuilder } = require('discord.js');
    const container = new ContainerBuilder().setAccentColor(COLORS.PRIMARY);

    if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));

    let textCount = 0;
    
    for (const line of textLines) {
        if (textCount < 4 && line.trim()) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line.trim()));
            textCount++;
        }
    }

    if (fields && fields.length > 0 && textCount < 4) {
        for (const field of fields) {
            if (textCount < 4) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${field.name}:** ${field.value}`));
                textCount++;
            }
        }
    }

    if (actionRows && actionRows.length > 0) {
        container.addActionRowComponents(actionRows[0]); 
    }

    if (files && files.length > 0) {
        for (const file of files) {
            container.addFileComponents(new FileBuilder().setURL(`attachment://${file}`));
        }
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

// Geriye dönük uyumluluk için wrapper: Eski createContainerMessage'ı MOD A veya MOD B'ye yönlendirir.
function createContainerMessage(title, description, colorHex = '#2B2D31', customActionRows = [], fields = [], showBrand = false, ephemeral = false, files = []) {
    let payload;
    if (showBrand) {
        payload = buildModAPanel({ title, description, actionRows: customActionRows });
    } else {
        const textLines = description ? description.split('\n\n') : [];
        payload = buildModBResponse({ title, textLines, fields, actionRows: customActionRows, color: colorHex, files });
    }
    
    if (ephemeral) {
        payload.flags |= MessageFlags.Ephemeral;
    }
    return payload;
}

// Eski createV2Message'ı direkt sarmalayalım
function createV2Message({ title, description, color, fields, actionRows, showBrand = false }) {
    return createContainerMessage(title, description, color, actionRows, fields, showBrand);
}

module.exports = { 
    createV2Message, 
    createContainerMessage, 
    buildModAPanel, 
    buildModBResponse,
    COLORS, 
    resolveColor, 
    DEFAULT_BANNER_URL,
    MONO_EMOJIS,
    EMOJIS
};
