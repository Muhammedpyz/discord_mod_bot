const { createV2Container, COLORS, MONO_EMOJIS } = require('./uiBuilder');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const truths = [
    "Hayatında yaptığın en utanç verici şey nedir?",
    "En son ne zaman yalan söyledin ve neydi?",
    "Eğer birini gizlice takip etseydin, bu kim olurdu?",
    "Hoşlandığın kişiye mesaj atarken hiç yanlışlıkla başkasına gönderdin mi?",
    "Kimsenin bilmediği bir sırrını söyle.",
    "Banyoda şarkı söyler misin? Söylersen en son ne söyledin?",
    "Hiç aynanın karşısında kendi kendine konuştun mu?",
    "Eğer bir günlüğüne karşı cins olsaydın ilk yapacağın şey ne olurdu?",
    "Telefonundaki en utanç verici fotoğraf ne?",
    "En kötü alışkanlığın nedir?"
];

const dares = [
    "En son mesajlaştığın kişiye 'Seni seviyorum' yaz.",
    "Gözünü kapat ve rastgele birine mesaj at.",
    "Bir dakika boyunca tavuk taklidi yap.",
    "Profil fotoğrafını 1 saatliğine komik bir şey yap.",
    "En sevdiğin şarkıyı sesli mesaj olarak söyle ve birine gönder.",
    "Telefonundaki 5. fotoğrafı buraya at.",
    "Kendi kendine 30 saniye boyunca iltifat et.",
    "Rastgele birine 'Beni affet' yaz ve açıklama yapma.",
    "Sunucudaki rastgele birine DM'den komik bir fıkra anlat.",
    "Şu an giydiğin çorapların fotoğrafını at."
];

const pickups = [
    "Cennetten düşerken canın çok acıdı mı?",
    "Yoruldun mu? Çünkü bütün gün beynimin içinde koşturdun.",
    "Baban uzaylı mıydı? Çünkü senin gibi bir şey yeryüzünde yok.",
    "İlk görüşte aşka inanır mısın, yoksa dışarı çıkıp tekrar mı gireyim?",
    "Telefon numaramı kaybettim, seninkini ödünç alabilir miyim?",
    "Seni ne zaman görsem kalbim depar atıyor.",
    "Google'da arama yapmaya gerek yok, çünkü aradığım her şey sende.",
    "Gözlerin o kadar güzel ki, içine bakarken kayboldum.",
    "Eğer güzellik bir suç olsaydı, ömür boyu hapis yatardın.",
    "Seninle konuşmak, en sevdiğim şarkıyı dinlemek gibi."
];

const rizzLines = [
    "Adın Google mı? Çünkü aradığım her şey sende.",
    "Benimle bir fotoğraf çektirir misin? Çocuklarıma meleklerin gerçek olduğunu kanıtlamak istiyorum.",
    "Kalbinin şifresini unuttum, acaba ipucu verebilir misin?",
    "Gülüşün o kadar parlak ki, güneşe ihtiyaç duymuyorum.",
    "Matematiğim pek iyi değildir ama biz ikimiz harika bir 1 ederiz.",
    "Seninle geçirdiğim her saniye, hayatımın en iyi saniyesi oluyor.",
    "Gözlerine baktığımda sadece kendi yansımamı değil, geleceğimi de görüyorum."
];

const textToEmojiMap = {
    'a': '🇦', 'b': '🇧', 'c': '🇨', 'd': '🇩', 'e': '🇪', 'f': '🇫', 'g': '🇬', 'h': '🇭',
    'i': '🇮', 'j': '🇯', 'k': '🇰', 'l': '🇱', 'm': '🇲', 'n': '🇳', 'o': '🇴', 'p': '🇵',
    'q': '🇶', 'r': '🇷', 's': '🇸', 't': '🇹', 'u': '🇺', 'v': '🇻', 'w': '🇼', 'x': '🇽',
    'y': '🇾', 'z': '🇿', '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
    '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣', '!': '❗', '?': '❓'
};

