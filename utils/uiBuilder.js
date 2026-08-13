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
    kickgg: "1532084300663750817",
    twitch: "1530917519463022632",
    ticket: "1530917517227331584",
    tiktok: "1530917515650273452",
    spotify: "1530917513851048119",
    settings: "1530917511711948903",
    status: "1530917510189285528",
    shield: "1530917506867400775",
    arrow_left: "1530918962890670161",
    pin: "1530918960764027000",
    kofi: "1530918958926921849",
    delete: "1530918957349867711",
    unlock: "1530918955726667867",
    crown: "1530918952711094272",
    paypal: "1530918950383124641",
    reddit: "1530918946843267123",
    arrow_right: "1530918943424778350",
    lock: "1530918940065267712",
    kick: "1530918797437833356",
    mail: "1530917545434021958",
    invite: "1530917543491932196",
    instagram: "1530917541839503371",
    discord: "1530917539859660952",
    github: "1530917538672672799",
    cross: "1530917536806469783",
    check: "1530917534885478600",
    ban: "1530917533081927780",
    add: "1530917531450343474",
    youtube: "1530917528929439835",
    announcement: "1530917526391750676",
    warning: "1530917524609175562",
    x_twitter: "1530917523061473320",
    website: "1530917521174302840",
    web: "1530917521174302840"
};

const EMOJIS = {};
for (const [name, id] of Object.entries(MONO_EMOJIS)) {
    EMOJIS[name] = `<:${name}:${id}>`;
}

const COLORS = {
    PRIMARY: 0x2B2D31,
    BRAND: 0x5865F2,
    SUCCESS: 0x57F287,
    ERROR: 0xED4245,
    WARNING: 0xFEE75C,
    LOG: 0x3498DB,
    INFO: 0x5865F2
};

function resolveColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
        if (color.startsWith('#')) return parseInt(color.slice(1), 16);
        return COLORS.BRAND; // default to brand for any named color if we are keeping it minimal
    }
    return COLORS.PRIMARY;
}

function buildModAPanel({ title, description, bannerUrl = DEFAULT_BANNER_URL, actionRows = [], navRow = null, showSocials = true, images = [] }) {
    const container = new ContainerBuilder();

    if (images && images.length > 0) {
        const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
        const mediaGallery = new MediaGalleryBuilder();
        for (const imgUrl of images) {
            mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: imgUrl } }));
        }
        container.addMediaGalleryComponents(mediaGallery);
    }

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
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# **Etkinlikler & özel cekilisler**"))
                .setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Instagram").setEmoji(MONO_EMOJIS.instagram).setURL("https://instagram.com/turklion")),
            
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# **Tanitim & özel videolar**"))
                .setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("YouTube").setEmoji(MONO_EMOJIS.youtube).setURL("https://youtube.com/@turklion"))
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${BRAND_FOOTER}`));
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

// YENİ STRICT KURAL: MOD B (İşlevsel/Operasyonel - Sadece Metin + Butonlar)
function buildModBResponse({ title, textLines = [], fields = [], actionRows = [], files = [], images = [] }) {
    const { FileBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
    const container = new ContainerBuilder();

    let mediaGallery = null;

    if ((files && files.length > 0) || (images && images.length > 0)) {
        mediaGallery = new MediaGalleryBuilder();
        if (files) {
            for (const file of files) {
                mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: `attachment://${file}` } }));
            }
        }
        if (images) {
            for (const imgUrl of images) {
                mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: imgUrl } }));
            }
        }
        container.addMediaGalleryComponents(mediaGallery);
    }

    if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));

    if (textLines && textLines.length > 0) {
        const fullText = textLines.join('\n');
        if (fullText.trim()) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fullText.trim()));
        }
    }

    // Fields'leri tek bir TextDisplay block olarak ekle (V2'de inline fields yok,TEK satır olarak)
    if (fields && fields.length > 0) {
        const fieldText = fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
        if (fieldText.trim()) {
            // 4000 karakter limiti
            const trimmed = fieldText.length > 3900 ? fieldText.slice(0, 3897) + '...' : fieldText;
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trimmed));
        }
    }

    if (actionRows && actionRows.length > 0) {
        for (const row of actionRows) {
            container.addActionRowComponents(row);
        }
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

function createContainerMessage(title, description, colorHex = null, customActionRows = [], fields = [], showBrand = false, ephemeral = false, files = []) {
    let payload;
    if (showBrand) {
        payload = buildModAPanel({ title, description, actionRows: customActionRows });
    } else {
        const textLines = description ? description.split('\n\n') : [];
        payload = buildModBResponse({ title, textLines, fields, actionRows: customActionRows, files });
    }
    
    if (ephemeral) {
        payload.flags |= MessageFlags.Ephemeral;
    }
    return payload;
}

function createV2Container({ title, description, color, fields = [], actionRows = [], showBrand = false, footer = 'turklion.net' }) {
    const textLines = description ? description.split('\n\n') : [];
    return buildModBResponse({ title, textLines, fields, actionRows, color, footer });
}

function createV2Message({ title, description, color, fields, actionRows, showBrand = false }) {
    return createContainerMessage(title, description, color, actionRows, fields, showBrand);
}

module.exports = { 
    createV2Message, 
    createV2Container,
    createContainerMessage, 
    buildModAPanel, 
    buildModBResponse,
    COLORS, 
    resolveColor, 
    DEFAULT_BANNER_URL,
    MONO_EMOJIS,
    EMOJIS
};
