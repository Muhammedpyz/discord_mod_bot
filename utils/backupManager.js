const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createBackup(guild) {
    if (!guild) throw new Error("Guild not provided for backup.");
    
    const backupData = {
        guildId: guild.id,
        guildName: guild.name,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        categories: [],
        channels: {
            text: [],
            voice: []
        },
        roles: [],
        members: []
    };

    // 1. Fetch Categories
    const categories = guild.channels.cache.filter(c => c.type === 4); // 4 is Category
    for (const [id, category] of categories) {
        backupData.categories.push({
            id: category.id,
            name: category.name,
            position: category.position,
            permissions: category.permissionOverwrites.cache.map(p => ({
                id: p.id,
                type: p.type, // 0 for role, 1 for member
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
            }))
        });
    }

    // 2. Fetch Channels (Text & Voice)
    const textChannels = guild.channels.cache.filter(c => c.type === 0); // 0 is GuildText
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2); // 2 is GuildVoice

    for (const [id, channel] of textChannels) {
        backupData.channels.text.push({
            id: channel.id,
            name: channel.name,
            parentId: channel.parentId,
            position: channel.position,
            topic: channel.topic,
            nsfw: channel.nsfw,
            rateLimitPerUser: channel.rateLimitPerUser,
            permissions: channel.permissionOverwrites.cache.map(p => ({
                id: p.id,
                type: p.type,
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
            }))
        });
    }

    for (const [id, channel] of voiceChannels) {
        backupData.channels.voice.push({
            id: channel.id,
            name: channel.name,
            parentId: channel.parentId,
            position: channel.position,
            bitrate: channel.bitrate,
            userLimit: channel.userLimit,
            permissions: channel.permissionOverwrites.cache.map(p => ({
                id: p.id,
                type: p.type,
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
            }))
        });
    }

    // 3. Fetch Roles & Permissions
    const roles = guild.roles.cache;
    for (const [id, role] of roles) {
        if (id === guild.id) continue; // Skip @everyone if needed, or include it
        backupData.roles.push({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            hoist: role.hoist,
            position: role.position,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable
        });
    }

    // 4. Fetch Member Roles
    const members = await guild.members.fetch();
    for (const [id, member] of members) {
        if (member.user.bot) continue;
        backupData.members.push({
            id: member.user.id,
            username: member.user.username,
            roles: member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id)
        });
    }

    // Save to JSON
    const fileName = `backup-${guild.id}-${backupData.timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    return { filePath, fileName, backupData };
}

async function restoreBackup(guild, backupId) {
    // Stub implementation
    console.log(`Stub: Restoring backup ${backupId} for guild ${guild.id}`);
    return true;
}

module.exports = {
    createBackup,
    restoreBackup
};
