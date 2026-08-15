const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { MONO_EMOJIS } = require('./uiBuilder');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

function formatCommandUsage(commandData, prefix = '/') {
    if (!commandData) return prefix;
    const name = commandData.name || '';
    const desc = commandData.description || 'Açıklama bulunmuyor.';

    if (!commandData.options || commandData.options.length === 0) {
        return {
            syntax: `${prefix}${name}`,
            description: desc
        };
    }

    const subcommands = commandData.options.filter(o => o.type === 1);
    if (subcommands.length > 0) {
        const subList = subcommands.map(s => {
            const subOpts = s.options ? s.options.map(so => so.required ? `<${so.name}>` : `[${so.name}]`).join(' ') : '';
            return `${prefix}${name} ${s.name} ${subOpts}`.trim();
        });
        return {
            syntax: subList.join('\n» `') + '`',
            description: desc
        };
    }

    const optionsStr = commandData.options.map(opt => {
        return opt.required ? `<${opt.name}>` : `[${opt.name}]`;
    }).join(' ');

    return {
        syntax: `${prefix}${name} ${optionsStr}`.trim(),
        description: desc
    };
}

function buildWrongUsageContainer(commandData, prefix = '/', detailMessage = null) {
    const eCross = getMonoEmoji('cross') || getMonoEmoji('delete');
    const eChannel = getMonoEmoji('channel') || getMonoEmoji('message');
    const eFile = getMonoEmoji('file') || getMonoEmoji('link');

    const { syntax, description } = formatCommandUsage(commandData, prefix);

    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${eCross} Hatalı Komut Kullanımı\nKomutu eksik veya hatalı parametrelerle çalıştırdınız.`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 2. Body Details
    let bodyText = `» ${eChannel} **Doğru Kullanım:**\n\`${syntax}\`\n\n» ${eFile} **Açıklama:** ${description}`;
    if (detailMessage) {
        bodyText += `\n\n**Hata Detayı:** ${detailMessage}`;
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(bodyText)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // 3. Footer
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# ℹ️ Bu bilgilendirme sohbet kirliliğini önlemek için 10 saniye içinde otomatik silinecektir.')
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

module.exports = {
    formatCommandUsage,
    buildWrongUsageContainer
};
