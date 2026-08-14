const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

try {
    const modal = new ModalBuilder()
        .setCustomId('staff_apply_submit')
        .setTitle('Yetkili Başvuru Formu');
        
    const truncate = (str) => str.length > 45 ? str.substring(0, 42) + '...' : str;
    const placeHolder = (str) => str.length > 100 ? str.substring(0, 97) + '...' : str;

    const config = {
        q1: '1. Kendini kısaca tanıtır mısın?',
        q2: '2. Neden yetkili ekibine katılmak istiyorsun?',
        q3: '3. Deneyimin ve günlük aktiflik süren nedir?'
    };

    if (config.q1) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel(truncate(config.q1)).setPlaceholder(placeHolder(config.q1)).setStyle(TextInputStyle.Short).setRequired(true)));
    if (config.q2) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel(truncate(config.q2)).setPlaceholder(placeHolder(config.q2)).setStyle(TextInputStyle.Paragraph).setRequired(true)));
    if (config.q3) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel(truncate(config.q3)).setPlaceholder(placeHolder(config.q3)).setStyle(TextInputStyle.Paragraph).setRequired(true)));
    
    console.log(JSON.stringify(modal.toJSON(), null, 2));
} catch (e) {
    console.error(e);
}
