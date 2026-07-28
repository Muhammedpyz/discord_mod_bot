const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Message, createContainerMessage, buildModBResponse, COLORS } = require('./uiBuilder');

function createWarningEmbed(title, description, color = COLORS.WARNING) {
    return createContainerMessage(title, description, color);
}

function createLogEmbed(action, user, moderator, reason) {
    // Log embeds should use Mod B response
    return buildModBResponse({
        title: `Islem Raporu: ${action}`,
        color: COLORS.LOG,
        fields: [
            { name: 'Kullanici', value: `${user.tag} (${user.id})` },
            { name: 'Yetkili', value: `${typeof moderator === 'object' && moderator !== null && moderator.tag ? moderator.tag : moderator}` },
            { name: 'Sebep', value: reason || 'Belirtilmedi' }
        ]
    });
}

function createModActionButtons(userId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:mute:${userId}`)
                .setLabel('Sustur')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`mod:ban:${userId}`)
                .setLabel('Yasakla')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`mod:ignore:${userId}`)
                .setLabel('Yoksay')
                .setStyle(ButtonStyle.Secondary)
        );
    return row;
}

module.exports = {
    COLORS,
    createWarningEmbed,
    createLogEmbed,
    createModActionButtons
};
