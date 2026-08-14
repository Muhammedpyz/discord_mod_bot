const fs = require('fs');
const logContent = fs.readFileSync('/root/.gemini/antigravity-cli/brain/b3b517ed-28f0-4fb6-9af2-cb41e49aaff2/.system_generated/tasks/task-11081.log', 'utf8');

const regex = /Name: (.*?) \| ID: (\d+)/g;
let match;
let emojis = {};

while ((match = regex.exec(logContent)) !== null) {
    emojis[match[1]] = match[2];
}

let resultStr = "";
for (const [name, id] of Object.entries(emojis)) {
    resultStr += `    "${name}": "${id}",\n`;
}

console.log(resultStr);
