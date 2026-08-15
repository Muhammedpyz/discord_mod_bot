const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { Resvg } = require('@resvg/resvg-js');

const BG_PATH = path.join(__dirname, '../assets/welcome_bg_pattern.jpg');
const BADGES_DIR = path.join(__dirname, '../assets/badges');

let cachedBgBuffer = null;
const badgeCache = new Map();

async function getCachedBg() {
    if (cachedBgBuffer) return cachedBgBuffer;
    if (fs.existsSync(BG_PATH)) {
        cachedBgBuffer = await Jimp.read(BG_PATH);
        return cachedBgBuffer;
    }
    return null;
}

function getBadgeBase64(filename) {
    if (badgeCache.has(filename)) return badgeCache.get(filename);
    const p = path.join(BADGES_DIR, filename);
    if (fs.existsSync(p)) {
        const b64 = fs.readFileSync(p).toString('base64');
        badgeCache.set(filename, b64);
        return b64;
    }
    return null;
}

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function wrapText(text, maxCharsPerLine = 48) {
    if (!text) return [];
    // remove markdown characters for card
    const clean = text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/[`*_~]/g, '')
        .trim();
    const rawLines = clean.split('\n');
    const lines = [];
    for (const rawLine of rawLines) {
        const words = rawLine.split(' ');
        let currentLine = '';
        for (const word of words) {
            if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                currentLine = (currentLine + ' ' + word).trim();
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
    }
    return lines.slice(0, 2); // Max 2 lines to preserve badges and avatar spacing
}

/**
 * Returns array of base64 PNG badge images for Discord User
 */
function resolveBadges(userFlags = [], isBooster = false, isOwner = false, isBot = false) {
    const badges = [];

    if (isOwner) {
        const b = getBadgeBase64('Server_owner.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('Staff')) {
        const b = getBadgeBase64('Discord_Staff.png') || getBadgeBase64('staff.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('Partner')) {
        const b = getBadgeBase64('discord_partner.png') || getBadgeBase64('partner.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('Hypesquad') || userFlags.includes('HypeSquadEvent')) {
        const b = getBadgeBase64('HypeSquad_Event.png') || getBadgeBase64('hypesquad_events.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('HypeSquadOnlineHouse1') || userFlags.includes('HouseBravery')) {
        const b = getBadgeBase64('HypeSquad_Bravery.png') || getBadgeBase64('bravery.png');
        if (b) badges.push(b);
    } else if (userFlags.includes('HypeSquadOnlineHouse2') || userFlags.includes('HouseBrilliance')) {
        const b = getBadgeBase64('HypeSquad_Brilliance.png') || getBadgeBase64('brilliance.png');
        if (b) badges.push(b);
    } else if (userFlags.includes('HypeSquadOnlineHouse3') || userFlags.includes('HouseBalance')) {
        const b = getBadgeBase64('HypeSquad_Balance.png') || getBadgeBase64('balance.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('BugHunterLevel2')) {
        const b = getBadgeBase64('Bug_Hunter_level2.png') || getBadgeBase64('bughunter_2.png');
        if (b) badges.push(b);
    } else if (userFlags.includes('BugHunterLevel1')) {
        const b = getBadgeBase64('Bug_Hunter.png') || getBadgeBase64('bughunter_1.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('VerifiedDeveloper')) {
        const b = getBadgeBase64('Verified_Bot_Developer.png') || getBadgeBase64('developer.png');
        if (b) badges.push(b);
    } else if (userFlags.includes('ActiveDeveloper')) {
        const b = getBadgeBase64('developer.png') || getBadgeBase64('Verified_Bot_Developer.png');
        if (b) badges.push(b);
    }

    if (userFlags.includes('PremiumEarlySupporter')) {
        const b = getBadgeBase64('early_supporter.png');
        if (b) badges.push(b);
    }

    if (isBooster) {
        const b = getBadgeBase64('boost1month.png') || getBadgeBase64('boosting_1.png');
        if (b) badges.push(b);
    }

    if (isBooster || userFlags.includes('PremiumEarlySupporter')) {
        const b = getBadgeBase64('nitro.png');
        if (b) badges.push(b);
    }

    return badges;
}

/**
 * Generates an ultra-premium welcome or goodbye card with CS2 pattern, centered avatar, top-right count pill, official badges and multiline dynamic variables
 */
async function generateWelcomeCard({
    avatarUrl,
    username,
    customHeader,
    customSubtitle,
    guildName,
    memberCount,
    type = 'welcome',
    userFlags = [],
    isBooster = false,
    isOwner = false,
    isBot = false,
    showCountPill = true
}) {
    const cardW = 900;
    const cardH = 400;
    const isWelcome = type === 'welcome';

    try {
        // 1. Process Background Image with CS2 Random Pattern Crop
        let bgBase64 = '';
        const rawBg = await getCachedBg();
        if (rawBg) {
            const bgClone = rawBg.clone();
            bgClone.cover(1100, 750);

            const maxCropX = Math.max(0, bgClone.bitmap.width - cardW);
            const maxCropY = Math.max(0, bgClone.bitmap.height - cardH);
            const cropX = Math.floor(Math.random() * (maxCropX + 1));
            const cropY = Math.floor(Math.random() * (maxCropY + 1));

            bgClone.crop(cropX, cropY, cardW, cardH);
            if (Math.random() > 0.5) {
                bgClone.flip(true, false);
            }

            bgClone.color([{ apply: 'darken', params: [18] }]);
            const bgBuf = await bgClone.getBufferAsync(Jimp.MIME_JPEG);
            bgBase64 = bgBuf.toString('base64');
        }

        // 2. Process Avatar (Base64)
        let avatarBase64 = '';
        if (avatarUrl) {
            try {
                const pngUrl = avatarUrl.replace(/\.webp($|\?)/, '.png$1').replace(/\?size=\d+/, '?size=256');
                const ava = await Jimp.read(pngUrl);
                ava.resize(144, 144);
                const avaBuf = await ava.getBufferAsync(Jimp.MIME_PNG);
                avatarBase64 = avaBuf.toString('base64');
            } catch (avaErr) {
                console.error('Avatar load error in card generator:', avaErr);
            }
        }

        // 3. Colors & Theme
        const themeColor = isWelcome ? '#57F287' : '#ED4245';
        const gradStart = isWelcome ? '#5865F2' : '#ED4245';
        const gradEnd = isWelcome ? '#57F287' : '#FEE75C';

        // 4. Dynamic Titles & Subtitles (With Variables Support)
        const defaultTopHeader = isWelcome ? 'HOŞ GELDİN' : 'GÖRÜŞMEK ÜZERE';
        const topHeader = escapeXml(customHeader || defaultTopHeader);

        const safeGuild = guildName || 'Sunucu';
        const rawSubtitle = customSubtitle || (isWelcome ? `${safeGuild} sunucusuna katıldın` : `${safeGuild} sunucusundan ayrıldı`);
        const subLines = wrapText(rawSubtitle, 46);

        // 5. Username & Dynamic Font Sizing
        let safeUser = escapeXml(username || 'Kullanıcı');
        let userFontSize = 34;
        if (safeUser.length > 24) {
            safeUser = safeUser.substring(0, 22) + '...';
            userFontSize = 24;
        } else if (safeUser.length > 16) {
            userFontSize = 28;
        } else if (safeUser.length > 11) {
            userFontSize = 30;
        }

        // 6. Top-Right Count Pill Badge (If memberCount exists and showCountPill is enabled)
        let countPillHtml = '';
        if (showCountPill !== false && memberCount) {
            const memberTag = `#${memberCount}`;
            const badgeWidth = Math.max(75, memberTag.length * 12 + 30);
            countPillHtml = `
                <rect x="${cardW - badgeWidth - 25}" y="25" width="${badgeWidth}" height="34" rx="10" fill="rgba(15, 17, 22, 0.85)" stroke="${themeColor}" stroke-width="2" filter="url(#shadow)" />
                <text x="${cardW - 25 - badgeWidth / 2}" y="48" fill="${themeColor}" font-size="17" font-family="'Segoe UI', Inter, Roboto, sans-serif" font-weight="900" text-anchor="middle">
                    ${memberTag}
                </text>`;
        }

        // 7. Subtitle SVG Elements (Dynamic Multiline)
        let subtitleSvg = '';
        let badgesY = 348;
        if (subLines.length === 1) {
            subtitleSvg = `<text x="${cardW / 2}" y="298" fill="#E3E5E8" font-size="16" font-family="'Segoe UI', Inter, Roboto, sans-serif" font-weight="600" text-anchor="middle" filter="url(#textShadow)">${escapeXml(subLines[0])}</text>`;
            badgesY = 344;
        } else if (subLines.length >= 2) {
            subtitleSvg = `
                <text x="${cardW / 2}" y="292" fill="#E3E5E8" font-size="15" font-family="'Segoe UI', Inter, Roboto, sans-serif" font-weight="600" text-anchor="middle" filter="url(#textShadow)">${escapeXml(subLines[0])}</text>
                <text x="${cardW / 2}" y="316" fill="#DCDDDE" font-size="14" font-family="'Segoe UI', Inter, Roboto, sans-serif" font-weight="600" text-anchor="middle" filter="url(#textShadow)">${escapeXml(subLines[1])}</text>`;
            badgesY = 352;
        }

        // 8. Official Badges Row
        const badges = resolveBadges(userFlags, isBooster, isOwner, isBot);
        let badgesHtml = '';
        if (isBot) {
            badgesHtml = `
                <g transform="translate(${cardW / 2 - 20}, ${badgesY - 2})">
                    <rect width="40" height="20" rx="5" fill="#5865F2" filter="url(#shadow)"/>
                    <text x="20" y="14" fill="#FFFFFF" font-size="11" font-weight="900" font-family="'Segoe UI', Inter, sans-serif" text-anchor="middle">BOT</text>
                </g>`;
        } else if (badges.length > 0) {
            const bSize = 26;
            const bGap = 10;
            const totalW = badges.length * bSize + (badges.length - 1) * bGap;
            const startX = (cardW - totalW) / 2;
            badgesHtml = badges.map((b64, idx) => {
                const x = startX + idx * (bSize + bGap);
                return `<image href="data:image/png;base64,${b64}" x="${x}" y="${badgesY}" width="${bSize}" height="${bSize}" filter="url(#shadow)" />`;
            }).join('\n');
        }

        // 9. Vector SVG Construction
        const svg = `
        <svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <clipPath id="cardClip">
                    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="28" ry="28" />
                </clipPath>
                <clipPath id="avatarClip">
                    <circle cx="${cardW / 2}" cy="104" r="66" />
                </clipPath>
                <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${gradStart}" />
                    <stop offset="100%" stop-color="${gradEnd}" />
                </linearGradient>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.95" />
                </filter>
                <filter id="textShadow">
                    <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="1.0" />
                </filter>
                <filter id="glow">
                    <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${themeColor}" flood-opacity="0.7" />
                </filter>
            </defs>
            
            <g clip-path="url(#cardClip)">
                <!-- Background Layer (CS2-Style Space Wallpaper) -->
                ${bgBase64 ? `<image href="data:image/jpeg;base64,${bgBase64}" x="0" y="0" width="${cardW}" height="${cardH}" preserveAspectRatio="xMidYMid slice" />` : `<rect width="${cardW}" height="${cardH}" fill="#0D0E12" />`}
                
                <!-- Outer Illuminated Neon Card Border Frame -->
                <rect x="2" y="2" width="${cardW - 4}" height="${cardH - 4}" rx="28" fill="none" stroke="url(#avatarGrad)" stroke-width="2.5" />
                
                <!-- Top-Right Member Count Pill Badge -->
                ${countPillHtml}
                
                <!-- Avatar Outer Glowing Aura & Rings -->
                <circle cx="${cardW / 2}" cy="104" r="74" fill="none" stroke="url(#avatarGrad)" stroke-width="5" filter="url(#glow)" />
                <circle cx="${cardW / 2}" cy="104" r="68" fill="#121316" />
                
                <!-- Centered Avatar Image -->
                ${avatarBase64 
                    ? `<image href="data:image/png;base64,${avatarBase64}" x="${cardW / 2 - 66}" y="38" width="132" height="132" clip-path="url(#avatarClip)" />` 
                    : `<circle cx="${cardW / 2}" cy="104" r="66" fill="#2B2D31" />`
                }
                
                <!-- Small Glowing Header Text -->
                <text x="${cardW / 2}" y="206" fill="${themeColor}" font-size="14" font-family="'Segoe UI', Inter, Roboto, sans-serif" font-weight="900" text-anchor="middle" letter-spacing="3" filter="url(#shadow)">
                    ${topHeader}
                </text>
                
                <!-- Big Centered Username in Glowing Ultra-White -->
                <text x="${cardW / 2}" y="254" fill="#FFFFFF" font-size="${userFontSize}" font-family="'Segoe UI', Inter, Roboto, sans-serif" font-weight="900" text-anchor="middle" filter="url(#textShadow)">
                    ${safeUser}
                </text>
                
                <!-- Dynamic Multiline Subtitle with Clean Text -->
                ${subtitleSvg}
                
                <!-- Official Badges Row -->
                ${badgesHtml}
            </g>
        </svg>`;

        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: cardW },
            font: {
                loadSystemFonts: true,
                defaultFontFamily: 'sans-serif'
            }
        });

        const pngData = resvg.render();
        return pngData.asPng();
    } catch (err) {
        console.error('Welcome card generation error:', err);
        return null;
    }
}

module.exports = {
    generateWelcomeCard
};