async function handleHack(interaction) {
    const user = interaction.options.getUser('kullanici');
    
    const processingPayload = createV2Container({
        title: 'Hacking İşlemi Başladı',
        description: 'Discord sunucularına bağlanılıyor...\nGüvenlik duvarı aşılıyor...\nKullanıcı verileri çekiliyor...',
        color: COLORS.PRIMARY
    });
    
    await interaction.editReply(processingPayload);
    
    await new Promise(r => setTimeout(r, 2000));
    
    const lawda = ['8', '3821', '23', '21', '313', '43', '29', '76', '11', '9', '44', '470', '318', '26', '69'];
    const randomPass = lawda[Math.floor(Math.random() * lawda.length)];
    const randomPass2 = Math.random().toString(36).substring(2, 5);
    const cleanUsername = user.username.replace(/[^a-zA-Z0-9]/g, '');
    
    const hackPayload = createV2Container({
        title: 'Hack Tamamlandı',
        description: `"Hacklenen" Kişi: <@${user.id}>\n\n**E-Posta:** ${cleanUsername}${randomPass}@gmail.com\n**Şifre:** ${cleanUsername}@${randomPass2}\n\n-*Şaka amaçlıdır.*-`,
        color: COLORS.SUCCESS
    });
    
    hackPayload.components[0].components[0].components[0].accessory = {
        type: 3, // Thumbnail
        media: { url: user.displayAvatarURL({ size: 128 }) }
    };
    
    await interaction.editReply(hackPayload);
}

async function handleGayTest(interaction) {
    const user = interaction.options.getUser('kullanici') || interaction.user;
    const rate = Math.floor(Math.random() * 101);
    
    const payload = createV2Container({
        title: 'Gay Testi',
        description: `<@${user.id}>, **%${rate}** oranında gaysin! 🌈\n\n-*Şaka amaçlıdır.*-`,
        color: COLORS.INFO
    });
    
    await interaction.editReply(payload);
}

async function handleDumbTest(interaction) {
    const user = interaction.options.getUser('kullanici') || interaction.user;
    const rate = Math.floor(Math.random() * 101);
    
    const payload = createV2Container({
        title: 'Aptallık Testi',
        description: `<@${user.id}>, **%${rate}** oranında aptalsın! 🧠\n\n-*Şaka amaçlıdır.*-`,
        color: COLORS.WARNING
    });
    
    await interaction.editReply(payload);
}

async function handleSimpTest(interaction) {
    const user = interaction.options.getUser('kullanici') || interaction.user;
    const rate = Math.floor(Math.random() * 101);
    
    const payload = createV2Container({
        title: 'Simp Testi',
        description: `<@${user.id}>, **%${rate}** oranında simpsin!\n\n-*Şaka amaçlıdır.*-`,
        color: COLORS.BRAND
    });
    
    await interaction.editReply(payload);
}

async function handleDare(interaction) {
    const dare = dares[Math.floor(Math.random() * dares.length)];
    
    const payload = createV2Container({
        title: 'Cesaretlik Görevi',
        description: dare,
        color: COLORS.ERROR
    });
    
    await interaction.editReply(payload);
}

async function handleTruth(interaction) {
    const truth = truths[Math.floor(Math.random() * truths.length)];
    
    const payload = createV2Container({
        title: 'Doğruluk Sorusu',
        description: truth,
        color: COLORS.SUCCESS
    });
    
    await interaction.editReply(payload);
}

async function handlePickup(interaction) {
    const pickup = pickups[Math.floor(Math.random() * pickups.length)];
    
    const payload = createV2Container({
        title: 'Yavşama Sözü',
        description: pickup,
        color: COLORS.BRAND
    });
    
    await interaction.editReply(payload);
}

async function handleRizz(interaction) {
    const user = interaction.options.getUser('kullanici');
    const rizz = rizzLines[Math.floor(Math.random() * rizzLines.length)];
    
    const desc = user ? `<@${interaction.user.id}>, <@${user.id}> kullanıcısına rizz yapıyor:\n\n"${rizz}"` : `İşte bir rizz sözü:\n\n"${rizz}"`;
    
    const payload = createV2Container({
        title: 'Rizz Vakti',
        description: desc,
        color: COLORS.INFO
    });
    
    await interaction.editReply(payload);
}

