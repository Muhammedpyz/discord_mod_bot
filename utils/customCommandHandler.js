const { MessageFlags } = require('discord.js');
const db = require('../db');
const { createContainerMessage } = require('./uiBuilder');

// Komut cache'i: 30 saniye TTL, her sunucu için ayrı
const commandCache = new Map();
const CACHE_TTL = 30000;

/**
 * Desteklenen değişkenler:
 * {user}         -> <@kullanıcı_id> (etiket)
 * {username}     -> Kullanıcı adı
 * {server}       -> Sunucu adı
 * {channel}      -> <#kanal_id>
 * {membercount}  -> Toplam üye sayısı
 * {mention}      -> <@kullanıcı_id>
 * {roles}        -> Kullanıcının rolleri (virgülle)
 * {date}         -> Bugünün tarihi (GG.AA.YYYY)
 * {time}         -> Saat (SS:DD)
 */
function interpolateVariables(text, message) {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');

    const memberRoles = message.member && message.member.roles && message.member.roles.cache
        ? message.member.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).slice(0, 10).join(', ')
        : '';

    const vars = {
        'user': `<@${message.author.id}>`,
        'username': message.author.username,
        'server': message.guild.name,
        'channel': `<#${message.channel.id}>`,
        'membercount': String(message.guild.memberCount || 0),
        'mention': `<@${message.author.id}>`,
        'roles': memberRoles || 'Yok',
        'date': `${day}.${month}.${date.getFullYear()}`,
        'time': `${hours}:${mins}`
    };

    return text.replace(/\{(\w+)\}/g, (match, key) => vars[key] !== undefined ? vars[key] : match);
}

async function getGuildCommands(guildId) {
    const cached = commandCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    let conn;
    try {
        conn = await db.pool.getConnection();
        const cmds = await conn.query('SELECT * FROM custom_commands WHERE guild_id = ?', [guildId]);
        commandCache.set(guildId, { data: cmds, timestamp: Date.now() });
        return cmds;
    } catch (e) {
        console.error('[CustomCommand] Cache fetch error:', e.message);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

function clearCommandCache(guildId) {
    if (guildId) {
        commandCache.delete(guildId);
    } else {
        commandCache.clear();
    }
}

async function handleCustomCommands(message) {
    if (!message.guild || message.author.bot) return;

    const content = message.content.trim().toLowerCase();
    if (!content) return;

    const cmds = await getGuildCommands(message.guild.id);
    if (cmds.length === 0) return;

    const cmd = cmds.find(c => c.trigger_word.toLowerCase() === content);
    if (!cmd) return;

    const response = interpolateVariables(cmd.response_text, message);

    try {
        if (cmd.reply_type === 'embed') {
            // V2 Container olarak yanıt ver (embed DEĞİL) + opsiyonel link butonu
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const rows = [];
            if (cmd.button_url) {
                try {
                    rows.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel(String(cmd.button_label || 'Bağlantı').slice(0, 80))
                            .setURL(cmd.button_url)
                    ));
                } catch {}
            }
            const payload = createContainerMessage('', response, '#5865F2', rows);
            await message.reply({ ...payload, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        } else {
            // Düz metin: V2 bayrağı YOK (content + V2 bir arada yasak)
            await message.reply({ content: response }).catch(() => {});
        }
    } catch (e) {
        console.error('[CustomCommand] Yanıt hatası:', e.message);
    }
}

module.exports = {
    handleCustomCommands,
    clearCommandCache
};
