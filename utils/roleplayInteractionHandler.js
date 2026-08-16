const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Container, COLORS, MONO_EMOJIS } = require('./uiBuilder');
const { getNekoGif, hasNekoEndpoint } = require('./nekoHelper');
const { getRandomTenorGif } = require('./gifHelper');

async function handleRoleplayInteraction(interaction) {
    // Custom ID Format: rp_back_{subcommand}_{authorId}_{targetUserId}
    const parts = interaction.customId.split('_');
    const subcommand = parts[2];
    const originalAuthorId = parts[3];
    const targetUserId = parts[4];

    // Sadece hedef kişi butona basabilir
    if (interaction.user.id !== targetUserId) {
        return interaction.reply({
            content: 'Bu butona sadece eylemin hedefindeki kişi basabilir!',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });

    const author = interaction.user; // Butona basan kişi (orijinal target)
    let targetUser = await interaction.client.users.fetch(originalAuthorId).catch(() => null);

    if (!targetUser) {
        targetUser = { username: 'Bilinmeyen Kullanıcı' };
    }

    let gifUrl = null;
    if (hasNekoEndpoint(subcommand)) {
        gifUrl = await getNekoGif(subcommand);
    } else if (['bow', 'clap', 'salute', 'kill', 'lick'].includes(subcommand)) {
        gifUrl = await getRandomTenorGif(`anime ${subcommand}`);
    }

    let actionText = '';
    const titleMap = {
        hug: 'Sarılma', kiss: 'Öpücük', lick: 'Yalama', pat: 'Baş Okşama',
        slap: 'Tokat', tickle: 'Gıdıklama', poke: 'Dürtme', deathstare: 'Ölümcül Bakış',
        kill: 'Cinayet'
    };

    const title = (titleMap[subcommand] || 'Eylem') + ' (Karşılık)';

    const texts = {
        hug: `**${author.username}**, **${targetUser.username}** adlı kullanıcıya karşılık olarak sımsıkı sarıldı!`,
        kiss: `**${author.username}**, **${targetUser.username}** adlı kullanıcıya karşılık olarak öpücük verdi!`,
        lick: `**${author.username}**, **${targetUser.username}** adlı kullanıcıyı yaladı!`,
        pat: `**${author.username}**, **${targetUser.username}** adlı kullanıcının başını okşadı.`,
        slap: `**${author.username}**, **${targetUser.username}** adlı kullanıcıya karşılık tokat attı!`,
        tickle: `**${author.username}**, **${targetUser.username}** adlı kullanıcıyı gıdıkladı!`,
        poke: `**${author.username}**, **${targetUser.username}** adlı kullanıcıyı dürttü.`,
        deathstare: `**${author.username}**, **${targetUser.username}** adlı kullanıcıya ölümcül bir bakışla karşılık verdi...`,
        kill: `**${author.username}**, **${targetUser.username}** adlı kullanıcıya karşılık verdi ve onu yok etti!`
    };

    actionText = texts[subcommand] || `**${author.username}**, **${targetUser.username}** ile eyleme geçti.`;

    // Yeni buton oluştur (karşılığın karşılığı)
    const buttonMap = {
        hug: 'Sarıl', kiss: 'Öp', lick: 'Yala', pat: 'Başını Okşa',
        slap: 'Karşılık Ver', tickle: 'Gıdıkla', poke: 'Dürt', deathstare: 'Gözünü Dik',
        kill: 'Saldır'
    };
    
    const btnLabel = buttonMap[subcommand] || 'Karşılık Ver';
    const style = ['slap', 'kill', 'deathstare'].includes(subcommand) ? ButtonStyle.Danger : ButtonStyle.Primary;
    
    const respondBtn = new ButtonBuilder()
        .setCustomId(`rp_back_${subcommand}_${author.id}_${targetUser.id || originalAuthorId}`)
        .setLabel(`Geri ${btnLabel}`)
        .setStyle(style);
    
    if (MONO_EMOJIS.arrowleft) respondBtn.setEmoji(MONO_EMOJIS.arrowleft);
    
    const actionRows = [new ActionRowBuilder().addComponents(respondBtn)];

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

module.exports = { handleRoleplayInteraction };