async function handleNitro(interaction) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    const payload = createV2Container({
        title: 'Discord Nitro',
        description: `Tebrikler, bir adet bedava Nitro buldunuz!\n\nhttps://discord.gift/${code}\n\n-*Tamamen sahtedir.*-`,
        color: 0x5865F2
    });
    
    await interaction.editReply(payload);
}

async function handleToken(interaction) {
    const user = interaction.options.getUser('kullanici') || interaction.user;
    
    const char = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const char2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    
    const part1 = Buffer.from(user.id).toString('base64');
    
    let part2 = '';
    for(let i=0; i<6; i++) part2 += char.charAt(Math.floor(Math.random() * char.length));
    
    let part3 = '';
    for(let i=0; i<27; i++) part3 += char2.charAt(Math.floor(Math.random() * char2.length));
    
    const payload = createV2Container({
        title: 'Token Üretici',
        description: `<@${user.id}> adlı kullanıcının sahte tokeni:\n\n\`${part1}.${part2}.${part3}\`\n\n-*Şaka amaçlıdır.*-`,
        color: COLORS.PRIMARY
    });
    
    await interaction.editReply(payload);
}

async function handleShip(interaction) {
    const user1 = interaction.options.getUser('kullanici1');
    const user2 = interaction.options.getUser('kullanici2') || interaction.user;
    
    const rate = Math.floor(Math.random() * 101);
    
    let heart = "❤️";
    if (rate < 20) heart = "💔";
    else if (rate < 50) heart = "🤍";
    else if (rate < 80) heart = "💖";
    
    const payload = createV2Container({
        title: 'Aşk Ölçer',
        description: `<@${user1.id}> ve <@${user2.id}> arasındaki aşk oranı:\n\n**%${rate}** ${heart}`,
        color: 0xFF69B4
    });
    
    await interaction.editReply(payload);
}

async function handleTextToEmoji(interaction) {
    const text = interaction.options.getString('yazi').toLowerCase();
    
    let result = '';
    for (const char of text) {
        if (textToEmojiMap[char]) {
            result += textToEmojiMap[char] + ' ';
        } else if (char === ' ') {
            result += '   ';
        } else {
            result += char;
        }
    }
    
    if (result.length > 2000) result = result.substring(0, 1997) + '...';
    
    const payload = createV2Container({
        title: 'Yazı ➡️ Emoji',
        description: result,
        color: COLORS.INFO
    });
    
    await interaction.editReply(payload);
}

async function handleAnimals(interaction) {
    const type = interaction.options.getString('tur');
    const animalTitles = {
        cat: 'Kedi', dog: 'Köpek', fox: 'Tilki',
        duck: 'Ördek', panda: 'Panda',
        bird: 'Kuş', bunny: 'Tavşan', bear: 'Ayı'
    };
    
    const title = animalTitles[type] || type;
    
    // Basit bir API ile görsel getirme, eger yoksa fallback (Melon daki lib/animalApi.js i referans aldik)
    // Cogu some-random-api de ucretsiz
    let imageUrl = '';
    try {
        if (['cat', 'dog', 'fox', 'panda', 'bird', 'koala'].includes(type)) {
            const res = await fetch(`https://some-random-api.com/animal/${type}`);
            const data = await res.json();
            imageUrl = data.image;
        } else if (type === 'duck') {
            const res = await fetch('https://random-d.uk/api/v2/random');
            const data = await res.json();
            imageUrl = data.url;
        } else {
            // Digerleri icin placekitten gibi bir sey ya da hata mesaji
            imageUrl = 'https://cataas.com/cat';
        }
    } catch(e) {
        imageUrl = null;
    }
    
    if (!imageUrl) {
        return await interaction.editReply(createV2Container({
            title: 'Hata',
            description: 'Görsel yüklenirken bir hata oluştu.',
            color: COLORS.ERROR
        }));
    }
    
    const payload = createV2Container({
        title: `Rastgele ${title}`,
        description: `İşte rastgele bir ${title.toLowerCase()} görseli:`,
        color: COLORS.SUCCESS
    });
    
    payload.components[0].components.push({
        type: 5, // MediaGallery
        items: [{ url: imageUrl }]
    });
    
    await interaction.editReply(payload);
}

