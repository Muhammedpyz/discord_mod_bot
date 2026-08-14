const { RadioGroupBuilder, CheckboxBuilder, CheckboxGroupBuilder } = require('discord.js');
console.log(typeof RadioGroupBuilder, typeof CheckboxBuilder, typeof CheckboxGroupBuilder);
let rg = new RadioGroupBuilder().setCustomId('rg');
console.log(Object.keys(rg));
