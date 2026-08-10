/**
 * Ultra-Premium 1:1 Native Discord Dark Theme HTML Transcript Generator
 * TurkLion Network Special Edition
 */

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parseDiscordMarkdown(content, guild = null) {
    if (!content) return '';
    let html = escapeHtml(content);

    // Code blocks ```
    html = html.replace(/```(?:([a-zA-Z0-9_+-]+)\n)?([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="discord-code-block"><code class="${lang ? 'language-' + lang : ''}">${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code class="discord-inline-code">$1</code>');

    // Headers
    html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^>\s+(.*)$/gm, '<div class="discord-quote-container"><div class="discord-quote-divider"></div><blockquote>$1</blockquote></div>');
    
    // Spoilers
    html = html.replace(/\|\|([\s\S]*?)\|\|/g, '<span class="discord-spoiler">$1</span>');

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Underline __text__
    html = html.replace(/__([^_]+)__/g, '<u>$1</u>');

    // Italic *text* or _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough ~~text~~
    html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');

    // Subtext -# text
    html = html.replace(/^-#\s+(.+)$/gm, '<span class="discord-subtext">$1</span>');

    // Mentions <@ID>, <#ID>, <@&ID>
    html = html.replace(/&lt;@!?(\d+)&gt;/g, (match, id) => {
        let name = 'Kullanıcı';
        if (guild && guild.members && guild.members.cache.has(id)) {
            name = guild.members.cache.get(id).user.tag || guild.members.cache.get(id).user.username;
        } else if (guild && guild.client && guild.client.users.cache.has(id)) {
            name = guild.client.users.cache.get(id).tag || guild.client.users.cache.get(id).username;
        }
        return `<span class="discord-mention" title="Kullanıcı ID: ${id}">@${escapeHtml(name)} <span style="font-size: 0.8em; opacity: 0.7;">(${id})</span></span>`;
    });
    
    html = html.replace(/&lt;#(\d+)&gt;/g, (match, id) => {
        let name = 'kanal';
        if (guild && guild.channels && guild.channels.cache.has(id)) {
            name = guild.channels.cache.get(id).name;
        }
        return `<span class="discord-mention" title="Kanal ID: ${id}">#${escapeHtml(name)} <span style="font-size: 0.8em; opacity: 0.7;">(${id})</span></span>`;
    });
    
    html = html.replace(/&lt;@&amp;(\d+)&gt;/g, (match, id) => {
        let name = 'Rol';
        if (guild && guild.roles && guild.roles.cache.has(id)) {
            name = guild.roles.cache.get(id).name;
        }
        return `<span class="discord-mention" title="Rol ID: ${id}">@${escapeHtml(name)} <span style="font-size: 0.8em; opacity: 0.7;">(${id})</span></span>`;
    });

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function generateDiscordTranscriptHtml({ guild, channel, messages, ticketData, groupWindowMs = 300000 }) {
    const guildName = escapeHtml(guild ? guild.name : 'TurkLion Network');
    const guildIcon = guild && guild.iconURL ? guild.iconURL({ size: 128, extension: 'png' }) : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const channelName = escapeHtml(channel ? channel.name : 'destek-ticket');
    
    const ticketId = ticketData ? ticketData.id : '---';
    const ticketOwner = escapeHtml(ticketData ? ticketData.owner_tag : 'Kullanıcı');
    const ticketCategory = escapeHtml(ticketData ? ticketData.category || 'Genel' : 'Genel');
    const ticketReason = escapeHtml(ticketData ? ticketData.reason || 'Belirtilmemiş' : 'Belirtilmemiş');
    const ticketDate = ticketData && ticketData.opened_at ? new Date(ticketData.opened_at).toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR');

    const msgsUser = messages.filter(m => m.author_id === (ticketData ? ticketData.owner_id : '')).length;
    const msgsBot = messages.filter(m => m.author && m.author.bot).length;
    const msgsStaff = messages.length - msgsUser - msgsBot;
    
    let firstStaffResponse = 'Yok';
    if (ticketData && ticketData.opened_at) {
        const staffMsgs = messages.filter(m => m.author_id !== ticketData.owner_id && (!m.author || !m.author.bot));
        if (staffMsgs.length > 0) {
            const diffMs = staffMsgs[0].createdTimestamp - new Date(ticketData.opened_at).getTime();
            if (diffMs > 0) {
                const diffMins = Math.floor(diffMs / 60000);
                firstStaffResponse = diffMins > 0 ? `${diffMins} dakika` : '1 dakikadan az';
            }
        }
    }
    
    let durationStr = 'Bilinmiyor';
    if (ticketData && ticketData.opened_at) {
        const durMs = Date.now() - new Date(ticketData.opened_at).getTime();
        const durHrs = Math.floor(durMs / 3600000);
        const durMins = Math.floor((durMs % 3600000) / 60000);
        durationStr = `${durHrs > 0 ? durHrs + ' saat ' : ''}${durMins} dakika`;
    }

    let messagesHtml = '';
    let lastAuthorId = null;
    let lastTimestamp = 0;

    for (const msg of messages) {
        let rawAuthorName = msg.author_tag || 'Kullanıcı';
        if (msg.author) {
            rawAuthorName = msg.author.displayName || msg.author.username || msg.author.tag || rawAuthorName;
        }
        const authorName = escapeHtml(rawAuthorName);

        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (msg.author && typeof msg.author.displayAvatarURL === 'function') {
            avatarUrl = msg.author.displayAvatarURL({ size: 128, extension: 'png' });
        } else if (msg.author_avatar && msg.author_avatar.startsWith('http')) {
            avatarUrl = msg.author_avatar;
        }

        const isBot = Boolean(msg.author && msg.author.bot);
        const isDeleted = msg.is_deleted || false;
        const isEdited = msg.is_edited || false;
        
        const timestamp = msg.createdTimestamp || (msg.created_at ? new Date(msg.created_at).getTime() : Date.now());
        const dateStr = new Date(timestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const authorId = msg.author ? msg.author.id : (msg.author_id || rawAuthorName);
        const isGrouped = !isDeleted && lastAuthorId === authorId && (timestamp - lastTimestamp < groupWindowMs);
        if (!isDeleted) {
            lastAuthorId = authorId;
            lastTimestamp = timestamp;
        }

        let contentParsed = parseDiscordMarkdown(msg.content || msg.edited_content || '', guild);
        let oldContentParsed = '';

        if (msg.old_content) oldContentParsed = parseDiscordMarkdown(msg.old_content, guild);
        
        const deletedBadge = isDeleted ? '<span class="discord-deleted-badge">SILINMIS MESAJ</span>' : '';
        let editedBadge = isEdited ? '<span class="discord-edited-badge">(duzenlendi)</span>' : '';

        // Attachments HTML
        let attachmentsHtml = '';
        let attList = [];
        if (msg.attachments && msg.attachments.size > 0) {
            attList = Array.from(msg.attachments.values());
        } else if (msg.attachments_json) {
            try { attList = typeof msg.attachments_json === 'string' ? JSON.parse(msg.attachments_json) : msg.attachments_json; } catch(e){}
        }

        if (attList && attList.length > 0) {
            attachmentsHtml += '<div class="discord-attachments">';
            for (const att of attList) {
                const filename = escapeHtml(att.name || 'dosya');
                const url = att.permanent_url || att.proxy_url || att.url || '#';
                const sizeStr = formatBytes(att.size);
                
                let ext = '';
                if (att.contentType) ext = att.contentType.split('/')[1] || '';
                if (!ext && att.name && att.name.includes('.')) ext = att.name.split('.').pop().toLowerCase();
                if (!ext && url) {
                    const cleanUrl = url.split('?')[0];
                    if (cleanUrl.includes('.')) ext = cleanUrl.split('.').pop().toLowerCase();
                }

                if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                    attachmentsHtml += `
                        <div class="discord-image-attachment">
                            <a href="${url}" target="_blank" rel="noopener noreferrer">
                                <img src="${url}" alt="${filename}" loading="lazy" />
                            </a>
                        </div>`;
                } else if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
                    attachmentsHtml += `
                        <div class="discord-media-attachment">
                            <video controls preload="metadata">
                                <source src="${url}" type="video/${ext === 'mov' ? 'mp4' : ext}">
                                Tarayıcınız video oynatmayı desteklemiyor.
                            </video>
                        </div>`;
                } else if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
                    attachmentsHtml += `
                        <div class="discord-audio-attachment">
                            <audio controls preload="metadata" src="${url}"></audio>
                        </div>`;
                } else {
                    attachmentsHtml += `
                        <div class="discord-file-card">
                            <div class="discord-file-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z"/>
                                </svg>
                            </div>
                            <div class="discord-file-info">
                                <a class="discord-file-name" href="${url}" target="_blank" rel="noopener noreferrer" download="${filename}">${filename}</a>
                                <span class="discord-file-size">${sizeStr}</span>
                            </div>
                            <a class="discord-file-download" href="${url}" target="_blank" rel="noopener noreferrer" download="${filename}" title="İndir">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                                </svg>
                            </a>
                        </div>`;
                }
            }
            attachmentsHtml += '</div>';
        }

        // Stickers HTML
        let stickersHtml = '';
        let stickersList = [];
        if (msg.stickers && msg.stickers.size > 0) {
            stickersList = Array.from(msg.stickers.values());
        } else if (msg.stickers_json) {
            try { stickersList = typeof msg.stickers_json === 'string' ? JSON.parse(msg.stickers_json) : msg.stickers_json; } catch(e){}
        }

        if (stickersList && stickersList.length > 0) {
            stickersHtml += '<div class="discord-attachments">';
            for (const sticker of stickersList) {
                const stickerUrl = sticker.url || `https://media.discordapp.net/stickers/${sticker.id}.png`;
                stickersHtml += `
                    <div class="discord-image-attachment">
                        <img src="${stickerUrl}" alt="${escapeHtml(sticker.name || 'Çıkartma')}" title="${escapeHtml(sticker.name || 'Çıkartma')}" loading="lazy" style="width: 160px; height: 160px; object-fit: contain;" />
                    </div>`;
            }
            stickersHtml += '</div>';
        }


        // Check for inline Tenor / Giphy / Direct Image URLs in content
        if (msg.content && (!attList || attList.length === 0)) {
            const urlRegex = /(https?:\/\/[^\s<]+)/g;
            const matches = msg.content.match(urlRegex);
            if (matches) {
                for (const matchUrl of matches) {
                    const clean = matchUrl.split('?')[0].toLowerCase();
                    if (clean.endsWith('.gif') || clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.webp') || matchUrl.includes('tenor.com') || matchUrl.includes('giphy.com')) {
                        let directImgUrl = matchUrl;
                        attachmentsHtml += `
                            <div class="discord-attachments">
                                <div class="discord-image-attachment">
                                    <a href="${directImgUrl}" target="_blank" rel="noopener noreferrer">
                                        <img src="${directImgUrl}" alt="GIF / Görsel" loading="lazy" />
                                    </a>
                                </div>
                            </div>`;
                    }
                }
            }
        }

        // Embeds HTML
        let embedsHtml = '';
        let embedsList = [];
        if (msg.embeds && msg.embeds.length > 0) {
            embedsList = msg.embeds;
        } else if (msg.embeds_json) {
            try { embedsList = typeof msg.embeds_json === 'string' ? JSON.parse(msg.embeds_json) : msg.embeds_json; } catch(e){}
        }

        if (embedsList && embedsList.length > 0) {
            for (const embed of embedsList) {
                const colorHex = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : '#2b2d31';
                const embedTitle = escapeHtml(embed.title);
                const embedDesc = parseDiscordMarkdown(embed.description, guild);

                let fieldsHtml = '';
                if (embed.fields && embed.fields.length > 0) {
                    fieldsHtml += '<div class="discord-embed-fields">';
                    for (const field of embed.fields) {
                        fieldsHtml += `
                            <div class="discord-embed-field ${field.inline ? 'inline' : ''}">
                                <div class="discord-embed-field-name">${escapeHtml(field.name)}</div>
                                <div class="discord-embed-field-value">${parseDiscordMarkdown(field.value, guild)}</div>
                            </div>`;
                    }
                    fieldsHtml += '</div>';
                }

                let footerHtml = '';
                if (embed.footer) {
                    footerHtml = `<div class="discord-embed-footer">${escapeHtml(embed.footer.text)}</div>`;
                }

                let imageHtml = '';
                if (embed.image && embed.image.url) {
                    imageHtml = `<div class="discord-embed-image"><img src="${embed.image.url}" loading="lazy" /></div>`;
                }

                embedsHtml += `
                    <div class="discord-embed">
                        ${embedTitle ? `<div class="discord-embed-title">${embedTitle}</div>` : ''}
                        ${embedDesc ? `<div class="discord-embed-description">${embedDesc}</div>` : ''}
                        ${fieldsHtml}
                        ${imageHtml}
                        ${footerHtml}
                    </div>`;
            }
        }

        let replyHtml = '';
        if (msg.reply_to_id) {
            const refMsg = messages.find(m => m.id === msg.reply_to_id);
            if (refMsg) {
                const refAuthorName = escapeHtml(refMsg.author_tag || 'Kullanıcı');
                let refContent = escapeHtml(refMsg.content || '');
                if (!refContent && refMsg.attachments_json) refContent = '[Dosya/Görsel]';
                if (!refContent && refMsg.embeds) refContent = '[Embed]';
                if (refContent.length > 50) refContent = refContent.substring(0, 50) + '...';
                
                replyHtml = `
                    <div class="discord-replied-message" style="margin-bottom: 4px; display: flex; align-items: center; color: #b5bac1; font-size: 14px;">
                        <span style="content: ''; display: inline-block; width: 30px; height: 12px; border-left: 2px solid #4e5058; border-top: 2px solid #4e5058; border-top-left-radius: 6px; margin-right: 4px; margin-bottom: 6px;"></span>
                        <img src="${refMsg.author_avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 4px;" />
                        <span style="font-weight: 500; margin-right: 4px;">@${refAuthorName}</span>
                        <span style="cursor: pointer;">${refContent}</span>
                    </div>`;
            }
        }

        let bodyHtml = '';
        if (msg.components && msg.components.length > 0) {
            const extractCompText = (comps) => {
                let t = '';
                if (!comps) return t;
                for (const c of comps) {
                    if (c.content) t += c.content + '\n';
                    if (c.data && c.data.content) t += c.data.content + '\n';
                    if (c.components) t += extractCompText(c.components);
                    if (c.data && c.data.components) t += extractCompText(c.data.components);
                }
                return t;
            };
            const compText = extractCompText(msg.components).trim();
            if (compText) {
                contentParsed += (contentParsed ? '<br><br>' : '') + '<div class="discord-v2-container">' + parseDiscordMarkdown(compText, guild) + '</div>';
            }
        }
        
        if (isDeleted) {
            bodyHtml = `
                <div class="discord-deleted-box">
                    <strong>Silinen Mesaj Icerigi:</strong><br>
                    ${contentParsed}
                </div>`;
        } else if (isEdited && oldContentParsed) {
            bodyHtml = `
                <div class="discord-edit-box">
                    <div class="discord-edit-old"><strong>Orijinal (Eski):</strong> ${oldContentParsed}</div>
                    <div class="discord-edit-new"><strong>Duzenlenmis (Yeni):</strong> ${contentParsed}</div>
                </div>`;
        } else {
            bodyHtml = contentParsed ? `<div class="discord-text">${contentParsed} ${editedBadge}</div>` : '';
        }

        if (msg.is_pinned) {
            editedBadge += ' <span style="color: #ed4245; font-size: 0.8em; margin-left: 6px; font-weight: bold; background: rgba(237, 66, 69, 0.1); padding: 2px 4px; border-radius: 4px;">📌 SABİTLENDİ</span>';
        }

        if (isGrouped) {
            messagesHtml += `
                <div class="discord-message grouped ${isDeleted ? 'is-deleted' : ''}">
                    <div class="discord-avatar-space">
                        <span class="discord-timestamp-short">${dateStr.split(' ')[1]}</span>
                    </div>
                    <div class="discord-message-body">
                        <div class="discord-message-content">
                            ${replyHtml}
                            ${bodyHtml}
                            ${attachmentsHtml}
                            ${stickersHtml}
                            ${embedsHtml}
                        </div>
                    </div>
                </div>`;
        } else {
            messagesHtml += `
                <div class="discord-message ${isDeleted ? 'is-deleted' : ''}">
                    <div class="discord-avatar">
                        <img src="${avatarUrl}" alt="${authorName}" />
                    </div>
                    <div class="discord-message-body">
                        <div class="discord-message-header">
                            <span class="discord-author-name" title="ID: ${authorId}">${authorName} <span style="font-size: 0.8em; color: #80848e; font-weight: normal;">(${authorId})</span></span>
                            ${isBot ? '<span class="discord-bot-badge">BOT</span>' : ''}
                            <span class="discord-timestamp" title="Message ID: ${msg.id}">${dateStr} <span style="font-size: 0.9em; margin-left: 6px;">| Mesaj ID: ${msg.id || 'Bilinmiyor'}</span></span>
                            ${deletedBadge}
                        </div>
                        <div class="discord-message-content">
                            ${replyHtml}
                            ${bodyHtml}
                            ${attachmentsHtml}
                            ${stickersHtml}
                            ${embedsHtml}
                        </div>
                    </div>
                </div>`;
        }
    }

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket #${ticketId} Transcript - ${guildName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #1e1f22;
            --bg-secondary: #2b2d31;
            --bg-chat: #313338;
            --bg-modifier: rgba(255, 255, 255, 0.04);
            --text-normal: #dbdee1;
            --text-muted: #949ba4;
            --text-header: #f2f3f5;
            --brand-color: #5865f2;
            --border-subtle: #3f4147;
            --mention-bg: rgba(88, 101, 242, 0.15);
            --code-bg: #2b2d31;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', 'gg sans', 'Noto Sans', sans-serif;
            background-color: var(--bg-chat);
            color: var(--text-normal);
            font-size: 15px;
            line-height: 1.375;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }

        /* Top Bar Header */
        .discord-top-bar {
            height: 48px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--bg-dark);
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 12px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .discord-guild-icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            object-fit: cover;
        }

        .discord-channel-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            color: var(--text-header);
            font-size: 16px;
        }

        .discord-hashtag {
            color: var(--text-muted);
            font-size: 20px;
            font-weight: 400;
        }

        .discord-header-badge {
            background-color: var(--brand-color);
            color: #fff;
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 12px;
            margin-left: auto;
        }

        /* Container */
        .discord-app-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
            padding: 20px 16px;
        }

        /* Native Channel Start Header */
        .discord-channel-start {
            margin: 16px 0 24px 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .discord-channel-start-icon {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            background-color: var(--border-subtle);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-header);
            margin-bottom: 8px;
        }

        .discord-channel-start-title {
            font-size: 32px;
            font-weight: 700;
            color: var(--text-header);
        }

        .discord-channel-start-desc {
            font-size: 15px;
            color: var(--text-muted);
        }

        /* Message List */
        .discord-messages-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .discord-message {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 16px;
            padding: 6px 12px;
            border-radius: 4px;
            transition: background-color 0.1s ease;
        }

        .discord-message:hover {
            background-color: var(--bg-modifier);
        }

        .discord-message.grouped {
            padding-top: 2px;
            padding-bottom: 2px;
        }

        .discord-avatar {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
            margin-top: 2px;
            border-radius: 50%;
            overflow: hidden;
        }

        .discord-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .discord-avatar-space {
            width: 40px;
            flex-shrink: 0;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding-right: 4px;
        }

        .discord-timestamp-short {
            font-size: 11px;
            color: var(--text-muted);
            opacity: 0;
            transition: opacity 0.1s ease;
        }

        .discord-message:hover .discord-timestamp-short {
            opacity: 1;
        }

        .discord-message-body {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
        }

        .discord-message-header {
            display: flex;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 2px;
            line-height: 1.375;
        }

        .discord-author-name {
            font-weight: 600;
            color: var(--text-header);
            font-size: 16px;
        }

        .discord-bot-badge {
            background-color: var(--brand-color);
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            line-height: 1.2;
            align-self: center;
        }

        .discord-timestamp {
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .discord-deleted-badge {
            background-color: #da373c;
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 3px;
            letter-spacing: 0.5px;
            margin-left: 4px;
        }

        .discord-edited-badge {
            color: var(--text-muted);
            font-size: 11px;
            margin-left: 4px;
        }

        .discord-message.is-deleted {
            background-color: rgba(218, 55, 60, 0.08);
            border-left: 3px solid #da373c;
        }

        .discord-deleted-box {
            background-color: rgba(218, 55, 60, 0.12);
            border: 1px solid rgba(218, 55, 60, 0.4);
            border-radius: 6px;
            padding: 8px 12px;
            margin-top: 4px;
            color: #f2f3f5;
            font-size: 14px;
        }

        .discord-edit-box {
            background-color: rgba(88, 101, 242, 0.1);
            border: 1px solid rgba(88, 101, 242, 0.3);
            border-radius: 6px;
            padding: 8px 12px;
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .discord-edit-old {
            color: #949ba4;
            font-size: 13px;
        }

        .discord-edit-new {
            color: #dbdee1;
            font-weight: 500;
            font-size: 15px;
        }

        .discord-message-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 2px;
        }

        .discord-text {
            font-size: 15px;
            color: var(--text-normal);
            line-height: 1.375;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .discord-subtext {
            font-size: 12px;
            color: var(--text-muted);
        }

        .discord-mention {
            background-color: var(--mention-bg);
            color: #c9cdfb;
            font-weight: 500;
            padding: 0 4px;
            border-radius: 3px;
        }

        .discord-inline-code {
            background-color: var(--code-bg);
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
            padding: 2px 4px;
            border-radius: 3px;
        }

        .discord-code-block {
            background-color: var(--code-bg);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            padding: 10px;
            margin-top: 6px;
            overflow-x: auto;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
        }

        /* Markdown Elements */
        h1, h2, h3 {
            color: var(--text-header);
            font-weight: 700;
            margin-bottom: 4px;
            margin-top: 8px;
        }
        h1 { font-size: 1.5rem; }
        h2 { font-size: 1.25rem; }
        h3 { font-size: 1.125rem; }

        .discord-quote-container {
            display: flex;
            margin-top: 4px;
            margin-bottom: 4px;
        }

        .discord-quote-divider {
            width: 4px;
            border-radius: 4px;
            background-color: #4e5058;
            margin-right: 8px;
        }

        blockquote {
            margin: 0;
            padding: 0;
            color: var(--text-normal);
        }

        .discord-spoiler {
            background-color: #1e1f22;
            color: transparent;
            border-radius: 4px;
            padding: 0 2px;
            cursor: pointer;
        }

        .discord-spoiler:active {
            background-color: rgba(255, 255, 255, 0.1);
            color: inherit;
        }

        /* Attachments */
        .discord-attachments {
            margin-top: 6px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .discord-image-attachment img {
            max-width: 100%;
            max-height: 380px;
            border-radius: 8px;
            border: 1px solid var(--border-subtle);
            object-fit: contain;
        }

        .discord-media-attachment video {
            max-width: 100%;
            max-height: 380px;
            border-radius: 8px;
        }

        .discord-audio-attachment audio {
            width: 100%;
            max-width: 400px;
        }

        .discord-file-card {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 420px;
        }

        .discord-file-icon {
            color: var(--brand-color);
            display: flex;
        }

        .discord-file-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .discord-file-name {
            color: #00a8fc;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .discord-file-name:hover {
            text-decoration: underline;
        }

        .discord-file-size {
            font-size: 12px;
            color: var(--text-muted);
        }

        .discord-file-download {
            color: var(--text-muted);
            transition: color 0.15s ease;
        }

        .discord-file-download:hover {
            color: var(--text-header);
        }

        /* Embeds */
        .discord-embed {
            background-color: var(--bg-secondary);
            border-radius: 4px;
            padding: 8px 16px 16px 12px;
            margin-top: 4px;
            max-width: 520px;
            display: grid;
            grid-template-columns: auto;
            gap: 8px;
            box-sizing: border-box;
        }

        .discord-embed-title {
            font-weight: 600;
            color: var(--text-header);
            font-size: 1rem;
            margin-top: 8px;
        }

        .discord-embed-description {
            font-size: 0.875rem;
            line-height: 1.125rem;
            color: var(--text-normal);
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .discord-embed-fields {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-top: 8px;
        }

        .discord-embed-field {
            grid-column: span 3;
        }

        .discord-embed-field.inline {
            grid-column: span 1;
        }

        .discord-embed-field-name {
            font-weight: 600;
            font-size: 0.875rem;
            color: var(--text-header);
            margin-bottom: 2px;
        }

        .discord-embed-field-value {
            font-size: 0.875rem;
            color: var(--text-normal);
            line-height: 1.125rem;
            white-space: pre-wrap;
        }

        .discord-embed-footer {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 8px;
            display: flex;
            align-items: center;
        }

        .discord-embed-image img {
            max-width: 400px;
            max-height: 300px;
            border-radius: 4px;
            margin-top: 16px;
            object-fit: contain;
        }

        /* Footer Copyright */
        .discord-footer {
            margin-top: auto;
            padding: 24px 16px;
            text-align: center;
            font-size: 13px;
            color: var(--text-muted);
            border-top: 1px solid var(--border-subtle);
            background-color: var(--bg-secondary);
        }

        @media (max-width: 600px) {
            .discord-welcome-meta {
                grid-template-columns: 1fr;
            }
            .discord-file-card {
                max-width: 100%;
            }
            .discord-embed {
                max-width: 100%;
            }
        }
        
        .discord-v2-container {
            background-color: #2b2d31;
            border-radius: 8px;
            padding: 12px 16px;
            margin-top: 6px;
            margin-bottom: 6px;
            max-width: 520px;
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <!-- Top Navigation Bar -->
    <header class="discord-top-bar">
        <img class="discord-guild-icon" src="${guildIcon}" alt="${guildName}" />
        <div class="discord-channel-title">
            <span class="discord-hashtag">#</span>
            <span>${channelName}</span>
        </div>
        <span class="discord-header-badge">Ticket #${ticketId}</span>
    </header>

    <main class="discord-app-container">
        <!-- Native Discord Channel Start Header -->
        <div class="discord-channel-start">
            <div class="discord-channel-start-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.50001C2.18891 17 1.95334 16.7189 2.00771 16.4126L2.36226 14.4126C2.40645 14.1633 2.62305 13.98 2.87657 13.98H5.46429L6.52001 8H3.02001C2.70891 8 2.47334 7.71891 2.52771 7.41261L2.88226 5.41261C2.92645 5.16334 3.14305 4.98 3.39657 4.98H5.98429L6.60001 1.5C6.65438 1.1937 6.88995 0.912607 7.20105 0.912607H9.20105C9.45457 0.912607 9.67117 1.09595 9.71536 1.34522L9.36081 3.34522C9.31662 3.59449 9.10002 3.77783 8.8465 3.77783H6.25878L5.20306 9.77783H11.2031L12.2588 3.77783H9.67108C9.41756 3.77783 9.20096 3.59449 9.24515 3.34522L9.5997 1.34522C9.64389 1.09595 9.86049 0.912607 10.114 0.912607H12.114C12.4251 0.912607 12.6607 1.1937 12.6063 1.5L11.9906 4.98H15.4906C15.8017 4.98 16.0373 5.26109 15.9829 5.56739L15.6283 7.56739C15.5841 7.81666 15.3675 8 15.114 8H12.5263L11.4706 14H14.9706C15.2817 14 15.5173 14.2811 15.4629 14.5874L15.1083 16.5874C15.0641 16.8367 14.8475 17 14.594 17H12.0063L11.3906 20.5C11.3362 20.8063 11.1006 21.0874 10.7895 21.0874H8.78952C8.536 21.0874 8.3194 20.904 8.27521 20.6548L8.62976 18.6548H6.25878L5.88657 21Z"/>
                </svg>
            </div>
            <h1 class="discord-channel-start-title">#${channelName} kanalına hoş geldiniz!</h1>
            <p class="discord-channel-start-desc">Bu, #${channelName} destek kanalının başlangıcıdır.</p>
        </div>
        
        <div style="background: rgba(43, 45, 49, 0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin: 16px 16px 24px 16px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
            <div style="font-weight: 600; color: #f2f3f5; font-size: 16px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #5865f2;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Bilet İstatistikleri ve Rapor
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #949ba4;">AÇIK KALMA SÜRESİ</span>
                    <span style="font-size: 14px; color: #dbdee1; font-weight: 500;">${durationStr}</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #949ba4;">İLK YETKİLİ YANITI</span>
                    <span style="font-size: 14px; color: #dbdee1; font-weight: 500;">${firstStaffResponse}</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #949ba4;">TOPLAM MESAJ</span>
                    <span style="font-size: 14px; color: #dbdee1; font-weight: 500;">${messages.length} <span style="font-size: 12px; color: #80848e;">(${msgsUser} K. / ${msgsStaff} Y. / ${msgsBot} S.)</span></span>
                </div>
            </div>
        </div>

        <!-- Messages Flow -->
        <section class="discord-messages-list">
            ${messagesHtml}
        </section>
    </main>

    <footer class="discord-footer">
        <p>TurkLion Network &copy; 2026 - Lisanslı Güvenlik & Destek Transcript Sistemi</p>
    </footer>
</body>
</html>`;
}

function generateDiscordTranscriptText({ guild, channel, messages, ticketData }) {
    const channelName = channel ? channel.name : 'destek';
    const guildName = guild ? guild.name : 'TurkLion Network';
    const ticketId = ticketData ? ticketData.id : 'DETAY';
    const ticketOwner = ticketData ? ticketData.owner_tag : 'Kullanıcı';
    const ticketCategory = ticketData ? (ticketData.category || 'Genel') : 'Genel';
    const ticketReason = ticketData ? (ticketData.reason || 'Belirtilmedi') : 'Belirtilmedi';
    const ticketDate = ticketData ? new Date(ticketData.opened_at).toLocaleString('tr-TR') : 'Bilinmiyor';

    let txt = '='.repeat(80) + '\n';
    txt += `                       TURKLION NETWORK DETAYLI BİLET TRANSCRİPTİ\n`;
    txt += '='.repeat(80) + '\n';
    txt += `Bilet Kodu    : #${ticketId}\n`;
    txt += `Kanal Adı     : #${channelName}\n`;
    txt += `Sunucu        : ${guildName}\n`;
    txt += `Talep Sahibi  : ${ticketOwner}\n`;
    txt += `Kategori      : ${ticketCategory}\n`;
    txt += `Açılış Tarihi : ${ticketDate}\n`;
    txt += `Kapanış Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
    txt += `Konu / Sebep  : ${ticketReason}\n`;
    txt += '='.repeat(80) + '\n';
    txt += `                                SOHBET GEÇMİŞİ\n`;
    txt += '='.repeat(80) + '\n\n';

    for (const msg of messages) {
        const rawTs = msg.createdTimestamp || (msg.created_at ? new Date(msg.created_at).getTime() : Date.now());
        const validTs = isNaN(rawTs) ? Date.now() : rawTs;
        const dateStr = new Date(validTs).toLocaleString('tr-TR');
        const authorTag = msg.author_tag || (msg.author ? msg.author.tag : 'Kullanıcı');
        const isBot = Boolean(msg.author && msg.author.bot) ? ' [BOT]' : '';
        const isDeleted = msg.is_deleted ? ' [SİLİNMİŞ MESAJ]' : '';
        const isEdited = msg.is_edited ? ' (düzenlendi)' : '';

        txt += `[${dateStr}] ${authorTag}${isBot}${isDeleted}${isEdited}:\n`;

        if (msg.is_deleted) {
            txt += `   Silinen Mesaj İçeriği: ${msg.content || msg.edited_content || 'İçerik Yok'}\n`;
        } else if (msg.is_edited && msg.old_content) {
            txt += `   Orijinal (Eski): ${msg.old_content}\n`;
            txt += `   Düzenlenmiş (Yeni): ${msg.content || msg.edited_content || ''}\n`;
        } else if (msg.content) {
            txt += `   ${msg.content}\n`;
        }

        // Attachments in TXT
        let attList = [];
        if (msg.attachments && msg.attachments.size > 0) {
            attList = Array.from(msg.attachments.values());
        } else if (msg.attachments_json) {
            try { attList = typeof msg.attachments_json === 'string' ? JSON.parse(msg.attachments_json) : msg.attachments_json; } catch(e){}
        }

        if (attList && attList.length > 0) {
            for (const att of attList) {
                const name = att.name || 'dosya';
                const url = att.url || att.proxy_url || 'Yok';
                const sizeStr = formatBytes(att.size);
                const localStr = att.local_path ? ` | Yerel Yedek: ${att.local_path}` : '';
                txt += `   ↳ [Ek Dosya: ${name}] (Boyut: ${sizeStr} | URL: ${url}${localStr})\n`;
            }
        }

        // Embeds in TXT
        let embedsList = [];
        if (msg.embeds && msg.embeds.length > 0) {
            embedsList = msg.embeds;
        } else if (msg.embeds_json) {
            try { embedsList = typeof msg.embeds_json === 'string' ? JSON.parse(msg.embeds_json) : msg.embeds_json; } catch(e){}
        }

        if (embedsList && embedsList.length > 0) {
            for (const embed of embedsList) {
                txt += `   ↳ [Embed Kartı: ${embed.title || 'Başlıksız'}]\n`;
                if (embed.description) txt += `      Açıklama: ${embed.description}\n`;
                if (embed.fields && embed.fields.length > 0) {
                    for (const f of embed.fields) {
                        txt += `      • ${f.name}: ${f.value}\n`;
                    }
                }
            }
        }
        txt += '\n';
    }

    txt += '='.repeat(80) + '\n';
    txt += `TurkLion Network Security & Audit System © 2026 - Lisanslı Transcript Dökümü\n`;
    txt += '='.repeat(80) + '\n';

    return txt;
}

module.exports = { generateDiscordTranscriptHtml, generateDiscordTranscriptText };
