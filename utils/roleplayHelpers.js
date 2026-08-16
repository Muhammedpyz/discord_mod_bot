const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Container, COLORS, MONO_EMOJIS } = require('./uiBuilder');
const { getNekoGif, hasNekoEndpoint } = require('./nekoHelper');
const { getRandomTenorGif } = require('./gifHelper');

async function handleRoleplay(interaction, actionType, needsTarget) {
    const user = interaction.user;
    const target = needsTarget ? interaction.options.getUser('kullanici') : null;

    if (needsTarget && !target) {
        return await interaction.editReply({ content: 'Bir kullanıcı belirtmelisiniz!', flags: MessageFlags.Ephemeral });
    }

    if (needsTarget && target.id === user.id) {
        return await interaction.editReply({ content: 'Kendinize bu eylemi yapamazsınız!', flags: MessageFlags.Ephemeral });
    }

    const nekoMap = {
        'saril': 'hug', 'op': 'kiss', 'tokat': 'slap', 'isir': 'bite', 
        'oksa': 'pat', 'gıdıkla': 'tickle', 'yala': 'lick',
        'agla': 'cuddle', 'gul': 'smug', 'uzgun': 'cry'
    };
    const tenorMap = {
        'oldur': 'anime kill', 'tekme': 'anime kick',
        'mutlu': 'anime happy', 'utangac': 'anime shy', 'kiz': 'anime angry',
        'kork': 'anime scared', 'uyku': 'anime sleep', 'saskin': 'anime confused',
        'kac': 'anime run', 'dus': 'anime fall', 'dans': 'anime dance',
        'sigara': 'anime smoking', 'kus': 'anime vomit', 'intihar': 'anime suicide'
    };

    let gifUrl = null;
    if (nekoMap[actionType]) {
        if (hasNekoEndpoint(nekoMap[actionType])) {
            gifUrl = await getNekoGif(nekoMap[actionType]);
        } else {
            gifUrl = await getRandomTenorGif(`anime ${nekoMap[actionType]}`);
        }
    } else if (tenorMap[actionType]) {
        gifUrl = await getRandomTenorGif(tenorMap[actionType]);
    }

    const titleMap = {
        saril: 'Sarılma', op: 'Öpücük', tokat: 'Tokat', isir: 'Isırma',
        oldur: 'Cinayet', oksa: 'Baş Okşama', gıdıkla: 'Gıdıklama',
        tekme: 'Tekme', yala: 'Yalama', agla: 'Ağlama', gul: 'Gülme',
        uzgun: 'Üzgün', mutlu: 'Mutlu', utangac: 'Utangaç', kiz: 'Kızgın',
        kork: 'Korku', uyku: 'Uyku', saskin: 'Şaşkın', kac: 'Kaçma',
        dus: 'Düşme', dans: 'Dans', sigara: 'Sigara İçme', kus: 'Kusma', intihar: 'İntihar'
    };

    const textMap = {
        saril: `**${user.username}**, **${target?.username}** adlı kullanıcıya sımsıkı sarıldı!`,
        op: `**${user.username}**, **${target?.username}** adlı kullanıcıyı öptü!`,
        tokat: `**${user.username}**, **${target?.username}** adlı kullanıcıya tokat attı!`,
        isir: `**${user.username}**, **${target?.username}** adlı kullanıcıyı ısırdı!`,
        oldur: `**${user.username}**, **${target?.username}** adlı kullanıcıyı öldürdü!`,
        oksa: `**${user.username}**, **${target?.username}** adlı kullanıcının başını okşadı.`,
        gıdıkla: `**${user.username}**, **${target?.username}** adlı kullanıcıyı gıdıkladı!`,
        tekme: `**${user.username}**, **${target?.username}** adlı kullanıcıya tekme attı!`,
        yala: `**${user.username}**, **${target?.username}** adlı kullanıcıyı yaladı!`,
        agla: `**${user.username}** ağlıyor...`,
        gul: `**${user.username}** gülüyor!`,
        uzgun: `**${user.username}** çok üzgün...`,
        mutlu: `**${user.username}** çok mutlu!`,
        utangac: `**${user.username}** utandı.`,
        kiz: `**${user.username}** çok kızgın!`,
        kork: `**${user.username}** korkuyor!`,
        uyku: `**${user.username}** uyudu...`,
        saskin: `**${user.username}** çok şaşkın!`,
        kac: `**${user.username}** kaçıyor!`,
        dus: `**${user.username}** düştü!`,
        dans: `**${user.username}** dans ediyor!`,
        sigara: `**${user.username}** sigara içiyor.`,
        kus: `**${user.username}** kustu...`,
        intihar: `**${user.username}** intihar etti.`
    };

    const actionText = textMap[actionType] || `**${user.username}** bir eylem yaptı.`;
    const title = titleMap[actionType] || 'Eylem';

    let actionRows = [];
    if (needsTarget) {
        const reverseMap = {
            saril: 'hug', op: 'kiss', tokat: 'slap', isir: 'bite', 
            oksa: 'pat', gıdıkla: 'tickle', yala: 'lick', oldur: 'kill', tekme: 'kick'
        };
        const revAction = reverseMap[actionType];
        if (revAction) {
            const btnLabelMap = {
                hug: 'Sarıl', kiss: 'Öp', slap: 'Karşılık Ver', bite: 'Isır', 
                pat: 'Başını Okşa', tickle: 'Gıdıkla', lick: 'Yala', kill: 'Saldır', kick: 'Tekme At'
            };
            const btnLabel = btnLabelMap[revAction] || 'Karşılık Ver';
            const style = ['slap', 'kill', 'kick'].includes(revAction) ? ButtonStyle.Danger : ButtonStyle.Primary;
            
            const respondBtn = new ButtonBuilder()
                .setCustomId(`rp_back_${revAction}_${user.id}_${target.id}`)
                .setLabel(`Geri ${btnLabel}`)
                .setStyle(style);
            
            if (MONO_EMOJIS.arrowleft) respondBtn.setEmoji(MONO_EMOJIS.arrowleft);
            actionRows.push(new ActionRowBuilder().addComponents(respondBtn));
        }
    }

    const payload = createV2Container({
        title: title,
        description: actionText,
        color: COLORS.INFO,
        actionRows: actionRows
    });

    if (gifUrl) {
        payload.components[0].components.push({
            type: 5, // MediaGallery
            items: [{ url: gifUrl }]
        });
    }

    await interaction.editReply(payload);
}

module.exports = { handleRoleplay };
