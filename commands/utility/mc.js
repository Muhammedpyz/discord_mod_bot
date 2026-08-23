'use strict';

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { createV2Container, createContainerMessage, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');
const https = require('https');

function fetchJson(url) {
    return new Promise(resolve => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (DiscordBot-Nyx/2.0; +https://turklion.net)' },
            timeout: 5000
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

async function fetchMojangData(rawUsername) {
    // 1. Kullanıcı adı üzerinden UUID ve temel profil al
    const profile = await fetchJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(rawUsername)}`);
    if (!profile || !profile.id) {
        return { profile: null, session: null, textureUrl: null, textureHash: null, model: 'classic (Steve)' };
    }

    // 2. UUID üzerinden oturum sunucusundan en güncel anlık skin texture verisini al (Önbelleksiz)
    const session = await fetchJson(`https://sessionserver.mojang.com/session/minecraft/profile/${profile.id}?unsigned=false`);
    let textureUrl = null;
    let textureHash = null;
    let model = 'classic (Steve)';

    if (session && Array.isArray(session.properties)) {
        const texProp = session.properties.find(p => p.name === 'textures');
        if (texProp && texProp.value) {
            try {
                const decoded = JSON.parse(Buffer.from(texProp.value, 'base64').toString('utf8'));
                if (decoded && decoded.textures && decoded.textures.SKIN) {
                    textureUrl = decoded.textures.SKIN.url || null;
                    if (textureUrl) {
                        const parts = textureUrl.split('/');
                        textureHash = parts[parts.length - 1];
                    }
                    if (decoded.textures.SKIN.metadata && decoded.textures.SKIN.metadata.model === 'slim') {
                        model = 'slim (Alex)';
                    } else {
                        model = 'classic (Steve)';
                    }
                }
            } catch (e) {}
        }
    }

    return { profile, session, textureUrl, textureHash, model };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mc')
        .setDescription('Minecraft oyuncusunun en güncel 3D skin modelini ve detaylarını gösterir.')
        .addStringOption(opt => 
            opt.setName('kullanici_adi')
               .setDescription('Minecraft oyuncusunun kullanıcı adı')
               .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const rawUsername = interaction.options.getString('kullanici_adi').trim();
        const { profile, textureUrl, textureHash, model } = await fetchMojangData(rawUsername);

        // Eğer kullanıcı adı Mojang'da bulunamadıysa ve geçersizse
        if (!profile && /[^a-zA-Z0-9_]/.test(rawUsername)) {
            const errPayload = createContainerMessage(
                `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Oyuncu Bulunamadı`,
                `**"${rawUsername}"** adına sahip geçerli bir Minecraft oyuncusu bulunamadı. Lütfen kullanıcı adını kontrol edin.`,
                '#ED4245'
            );
            errPayload.flags = MessageFlags.IsComponentsV2;
            return await interaction.editReply(errPayload);
        }

        const username = profile ? profile.name : rawUsername;
        const rawUuid = profile ? profile.id : null;
        const formattedUuid = rawUuid ? rawUuid.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5') : 'Bilinmiyor';

        // Discord CDN ve Render önbelleğini kırmak için dinamik timestamp & hash
        const cacheBuster = `t=${textureHash || Date.now()}`;
        const targetId = rawUuid || encodeURIComponent(username);

        // Güvenilir ve Gerçek Zamanlı HD Render Motorları (MC-Heads & Minotar)
        const fullRenderUrl = `https://mc-heads.net/body/${targetId}/832?${cacheBuster}`;
        const perspectiveRenderUrl = `https://mc-heads.net/player/${targetId}/832?${cacheBuster}`;
        const avatarUrl = `https://mc-heads.net/avatar/${targetId}/512?${cacheBuster}`;
        const skinDownloadUrl = textureUrl || `https://mc-heads.net/skin/${targetId}`;
        const nameMcUrl = `https://namemc.com/profile/${encodeURIComponent(username)}`;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Skini İndir (HD)')
                .setStyle(ButtonStyle.Link)
                .setURL(skinDownloadUrl)
                .setEmoji(MONO_EMOJIS.file || '1537768043151630437'),
            new ButtonBuilder()
                .setLabel('3D Perspektif Model')
                .setStyle(ButtonStyle.Link)
                .setURL(perspectiveRenderUrl)
                .setEmoji(MONO_EMOJIS.gamepad || '1537767830722842654'),
            new ButtonBuilder()
                .setLabel('Boydan Görünüm')
                .setStyle(ButtonStyle.Link)
                .setURL(fullRenderUrl)
                .setEmoji(MONO_EMOJIS.scan_face || '1537768203395145778'),
            new ButtonBuilder()
                .setLabel('NameMC Profili')
                .setStyle(ButtonStyle.Link)
                .setURL(nameMcUrl)
                .setEmoji(MONO_EMOJIS.website || '1530917521174302840')
        );

        const payload = createV2Container({
            title: `Minecraft Görünümü — ${username}`,
            description: [
                `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Oyuncu:** \`${username}\``,
                `<:mono:${MONO_EMOJIS.fingerprint || '1537768148890030080'}> **UUID:** \`${formattedUuid}\``,
                `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Model Türü:** \`${model}\``,
                `<:mono:${MONO_EMOJIS.layers || '1537769790653861958'}> **Render Motoru:** \`MC-Heads 3D Ultra HD (Canlı Senkronize)\``
            ].join('\n'),
            color: COLORS.SUCCESS,
            thumbnail: avatarUrl,
            images: [
                fullRenderUrl,
                perspectiveRenderUrl
            ],
            actionRows: [row]
        });

        await interaction.editReply(payload);
    }
};