async function handleMeme(interaction) {
    let imageUrl = '';
    let memeTitle = 'Komik Resim';
    try {
        const res = await fetch('https://meme-api.com/gimme');
        const data = await res.json();
        imageUrl = data.url;
        memeTitle = data.title;
    } catch (e) {
        return await interaction.editReply(createV2Container({
            title: 'Hata',
            description: 'Meme yüklenirken bir hata oluştu.',
            color: COLORS.ERROR
        }));
    }

    const payload = createV2Container({
        title: memeTitle,
        description: 'İşte rastgele bir komik resim (meme):',
        color: COLORS.INFO
    });
    
    payload.components[0].components.push({
        type: 5, // MediaGallery
        items: [{ url: imageUrl }]
    });

    await interaction.editReply(payload);
}

async function handleRickroll(interaction) {
    const url = interaction.options.getString('url');
    const rickrollPatterns = [
        'dQw4w9WgXcQ', 'iik25wqIuFo', 'oHg5SJYRHA0', 'cvh0nX08nRw'
    ];
    
    let isRickroll = false;
    for (const pattern of rickrollPatterns) {
        if (url.includes(pattern)) {
            isRickroll = true;
            break;
        }
    }
    
    if (isRickroll) {
        await interaction.editReply(createV2Container({
            title: 'Rickroll Tespit Edildi!',
            description: `<:mono:${MONO_EMOJIS.warning}> Uyarı! Bu link bir rickroll içeriyor!\n\n${url}`,
            color: COLORS.ERROR
        }));
    } else {
        await interaction.editReply(createV2Container({
            title: 'Temiz Link',
            description: `<:mono:${MONO_EMOJIS.check}> Bu link güvenli görünüyor (bilinen bir rickroll değil).\n\n${url}`,
            color: COLORS.SUCCESS
        }));
    }
}

async function handleFakeMessage(interaction) {
    const user = interaction.options.getUser('kullanici');
    const msg = interaction.options.getString('mesaj');
    
    const payload = createV2Container({
        title: 'Sahte Mesaj',
        description: `**${user.username}** diyor ki:\n\n> ${msg}\n\n-*Bu mesaj tamamen sahtedir.*-`,
        color: COLORS.PRIMARY
    });
    
    payload.components[0].components[0].components[0].accessory = {
        type: 3, // Thumbnail
        media: { url: user.displayAvatarURL({ size: 128 }) }
    };

    await interaction.editReply(payload);
}

async function handleWizz(interaction) {
    const p1 = createV2Container({ title: 'WIZZ BAŞLATILIYOR', description: 'Tüm kanallar siliniyor...', color: COLORS.ERROR });
    await interaction.editReply(p1);
    await new Promise(r => setTimeout(r, 1500));
    
    const p2 = createV2Container({ title: 'WIZZ DEVAM EDİYOR', description: 'Sunucu üyeleri banlanıyor... [ ||145|| / 521 ]', color: COLORS.ERROR });
    await interaction.editReply(p2);
    await new Promise(r => setTimeout(r, 1500));
    
    const p3 = createV2Container({ title: 'WIZZ DEVAM EDİYOR', description: 'Roller siliniyor... [ ||32|| / 45 ]', color: COLORS.ERROR });
    await interaction.editReply(p3);
    await new Promise(r => setTimeout(r, 1500));
    
    const p4 = createV2Container({ title: 'SUNUCU PATLATILDI', description: 'Şaka şaka! 😂 Sunucunuz güvende.\n\n-*Sadece bir eglence komutudur.*-', color: COLORS.SUCCESS });
    await interaction.editReply(p4);
}

module.exports = {
    handleHack,
    handleGayTest,
    handleDumbTest,
    handleSimpTest,
    handleDare,
    handleTruth,
    handlePickup,
    handleRizz,
    handleNitro,
    handleToken,
    handleShip,
    handleTextToEmoji,
    handleAnimals,
    handleMeme,
    handleRickroll,
    handleFakeMessage,
    handleWizz
};
