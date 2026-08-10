const { Events } = require('discord.js');

module.exports = {
    name: Events.InviteCreate,
    execute(invite, client) {
        if (!client.invites) return;
        const guildInvites = client.invites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.set(invite.code, invite.uses);
        } else {
            client.invites.set(invite.guild.id, new Map([[invite.code, invite.uses]]));
        }
    }
};
