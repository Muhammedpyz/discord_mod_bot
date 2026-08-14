const { CheckboxBuilder, CheckboxGroupBuilder } = require('discord.js');
let cb = new CheckboxBuilder();
let cbg = new CheckboxGroupBuilder();
console.log("CB:", Object.keys(cb.__proto__));
console.log("CBG:", Object.keys(cbg.__proto__));
