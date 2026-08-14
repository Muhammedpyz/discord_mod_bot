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
    instagram: "1530489604749398128",
    discord: "1530917539859660952",
    github: "1530917538672672799",
    cross: "1530917536806469783",
    check: "1530917534885478600",
    ban: "1530917533081927780",
    add: "1530917531450343474",
    youtube: "1530489607311851530",
    announcement: "1530917526391750676",
    warning: "1530917524609175562",
    x_twitter: "1530489609476116490",
    website: "1530489603046506514",
    web: "1530489603046506514",
    "mmmmmmmmm": "1176627285986652232",
    "ayolyani": "1176640469896282202",
    "yabisgamk": "1176640558157009107",
    "emoji_5": "1176640656609923073",
    "yiaaa": "1176640729293004871",
    "31ci_irem": "1176640775715573811",
    "yakbabayak": "1176810559589601280",
    "yamateh": "1176810635175137380",
    "narboys": "1176810702107844689",
    "Babalarszntutar": "1176810784261689435",
    "emoji_12": "1176810838737305600",
    "emoji_13": "1176810942823137291",
    "uwu": "1176811068589363262",
    "emoji_15": "1176928916481527828",
    "otuzbirtsayfa": "1176936696462442556",
    "emoji_17": "1176936962804945017",
    "neyebakyonaq": "1177279129809330186",
    "buyurkardesss": "1177279968389107713",
    "hayrdrkarde": "1177346234718093443",
    "twich": "1178429832422498474",
    "emoji_24": "1178596632795811880",
    "emoji_26": "1178596720276406282",
    "emoji_27": "1178597354035761182",
    "emoji_28": "1178597428203626677",
    "emoji_31": "1178597482540838972",
    "emoji_32": "1178597555492372550",
    "emoji_34": "1178597654037540894",
    "emoji_35": "1178597704218181652",
    "emoji_37": "1178597733108568115",
    "emoji_38": "1178597793183580293",
    "emoji_40": "1178597856538542130",
    "emoji_42": "1178597941938749512",
    "emoji_43": "1178598013296455680",
    "emoji_45": "1178754323086311476",
    "emoji_46": "1178754407115001866",
    "emoji_48": "1178754460319748247",
    "emoji_49": "1178754561041760356",
    "emoji_50": "1178754585322602506",
    "emoji_51": "1178754659146539098",
    "emoji_52": "1178754702305919028",
    "emoji_53": "1537743413976371291",
    "emoji_54": "1178754881130078228",
    "emoji_56": "1178754951938314360",
    "emoji_57": "1178755007902916703",
    "emoji_58": "1203023697686822993",
    "plskrt": "1203023876313976942",
    "emoji_60": "1203024008652787743",
    "emoji_61": "1203024282016546937",
    "emoji_62": "1203025052661194752",
    "emoji_63": "1203025108575322123",
    "emoji_64": "1203025188615233546",
    "parammvarlan": "1203025271675162694",
    "galp": "1203025655516893314",
    "admin": "1353723651282702407",
    "Angry": "1353723657217642608",
    "anibanned": "1353723663874261054",
    "animeangry": "1353723669595291648",
    "aquacry": "1353723675358007438",
    "arrow": "1353723680873779271",
    "AwOo": "1353723686368186379",
    "awoothink": "1353723692215173141",
    "baka": "1353723697952723045",
    "banned": "1353723703527080048",
    "blushwow": "1353723709159903356",
    "booster": "1353723716793663521",
    "checkmark": "1353723723299033160",
    "checkroxo": "1353723728894361650",
    "communist": "1353723733969342575",
    "dan": "1353723740214530121",
    "designer": "1353723746023641179",
    "developer": "1353723751950450779",
    "editor": "1353723757230948423",
    "fingerwave": "1353723763145052221",
    "flandre_concerned": "1353723769210011688",
    "GatoXD": "1353723775237099573",
    "hello": "1353723784447918090",
    "httpsdiscordggmd": "1353723790097649675",
    "kid": "1353723797534019614",
    "loading": "1353723803791917176",
    "madblob": "1353723809496043601",
    "member": "1353723814776668171",
    "moderator": "1353723820976115712",
    "NepSmug": "1353723826776838215",
    "Neysi": "1353723832346611765",
    "ohmy": "1353723838302523402",
    "owner": "1353723843713306787",
    "parrot": "1353723849744580681",
    "partner": "1353723855092584520",
    "pepecowboy": "1353723861065273344",
    "robloxmanface": "1353723866857476168",
    "Ryukosip": "1353723872691748864",
    "SagiriShy": "1353723878337282098",
    "staff": "1353723884469489696",
    "streamer": "1353723890010161244",
    "trialmod": "1353723896045768814",
    "twitchpartner": "1353723901623930902",
    "unchecked": "1353723907114405938",
    "valorant": "1353723912302886946",
    "verified": "1353723918518587485",
    "Verify": "1353723924310921289",
    "videocreator": "1353723930048987219",
    "viral": "1353723935396466729",
    "welcome": "1353723941964877896",
    "_carregando_3_": "1353738755088978053",
    "_dance_": "1353738760872787978"
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
        const { SeparatorBuilder } = require('discord.js');
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
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
