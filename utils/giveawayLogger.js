const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'giveaway.log');

function logGiveaway(event, data = {}) {
    const ts = new Date().toISOString();
    let line;
    try {
        line = `[${ts}] [GIVEAWAY] ${event} ${JSON.stringify(data)}`;
    } catch (e) {
        line = `[${ts}] [GIVEAWAY] ${event} [serialize-error]`;
    }
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, line + '\n');
    } catch (e) {}
}

module.exports = { logGiveaway };