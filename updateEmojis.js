const fs = require('fs');
let uiBuilder = fs.readFileSync('utils/uiBuilder.js', 'utf8');
const appEmojis = fs.readFileSync('app_emojis.txt', 'utf8');

const regex = /const MONO_EMOJIS = \{[\s\S]*?\n\};/;
const replacement = `const MONO_EMOJIS = {\n${appEmojis.replace(/,\n$/, '\n')}};`;

uiBuilder = uiBuilder.replace(regex, replacement);
fs.writeFileSync('utils/uiBuilder.js', uiBuilder);
console.log('Successfully replaced MONO_EMOJIS!');
