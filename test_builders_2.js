const { RadioGroupBuilder, ActionRowBuilder, ModalBuilder } = require('discord.js');
let modal = new ModalBuilder().setCustomId('m').setTitle('T');
let rg = new RadioGroupBuilder().setCustomId('rg').addOptions({label: 'l1', value: 'v1'});
modal.addComponents(new ActionRowBuilder().addComponents(rg));
console.log(JSON.stringify(modal.toJSON(), null, 2));
