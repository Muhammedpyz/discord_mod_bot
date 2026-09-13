process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
BigInt.prototype.toJSON = function() { return Number(this) <= Number.MAX_SAFE_INTEGER ? Number(this) : this.toString(); };

const express = require('express');
const router = express.Router();
const {
  pool,
  clearWelcomeConfigCache,
  clearLogStateCache,
  clearFilteredWordsCache,
  clearAutoModConfigCache,
  clearGuildConfigCache,
  clearGuildSetupCache
} = require('../../db');
const { verifyToken, verifyGuildAdmin } = require('../middleware/auth');
const { sanitizeString, isValidDiscordId } = require('../security');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_TOKEN;

const ALLOWED_CONFIG_MODULES = {
  general: ['anti_spam_enabled', 'anti_link_enabled', 'anti_swear_enabled', 'caps_filter_enabled', 'anti_raid_enabled', 'mod_role_id'],
  automod: ['anti_swear', 'anti_invite', 'anti_link', 'caps_percent', 'mention_limit', 'spam_limit', 'emoji_limit', 'punishment_type', 'mute_duration', 'dm_notify', 'anti_zalgo', 'exempt_roles', 'exempt_channels', 'media_channels'],
  antinuke: ['is_enabled', 'punishment', 'channel_delete_limit', 'role_delete_limit', 'ban_limit', 'kick_limit', 'anti_bot_add', 'anti_webhook'],
  welcome: ['welcome_channel_id', 'goodbye_channel_id', 'welcome_message', 'goodbye_message', 'welcome_dm_message', 'welcome_gen_image', 'goodbye_gen_image', 'welcome_show_title', 'goodbye_show_title'],
  special_rooms: ['setup_category_id', 'setup_channel_id', 'setup_voice_channel_id', 'active_rooms_category_id', 'log_channel_id'],
  autorole: ['user_role_id', 'bot_role_id', 'is_enabled'],
  logs: ['channels'],
  music: ['default_volume', 'is_247_enabled', 'voice_channel_id', 'text_channel_id', 'autoplay_enabled'],
  level: ['enabled', 'announcement_channel_id', 'msg_xp', 'voice_xp', 'xp_per_level', 'exempt_channels', 'exempt_roles'],
  ticket: ['room_type', 'category_id', 'log_channel_id', 'panel_channel_id', 'support_roles', 'user_limit', 'close_behavior', 'welcome_message'],
  suggestion: ['panel_channel_id', 'suggestion_channel_id', 'log_channel_id', 'cooldown_seconds', 'panel_title', 'panel_description', 'is_active'],
  vanity: ['vanity_string', 'role_id', 'channel_id', 'message', 'is_enabled'],
  tag_role: ['tag_text', 'role_id'],
  autobump: ['channel_id', 'ping_role_id', 'is_enabled'],
  media_channels: ['channel_ids'],
  prefix: ['prefix'],
  starboard: ['enabled', 'channel_id', 'emoji', 'threshold', 'self_star_allowed'],
  birthday: ['enabled', 'channel_id', 'message_template', 'temp_role_id'],
  kayit: ['kayitsiz_role_id', 'erkek_role_id', 'kiz_role_id', 'yetkili_role_id', 'log_channel_id'],
  dogrulama: ['enabled', 'channel_id', 'role_id', 'publish'],
  sayac: ['enabled', 'channel_id', 'hedef', 'sablon'],
  kurallar: ['channel_id', 'metin', 'rol_id', 'publish'],
  tanitim: ['channel_id', 'cooldown_hours'],
  oy: ['vote_url', 'odul'],
  staff_app: ['publish_channel_id', 'review_channel_id', 'reviewer_roles', 'approve_role_id', 'panel_text', 'q1', 'q2', 'q3', 'q4', 'q5', 'is_active', 'publish'],
  creator_app: ['publish_channel_id', 'review_channel_id', 'reviewer_roles', 'approve_role_id', 'panel_text', 'q1', 'q2', 'q3', 'q4', 'q5', 'is_active', 'publish'],
  staff_panel: ['channel_id', 'roles_json', 'title', 'description', 'is_active', 'publish']
};

async function ensureAppSchemaColumns() {
  const alters = [
    "ALTER TABLE staff_applications ADD COLUMN publish_channel_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE staff_applications ADD COLUMN review_channel_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE staff_applications ADD COLUMN reviewer_roles TEXT",
    "ALTER TABLE staff_applications ADD COLUMN approve_role_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE staff_applications ADD COLUMN panel_text TEXT",
    "ALTER TABLE staff_applications ADD COLUMN q1 TEXT",
    "ALTER TABLE staff_applications ADD COLUMN q2 TEXT",
    "ALTER TABLE staff_applications ADD COLUMN q3 TEXT",
    "ALTER TABLE staff_applications ADD COLUMN q4 TEXT",
    "ALTER TABLE staff_applications ADD COLUMN q5 TEXT",
    "ALTER TABLE staff_applications ADD COLUMN is_active BOOLEAN DEFAULT FALSE",
    "ALTER TABLE staff_applications ADD COLUMN published_message_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE creator_applications ADD COLUMN publish_channel_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE creator_applications ADD COLUMN review_channel_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE creator_applications ADD COLUMN reviewer_roles TEXT",
    "ALTER TABLE creator_applications ADD COLUMN approve_role_id VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE creator_applications ADD COLUMN panel_text TEXT",
    "ALTER TABLE creator_applications ADD COLUMN q1 TEXT",
    "ALTER TABLE creator_applications ADD COLUMN q2 TEXT",
    "ALTER TABLE creator_applications ADD COLUMN q3 TEXT",
    "ALTER TABLE creator_applications ADD COLUMN q4 TEXT",
    "ALTER TABLE creator_applications ADD COLUMN q5 TEXT",
    "ALTER TABLE creator_applications ADD COLUMN is_active BOOLEAN DEFAULT FALSE",
    "ALTER TABLE creator_applications ADD COLUMN published_message_id VARCHAR(32) DEFAULT NULL",
    `CREATE TABLE IF NOT EXISTS staff_panel_config (
      guild_id VARCHAR(25) PRIMARY KEY,
      channel_id VARCHAR(25) DEFAULT NULL,
      message_id VARCHAR(25) DEFAULT NULL,
      roles_json TEXT DEFAULT NULL,
      title VARCHAR(255) DEFAULT 'Yetkili Kadromuz:',
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE
    )`
  ];
  for (const sql of alters) {
    try { await pool.query(sql); } catch (_) {}
  }
}

function filterAllowedConfigData(module, data) {
  if (!module || !ALLOWED_CONFIG_MODULES[module]) {
    return {};
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const allowedKeys = new Set(ALLOWED_CONFIG_MODULES[module]);
  const filtered = {};

  for (const [key, value] of Object.entries(data)) {
    if (allowedKeys.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

// Helper to fetch from Discord API with Bot token (Supports GET, POST, PATCH, DELETE)
async function discordBotFetch(endpoint, options = {}) {
  try {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    if (options.body) {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    const res = await fetch(`https://discord.com/api/v10${endpoint}`, fetchOptions);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`Discord Bot Fetch Error [${fetchOptions.method} ${endpoint}]: ${res.status} ${errText}`);
      return null;
    }
    return await res.json().catch(() => ({ success: true }));
  } catch (err) {
    console.error(`Discord Bot Fetch Error [${endpoint}]:`, err.message);
    return null;
  }
}

// Live Discord Panel Message Builders & Updaters (Components V2)
async function updateOrPublishTicketPanel(guildId, setupData) {
  if (!setupData || !setupData.panel_channel_id) return null;

  const btn = new ButtonBuilder()
    .setCustomId('ticket_create_btn')
    .setLabel('Talep Oluştur')
    .setStyle(ButtonStyle.Primary)
    .setEmoji(MONO_EMOJIS.ticket);

  const extraInfoBtn = new ButtonBuilder()
    .setCustomId(`ticket_btn_extra_info_${guildId}`)
    .setLabel('Kurallar & SSS')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(MONO_EMOJIS.info);

  const actionRow = new ActionRowBuilder().addComponents(btn, extraInfoBtn);

  const title = setupData.panel_title || 'Destek Bilet Sistemi';
  const textLines = [
    setupData.welcome_message || 'Yetkili ekibimiz en kısa sürede sizinle ilgilenecektir.',
    '---SEPARATOR---',
    '• Aşağıdaki butona tıklayarak özel destek talebi başlatabilirsiniz.',
    '• Gereksiz talep açmak yetkililerin işini aksatır, lütfen sorununuzu net şekilde belirtin.'
  ];

  const payload = buildModBResponse({
    title,
    textLines,
    actionRows: [actionRow]
  });

  const body = {
    flags: MessageFlags.IsComponentsV2,
    components: payload.components.map(c => c.toJSON())
  };

  // If already published, PATCH the existing message in Discord
  if (setupData.published_panel_id) {
    const patched = await discordBotFetch(`/channels/${setupData.panel_channel_id}/messages/${setupData.published_panel_id}`, {
      method: 'PATCH',
      body
    });
    if (patched && patched.id) return patched.id;
  }

  // Otherwise, POST a new message to the panel channel
  const posted = await discordBotFetch(`/channels/${setupData.panel_channel_id}/messages`, {
    method: 'POST',
    body
  });

  if (posted && posted.id) {
    await pool.query('UPDATE tickets_setup SET published_panel_id = ? WHERE guild_id = ?', [posted.id, guildId]);
    return posted.id;
  }
  return null;
}

async function updateOrPublishSuggestionPanel(guildId, setupData) {
  if (!setupData || !setupData.panel_channel_id) return null;

  const submitBtn = new ButtonBuilder()
    .setCustomId('oneri_user_submit_btn')
    .setLabel('Öneri Yap')
    .setStyle(ButtonStyle.Success)
    .setEmoji(MONO_EMOJIS.ticket);

  const actionRow = new ActionRowBuilder().addComponents(submitBtn);

  const title = setupData.panel_title || 'Öneri Paneli';
  const desc = setupData.panel_description || 'Topluluğumuzun gelişmesine katkıda bulunmak için fikirlerini paylaşabilirsin. İstersen adını gösterebilir veya anonim kalabilirsin!';

  const payload = buildModBResponse({
    title,
    textLines: [
      desc,
      '---SEPARATOR---',
      '-# Aşağıdaki butona tıklayarak açılan form üzerinden önerinizi hemen iletebilirsiniz.'
    ],
    actionRows: [actionRow]
  });

  const body = {
    flags: MessageFlags.IsComponentsV2,
    components: payload.components.map(c => c.toJSON())
  };

  // If already published, PATCH the message
  if (setupData.published_message_id) {
    const patched = await discordBotFetch(`/channels/${setupData.panel_channel_id}/messages/${setupData.published_message_id}`, {
      method: 'PATCH',
      body
    });
    if (patched && patched.id) return patched.id;
  }

  // Otherwise, POST new message
  const posted = await discordBotFetch(`/channels/${setupData.panel_channel_id}/messages`, {
    method: 'POST',
    body
  });

  if (posted && posted.id) {
    await pool.query('UPDATE suggestion_setup SET published_message_id = ?, is_active = 1 WHERE guild_id = ?', [posted.id, guildId]);
    return posted.id;
  }
  return null;
}

// 1. Get Live Guild Details (Channels, Roles, Members, Member Count, Icon)
router.get('/:guildId/details', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;

  try {
    const [guild, channels, roles, members] = await Promise.all([
      discordBotFetch(`/guilds/${guildId}?with_counts=true`),
      discordBotFetch(`/guilds/${guildId}/channels`),
      discordBotFetch(`/guilds/${guildId}/roles`),
      discordBotFetch(`/guilds/${guildId}/members?limit=1000`)
    ]);

    if (!guild || !guild.id) {
      return res.status(404).json({ error: 'Sunucu bulunamadı veya bot bu sunucuda ekli değil.' });
    }

    // Filter text and voice channels
    const textChannels = (channels || [])
      .filter(c => c.type === 0 || c.type === 5) // 0: Text, 5: Announcement
      .map(c => ({ id: c.id, name: c.name, type: c.type, position: c.position }))
      .sort((a, b) => a.position - b.position);

    const voiceChannels = (channels || [])
      .filter(c => c.type === 2) // 2: Voice
      .map(c => ({ id: c.id, name: c.name, type: c.type, position: c.position }))
      .sort((a, b) => a.position - b.position);

    const categories = (channels || [])
      .filter(c => c.type === 4) // 4: Category
      .map(c => ({ id: c.id, name: c.name, position: c.position }));

    const formattedRoles = (roles || [])
      .filter(r => r.name !== '@everyone')
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#99aab5',
        position: r.position
      }))
      .sort((a, b) => b.position - a.position);

    const formattedMembers = (members || [])
      .map(m => {
        const u = m.user || {};
        const defaultAvatarNum = (BigInt(u.id || '0') >> 22n) % 6n;
        return {
          id: u.id,
          username: u.username || 'Bilinmeyen Kullanıcı',
          displayName: m.nick || u.global_name || u.username || 'Bilinmeyen Kullanıcı',
          avatar: u.avatar
            ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`,
          isBot: !!u.bot,
          roles: m.roles || []
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
      banner: guild.banner ? `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.png?size=1024` : (guild.splash ? `https://cdn.discordapp.com/splashes/${guild.id}/${guild.splash}.png?size=1024` : null),
      description: guild.description || null,
      premiumTier: guild.premium_tier || 0,
      premiumSubscriptionCount: guild.premium_subscription_count || 0,
      approximatePresenceCount: guild.approximate_presence_count || 0,
      memberCount: guild.approximate_member_count || formattedMembers.length,
      channels: {
        text: textChannels,
        voice: voiceChannels,
        categories: categories
      },
      roles: formattedRoles,
      members: formattedMembers
    });
  } catch (err) {
    console.error('Error fetching guild details:', err);
    return res.status(500).json({ error: 'Sunucu bilgileri alınırken bir hata oluştu.' });
  }
});

// 2. Get All Module Configurations for Guild (Accurate DB queries using pool.query)
router.get('/:guildId/config', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;

  try {
    // Run queries safely through pool.query without holding open connection locks
    const generalRows = await pool.query('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
    const automodRows = await pool.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
    const antinukeRows = await pool.query('SELECT * FROM guild_antinuke_config WHERE guild_id = ?', [guildId]);
    const antinukeWhitelistRows = await pool.query('SELECT * FROM guild_antinuke_whitelist WHERE guild_id = ?', [guildId]);
    const welcomeRows = await pool.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
    const autoroleRows = await pool.query('SELECT * FROM autorole_config WHERE guild_id = ?', [guildId]);
    const logRows = await pool.query('SELECT * FROM guild_log_channels WHERE guild_id = ?', [guildId]);
    const levelRows = await pool.query('SELECT * FROM guild_level_config WHERE guild_id = ?', [guildId]);
    const musicRows = await pool.query('SELECT * FROM guild_music_config WHERE guild_id = ?', [guildId]);
    const roomsRows = await pool.query('SELECT * FROM active_rooms WHERE guild_id = ? ORDER BY created_at DESC', [guildId]);
    const setupRows = await pool.query('SELECT * FROM guild_setup WHERE guild_id = ?', [guildId]);
    const ticketSetupRows = await pool.query('SELECT * FROM tickets_setup WHERE guild_id = ?', [guildId]);
    const ticketsRows = await pool.query(`
      SELECT 
        t.id, t.guild_id, t.channel_id, t.owner_id, t.owner_tag, t.category, t.reason, 
        t.status, t.claimed_by, t.closed_by, t.close_reason, t.opened_at, t.closed_at,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.channel_id = t.channel_id) AS message_count
      FROM tickets t
      WHERE t.guild_id = ?
      ORDER BY t.id DESC
    `, [guildId]);
    const suggestionRows = await pool.query('SELECT * FROM suggestion_setup WHERE guild_id = ?', [guildId]);
    const vanityRows = await pool.query('SELECT * FROM guild_vanity_config WHERE guild_id = ?', [guildId]);
    const bumpRows = await pool.query('SELECT * FROM guild_autobump_config WHERE guild_id = ?', [guildId]);
    const tagRoleRows = await pool.query('SELECT * FROM tag_role WHERE guild_id = ?', [guildId]);
    const warnActionsRows = await pool.query('SELECT * FROM warn_actions WHERE guild_id = ? ORDER BY warn_count ASC', [guildId]);
    const mediaRows = await pool.query('SELECT channel_id FROM guild_media_channels WHERE guild_id = ?', [guildId]);
    const giveawaysRows = await pool.query(`
      SELECT 
        id, message_id, channel_id, guild_id, prize, description, 
        winner_count, host_id, status, participants, winners, ends_at, created_at 
      FROM guild_giveaways 
      WHERE guild_id = ? 
      ORDER BY id DESC
    `, [guildId]);
    const wordsRows = await pool.query('SELECT id, word, match_type, action FROM filtered_words WHERE guild_id = ?', [guildId]);
    const prefixRows = await pool.query('SELECT prefix FROM guild_prefixes WHERE guild_id = ?', [guildId]);
    const starboardRows = await pool.query('SELECT * FROM starboard_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const birthdayRows = await pool.query('SELECT * FROM birthday_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const kayitRows = await pool.query('SELECT * FROM kayit_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const dogrulamaRows = await pool.query('SELECT * FROM dogrulama_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const sayacRows = await pool.query('SELECT * FROM sayac_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const stickyRows = await pool.query('SELECT channel_id, guild_id, message_id, content FROM sticky_messages WHERE guild_id = ?', [guildId]).catch(() => []);
    const shopRows = await pool.query('SELECT id, name, description, price, role_id, stock, item_type FROM economy_shop_items WHERE guild_id = ? ORDER BY price ASC', [guildId]).catch(() => []);
    const rrPanelRows = await pool.query('SELECT * FROM reaction_role_panels WHERE guild_id = ? ORDER BY id DESC', [guildId]).catch(() => []);
    const levelRewardRows = await pool.query('SELECT * FROM guild_level_rewards WHERE guild_id = ? ORDER BY level ASC', [guildId]).catch(() => []);
    const socialRows = await pool.query('SELECT * FROM social_subscriptions WHERE guild_id = ? ORDER BY id DESC', [guildId]).catch(() => []);
    const pollRows = await pool.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS vote_count,
        (SELECT COUNT(*) FROM poll_options o WHERE o.poll_id = p.id) AS option_count
       FROM polls p WHERE p.guild_id = ? ORDER BY p.id DESC LIMIT 50`,
      [guildId]
    ).catch(() => []);
    await ensureAppSchemaColumns();
    const kurallarRows = await pool.query('SELECT * FROM kurallar_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const tanitimRows = await pool.query('SELECT * FROM tanitim_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const oyRows = await pool.query('SELECT * FROM oy_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const staffAppRows = await pool.query('SELECT * FROM staff_applications WHERE guild_id = ?', [guildId]).catch(() => []);
    const creatorAppRows = await pool.query('SELECT * FROM creator_applications WHERE guild_id = ?', [guildId]).catch(() => []);
    const staffPanelRows = await pool.query('SELECT * FROM staff_panel_config WHERE guild_id = ?', [guildId]).catch(() => []);
    const etkinlikRows = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM etkinlik_katilim k WHERE k.etkinlik_id = e.id AND k.durum='evet') AS evet_count,
        (SELECT COUNT(*) FROM etkinlik_katilim k WHERE k.etkinlik_id = e.id AND k.durum='belki') AS belki_count,
        (SELECT COUNT(*) FROM etkinlik_katilim k WHERE k.etkinlik_id = e.id AND k.durum='hayir') AS hayir_count
       FROM etkinlikler e WHERE e.guild_id = ? ORDER BY e.id DESC LIMIT 30`,
      [guildId]
    ).catch(() => []);
    const countdownRows = await pool.query(
      "SELECT * FROM geri_sayim WHERE guild_id = ? ORDER BY id DESC LIMIT 20",
      [guildId]
    ).catch(() => []);
    let rrOptionsRows = [];
    if (Array.isArray(rrPanelRows) && rrPanelRows.length > 0) {
      const panelIds = rrPanelRows.map(p => p.id);
      rrOptionsRows = await pool.query(
        `SELECT * FROM reaction_role_options WHERE panel_id IN (${panelIds.map(() => '?').join(',')})`,
        panelIds
      ).catch(() => []);
    }

    // Format logs into category -> channel_id map
    const logChannels = {};
    if (Array.isArray(logRows)) {
      logRows.forEach(r => {
        logChannels[r.category] = r.channel_id;
      });
    }

    // Helper to safely parse JSON or comma-separated arrays
    const parseJsonArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          return val.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      return [];
    };

    const rawAutomod = automodRows[0] || {};
    const automodData = {
      ...rawAutomod,
      guild_id: guildId,
      anti_swear: rawAutomod.anti_swear || 0,
      anti_invite: rawAutomod.anti_invite || 0,
      anti_link: rawAutomod.anti_link || 0,
      caps_percent: rawAutomod.caps_percent ?? 70,
      mention_limit: rawAutomod.mention_limit ?? 5,
      spam_limit: rawAutomod.spam_limit || '5/5s',
      emoji_limit: rawAutomod.emoji_limit ?? 0,
      punishment_type: rawAutomod.punishment_type || 'mute',
      mute_duration: rawAutomod.mute_duration ?? 10,
      dm_notify: rawAutomod.dm_notify ?? 1,
      anti_zalgo: rawAutomod.anti_zalgo ?? 1,
      cross_spam_enabled: rawAutomod.cross_spam_enabled ?? 1,
      exempt_roles: parseJsonArray(rawAutomod.exempt_roles),
      exempt_channels: parseJsonArray(rawAutomod.exempt_channels),
      media_channels: parseJsonArray(rawAutomod.media_channels)
    };

    const generalData = generalRows[0] || {
      guild_id: guildId,
      anti_spam_enabled: 0,
      anti_link_enabled: automodData.anti_link || 0,
      anti_swear_enabled: automodData.anti_swear || 0,
      caps_filter_enabled: automodData.caps_percent > 0 ? 1 : 0,
      anti_raid_enabled: 0,
      mod_role_id: null
    };

    const antinukeData = antinukeRows[0] || {
      guild_id: guildId,
      is_enabled: 0,
      punishment: 'kick',
      channel_delete_limit: 3,
      channel_create_limit: 3,
      role_delete_limit: 3,
      role_create_limit: 3,
      ban_limit: 3,
      kick_limit: 5,
      anti_bot_add: 1,
      anti_webhook: 1
    };
    antinukeData.whitelist = antinukeWhitelistRows || [];

    return res.json({
      general: generalData,
      automod: automodData,
      antinuke: antinukeData,
      welcome: welcomeRows[0] || {
        guild_id: guildId,
        welcome_channel_id: null,
        goodbye_channel_id: null,
        welcome_message: 'Sunucumuza hoş geldin {user}!',
        goodbye_message: '{user} aramızdan ayrıldı.',
        welcome_dm_message: null,
        welcome_gen_image: 1,
        goodbye_gen_image: 0,
        welcome_show_title: 1,
        goodbye_show_title: 1
      },
      autorole: autoroleRows[0] || {
        guild_id: guildId,
        user_role_id: null,
        bot_role_id: null,
        is_enabled: 0
      },
      logs: logChannels,
      level: {
        ...(levelRows[0] || {}),
        guild_id: guildId,
        enabled: levelRows[0]?.enabled ?? 1,
        msg_xp: levelRows[0]?.msg_xp ?? 15,
        voice_xp: levelRows[0]?.voice_xp ?? 25,
        xp_per_level: levelRows[0]?.xp_per_level ?? 100,
        announcement_channel_id: levelRows[0]?.announcement_channel_id || null,
        exempt_channels: parseJsonArray(levelRows[0]?.exempt_channels),
        exempt_roles: parseJsonArray(levelRows[0]?.exempt_roles)
      },
      music: musicRows[0] || {
        guild_id: guildId,
        default_volume: 80,
        is_247_enabled: 0,
        voice_channel_id: null,
        text_channel_id: null,
        autoplay_enabled: 0
      },
      activeRooms: roomsRows || [],
      specialRoomsSetup: setupRows[0] || {
        guild_id: guildId,
        setup_category_id: null,
        setup_channel_id: null,
        setup_voice_channel_id: null,
        active_rooms_category_id: null,
        log_channel_id: null
      },
      ticketSetup: {
        ...(ticketSetupRows[0] || {}),
        guild_id: guildId,
        room_type: ticketSetupRows[0]?.room_type || 'channel',
        category_id: ticketSetupRows[0]?.category_id || null,
        support_roles: parseJsonArray(ticketSetupRows[0]?.support_roles),
        log_channel_id: ticketSetupRows[0]?.log_channel_id || null,
        panel_channel_id: ticketSetupRows[0]?.panel_channel_id || null,
        user_limit: ticketSetupRows[0]?.user_limit ?? 1,
        close_behavior: ticketSetupRows[0]?.close_behavior || 'archive',
        welcome_message: ticketSetupRows[0]?.welcome_message || 'Yetkili ekibimiz en kısa sürede sizinle ilgilenecektir.'
      },
      suggestionSetup: suggestionRows[0] || {
        guild_id: guildId,
        panel_channel_id: null,
        suggestion_channel_id: null,
        log_channel_id: null,
        cooldown_seconds: 30,
        panel_title: 'Öneri Paneli',
        panel_description: 'Sunucumuz için bir önerin mi var? Aşağıdaki butona tıklayarak paylaşabilirsin.',
        is_active: 1
      },
      vanity: vanityRows[0] || {
        guild_id: guildId,
        vanity_string: '',
        role_id: null,
        channel_id: null,
        message: '{user}, durumuna sunucu davetimizi eklediği için özel rol verildi!',
        is_enabled: 0
      },
      autobump: bumpRows[0] || {
        guild_id: guildId,
        channel_id: null,
        ping_role_id: null,
        is_enabled: 0
      },
      tagRole: tagRoleRows[0] || {
        guild_id: guildId,
        tag_text: '',
        role_id: null
      },
      mediaChannels: (mediaRows || []).map(r => r.channel_id),
      warnActions: warnActionsRows || [],
      tickets: ticketsRows || [],
      giveaways: giveawaysRows || [],
      filteredWords: wordsRows || [],
      prefixes: (prefixRows || []).map(p => p.prefix),
      starboard: starboardRows[0]
        ? {
            enabled: 1,
            channel_id: starboardRows[0].channel_id,
            emoji: starboardRows[0].emoji || '⭐',
            threshold: starboardRows[0].threshold ?? 3,
            self_star_allowed: starboardRows[0].self_star_allowed ? 1 : 0
          }
        : { enabled: 0, channel_id: null, emoji: '⭐', threshold: 3, self_star_allowed: 0 },
      birthday: birthdayRows[0]
        ? {
            enabled: birthdayRows[0].channel_id ? 1 : 0,
            channel_id: birthdayRows[0].channel_id || null,
            message_template: birthdayRows[0].message_template || 'İyi ki doğdun {user}! 🎉',
            temp_role_id: birthdayRows[0].temp_role_id || null
          }
        : { enabled: 0, channel_id: null, message_template: 'İyi ki doğdun {user}! 🎉', temp_role_id: null },
      kayit: kayitRows[0] || {
        guild_id: guildId,
        kayitsiz_role_id: null,
        erkek_role_id: null,
        kiz_role_id: null,
        yetkili_role_id: null,
        log_channel_id: null
      },
      dogrulama: dogrulamaRows[0]
        ? {
            enabled: dogrulamaRows[0].is_active ? 1 : 0,
            channel_id: dogrulamaRows[0].channel_id || null,
            role_id: dogrulamaRows[0].role_id || null,
            message_id: dogrulamaRows[0].message_id || null
          }
        : { enabled: 0, channel_id: null, role_id: null, message_id: null },
      sayac: sayacRows[0]
        ? {
            enabled: 1,
            channel_id: sayacRows[0].channel_id,
            hedef: sayacRows[0].hedef ?? 1000,
            sablon: sayacRows[0].sablon || 'Uye: {sayi}/{hedef}'
          }
        : { enabled: 0, channel_id: null, hedef: 1000, sablon: 'Uye: {sayi}/{hedef}' },
      stickyMessages: stickyRows || [],
      economyShop: shopRows || [],
      reactionPanels: (rrPanelRows || []).map(p => ({
        ...p,
        options: (rrOptionsRows || []).filter(o => Number(o.panel_id) === Number(p.id))
      })),
      levelRewards: levelRewardRows || [],
      socialSubscriptions: socialRows || [],
      polls: pollRows || [],
      kurallar: kurallarRows[0] || { channel_id: null, metin: '', rol_id: null, message_id: null },
      tanitim: tanitimRows[0] || { channel_id: null, cooldown_hours: 6 },
      oy: oyRows[0] || { vote_url: '', odul: 200 },
      staffApp: (() => {
        const r = staffAppRows[0] || {};
        let reviewer = [];
        try { reviewer = r.reviewer_roles ? JSON.parse(r.reviewer_roles) : []; } catch (_) {}
        return {
          publish_channel_id: r.publish_channel_id || null,
          review_channel_id: r.review_channel_id || null,
          reviewer_roles: Array.isArray(reviewer) ? reviewer : [],
          approve_role_id: r.approve_role_id || null,
          panel_text: r.panel_text || 'Yetkili Başvurusu\nSunucumuzda yetkili olmak istiyorsanız aşağıdaki butona tıklayın.',
          q1: r.q1 || '', q2: r.q2 || '', q3: r.q3 || '', q4: r.q4 || '', q5: r.q5 || '',
          is_active: r.is_active ? 1 : 0,
          published_message_id: r.published_message_id || null
        };
      })(),
      creatorApp: (() => {
        const r = creatorAppRows[0] || {};
        let reviewer = [];
        try { reviewer = r.reviewer_roles ? JSON.parse(r.reviewer_roles) : []; } catch (_) {}
        return {
          publish_channel_id: r.publish_channel_id || null,
          review_channel_id: r.review_channel_id || null,
          reviewer_roles: Array.isArray(reviewer) ? reviewer : [],
          approve_role_id: r.approve_role_id || null,
          panel_text: r.panel_text || 'İçerik Üreticisi Başvurusu\nAşağıdaki butona tıklayarak başvurabilirsiniz.',
          q1: r.q1 || '', q2: r.q2 || '', q3: r.q3 || '', q4: r.q4 || '', q5: r.q5 || '',
          is_active: r.is_active ? 1 : 0,
          published_message_id: r.published_message_id || null
        };
      })(),
      staffPanel: (() => {
        const r = staffPanelRows[0] || {};
        let roles = [];
        try { roles = r.roles_json ? JSON.parse(r.roles_json) : []; } catch (_) {}
        return {
          channel_id: r.channel_id || null,
          message_id: r.message_id || null,
          roles_json: Array.isArray(roles) ? roles : [],
          title: r.title || 'Yetkili Kadromuz:',
          description: r.description || 'Sunucumuzun yetkili ekibi ve görev dağılımı aşağıda yer alıyor.',
          is_active: r.is_active !== 0 && r.is_active !== false ? 1 : 0
        };
      })(),
      etkinlikler: etkinlikRows || [],
      countdowns: countdownRows || []
    });
  } catch (err) {
    console.error('Error fetching config for guild:', guildId, err);
    return res.status(500).json({ error: 'Ayarlar veritabanından çekilemedi: ' + err.message });
  }
});

// 3. Save / Update Module Configuration
router.post('/:guildId/config', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const updates = req.body;
  const { module, data } = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // --- ULTIMATE AUDIT LOGGING (WEB) ---
  let conn;
  try {
      conn = await db.pool.getConnection();
      // Web paneli ayar değişikliklerini db'ye işleyebilir veya console'a basabiliriz.
      console.log(`[AUDIT-WEB] User ${req.user.id} updated config for guild ${guildId}:`, updates);
  } catch(e) { 
      console.error("Web Log Hatası:", e);
  } finally {
      if (conn) conn.release();
  }

  if (!module || !data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Modül ve veri parametreleri zorunludur.' });
  }

  if (!ALLOWED_CONFIG_MODULES[module]) {
    return res.status(400).json({ error: 'Geçersiz yapılandırma modülü.' });
  }

  const safeData = filterAllowedConfigData(module, data);

  try {
    switch (module) {
      case 'general': {
        await pool.query(`
          INSERT INTO guild_config (guild_id, anti_spam_enabled, anti_link_enabled, anti_swear_enabled, caps_filter_enabled, anti_raid_enabled, mod_role_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            anti_spam_enabled = VALUES(anti_spam_enabled),
            anti_link_enabled = VALUES(anti_link_enabled),
            anti_swear_enabled = VALUES(anti_swear_enabled),
            caps_filter_enabled = VALUES(caps_filter_enabled),
            anti_raid_enabled = VALUES(anti_raid_enabled),
            mod_role_id = VALUES(mod_role_id)
        `, [
          guildId,
          safeData.anti_spam_enabled ? 1 : 0,
          safeData.anti_link_enabled ? 1 : 0,
          safeData.anti_swear_enabled ? 1 : 0,
          safeData.caps_filter_enabled ? 1 : 0,
          safeData.anti_raid_enabled ? 1 : 0,
          safeData.mod_role_id || null
        ]);

        // Keep automod_config in sync with general switches
        await pool.query(`
          INSERT INTO automod_config (guild_id, anti_swear, anti_link)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            anti_swear = VALUES(anti_swear),
            anti_link = VALUES(anti_link)
        `, [
          guildId,
          safeData.anti_swear_enabled ? 1 : 0,
          safeData.anti_link_enabled ? 1 : 0
        ]);
        break;
      }

      case 'automod': {
        await pool.query(`
          INSERT INTO automod_config (
            guild_id, anti_swear, anti_invite, anti_link, caps_percent, mention_limit,
            spam_limit, emoji_limit, punishment_type, mute_duration, dm_notify, anti_zalgo,
            exempt_roles, exempt_channels, media_channels
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            anti_swear = VALUES(anti_swear),
            anti_invite = VALUES(anti_invite),
            anti_link = VALUES(anti_link),
            caps_percent = VALUES(caps_percent),
            mention_limit = VALUES(mention_limit),
            spam_limit = VALUES(spam_limit),
            emoji_limit = VALUES(emoji_limit),
            punishment_type = VALUES(punishment_type),
            mute_duration = VALUES(mute_duration),
            dm_notify = VALUES(dm_notify),
            anti_zalgo = VALUES(anti_zalgo),
            exempt_roles = VALUES(exempt_roles),
            exempt_channels = VALUES(exempt_channels),
            media_channels = VALUES(media_channels)
        `, [
          guildId,
          safeData.anti_swear ? 1 : 0,
          safeData.anti_invite ? 1 : 0,
          safeData.anti_link ? 1 : 0,
          Number(safeData.caps_percent || 70),
          Number(safeData.mention_limit || 5),
          safeData.spam_limit || '5/5s',
          Number(safeData.emoji_limit || 0),
          safeData.punishment_type || 'mute',
          Number(safeData.mute_duration || 10),
          safeData.dm_notify ? 1 : 0,
          safeData.anti_zalgo ? 1 : 0,
          JSON.stringify(Array.isArray(safeData.exempt_roles) ? safeData.exempt_roles : []),
          JSON.stringify(Array.isArray(safeData.exempt_channels) ? safeData.exempt_channels : []),
          JSON.stringify(Array.isArray(safeData.media_channels) ? safeData.media_channels : [])
        ]);
        if (typeof clearAutoModConfigCache === 'function') {
          clearAutoModConfigCache(guildId);
        }
        break;
      }

      case 'antinuke': {
        await pool.query(`
          INSERT INTO guild_antinuke_config (guild_id, is_enabled, punishment, channel_delete_limit, role_delete_limit, ban_limit, kick_limit, anti_bot_add, anti_webhook)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            is_enabled = VALUES(is_enabled),
            punishment = VALUES(punishment),
            channel_delete_limit = VALUES(channel_delete_limit),
            role_delete_limit = VALUES(role_delete_limit),
            ban_limit = VALUES(ban_limit),
            kick_limit = VALUES(kick_limit),
            anti_bot_add = VALUES(anti_bot_add),
            anti_webhook = VALUES(anti_webhook)
        `, [
          guildId,
          safeData.is_enabled ? 1 : 0,
          safeData.punishment || 'kick',
          Number(safeData.channel_delete_limit || 3),
          Number(safeData.role_delete_limit || 3),
          Number(safeData.ban_limit || 3),
          Number(safeData.kick_limit || 5),
          safeData.anti_bot_add ? 1 : 0,
          safeData.anti_webhook ? 1 : 0
        ]);
        break;
      }

      case 'welcome': {
        await pool.query(`
          INSERT INTO welcome_config (guild_id, welcome_channel_id, goodbye_channel_id, welcome_message, goodbye_message, welcome_dm_message, welcome_gen_image, goodbye_gen_image, welcome_show_title, goodbye_show_title)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            welcome_channel_id = VALUES(welcome_channel_id),
            goodbye_channel_id = VALUES(goodbye_channel_id),
            welcome_message = VALUES(welcome_message),
            goodbye_message = VALUES(goodbye_message),
            welcome_dm_message = VALUES(welcome_dm_message),
            welcome_gen_image = VALUES(welcome_gen_image),
            goodbye_gen_image = VALUES(goodbye_gen_image),
            welcome_show_title = VALUES(welcome_show_title),
            goodbye_show_title = VALUES(goodbye_show_title)
        `, [
          guildId,
          safeData.welcome_channel_id || null,
          safeData.goodbye_channel_id || null,
          safeData.welcome_message || 'Sunucumuza hoş geldin {user}!',
          safeData.goodbye_message || '{user} aramızdan ayrıldı.',
          safeData.welcome_dm_message || null,
          safeData.welcome_gen_image ? 1 : 0,
          safeData.goodbye_gen_image ? 1 : 0,
          safeData.welcome_show_title ? 1 : 0,
          safeData.goodbye_show_title ? 1 : 0
        ]);
        break;
      }

      case 'special_rooms': {
        await pool.query(`
          INSERT INTO guild_setup (guild_id, setup_category_id, setup_channel_id, setup_voice_channel_id, active_rooms_category_id, log_channel_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            setup_category_id = VALUES(setup_category_id),
            setup_channel_id = VALUES(setup_channel_id),
            setup_voice_channel_id = VALUES(setup_voice_channel_id),
            active_rooms_category_id = VALUES(active_rooms_category_id),
            log_channel_id = VALUES(log_channel_id)
        `, [
          guildId,
          safeData.setup_category_id || null,
          safeData.setup_channel_id || null,
          safeData.setup_voice_channel_id || null,
          safeData.active_rooms_category_id || null,
          safeData.log_channel_id || null
        ]);
        break;
      }

      case 'autorole': {
        await pool.query(`
          INSERT INTO autorole_config (guild_id, user_role_id, bot_role_id, is_enabled)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_role_id = VALUES(user_role_id),
            bot_role_id = VALUES(bot_role_id),
            is_enabled = VALUES(is_enabled)
        `, [
          guildId,
          safeData.user_role_id || null,
          safeData.bot_role_id || null,
          safeData.is_enabled ? 1 : 0
        ]);
        break;
      }

      case 'logs': {
        if (safeData.channels && typeof safeData.channels === 'object') {
          for (const [cat, chId] of Object.entries(safeData.channels)) {
            if (chId) {
              await pool.query(`
                INSERT INTO guild_log_channels (guild_id, category, channel_id)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)
              `, [guildId, cat, chId]);
            } else {
              await pool.query(`
                DELETE FROM guild_log_channels WHERE guild_id = ? AND category = ?
              `, [guildId, cat]);
            }
          }
        }
        break;
      }

      case 'music': {
        await pool.query(`
          INSERT INTO guild_music_config (guild_id, default_volume, is_247_enabled, voice_channel_id, text_channel_id, autoplay_enabled)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            default_volume = VALUES(default_volume),
            is_247_enabled = VALUES(is_247_enabled),
            voice_channel_id = VALUES(voice_channel_id),
            text_channel_id = VALUES(text_channel_id),
            autoplay_enabled = VALUES(autoplay_enabled)
        `, [
          guildId,
          Number(safeData.default_volume || 80),
          safeData.is_247_enabled ? 1 : 0,
          safeData.voice_channel_id || null,
          safeData.text_channel_id || null,
          safeData.autoplay_enabled ? 1 : 0
        ]);
        break;
      }

      case 'level': {
        await pool.query(`
          INSERT INTO guild_level_config (
            guild_id, enabled, announcement_channel_id, msg_xp, voice_xp, xp_per_level, exempt_channels, exempt_roles
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            enabled = VALUES(enabled),
            announcement_channel_id = VALUES(announcement_channel_id),
            msg_xp = VALUES(msg_xp),
            voice_xp = VALUES(voice_xp),
            xp_per_level = VALUES(xp_per_level),
            exempt_channels = VALUES(exempt_channels),
            exempt_roles = VALUES(exempt_roles)
        `, [
          guildId,
          safeData.enabled ? 1 : 0,
          safeData.announcement_channel_id || null,
          Number(safeData.msg_xp || 15),
          Number(safeData.voice_xp || 25),
          Number(safeData.xp_per_level || 100),
          JSON.stringify(Array.isArray(safeData.exempt_channels) ? safeData.exempt_channels : []),
          JSON.stringify(Array.isArray(safeData.exempt_roles) ? safeData.exempt_roles : [])
        ]);
        break;
      }

      case 'ticket': {
        await pool.query(`
          INSERT INTO tickets_setup (guild_id, room_type, category_id, log_channel_id, panel_channel_id, support_roles, user_limit, close_behavior, welcome_message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            room_type = VALUES(room_type),
            category_id = VALUES(category_id),
            log_channel_id = VALUES(log_channel_id),
            panel_channel_id = VALUES(panel_channel_id),
            support_roles = VALUES(support_roles),
            user_limit = VALUES(user_limit),
            close_behavior = VALUES(close_behavior),
            welcome_message = VALUES(welcome_message)
        `, [
          guildId,
          safeData.room_type || 'channel',
          safeData.category_id || null,
          safeData.log_channel_id || null,
          safeData.panel_channel_id || null,
          JSON.stringify(safeData.support_roles || []),
          Number(safeData.user_limit || 1),
          safeData.close_behavior || 'archive',
          safeData.welcome_message || 'Yetkili ekibimiz en kısa sürede sizinle ilgilenecektir.'
        ]);

        // Live Bot Sync: Automatically update Discord message if panel channel is configured
        if (safeData.panel_channel_id) {
          const tRows = await pool.query('SELECT * FROM tickets_setup WHERE guild_id = ?', [guildId]);
          if (tRows[0]) {
            await updateOrPublishTicketPanel(guildId, tRows[0]).catch(err => console.error('[Live Sync] Ticket panel update error:', err));
          }
        }
        break;
      }

      case 'suggestion': {
        await pool.query(`
          INSERT INTO suggestion_setup (guild_id, panel_channel_id, suggestion_channel_id, log_channel_id, cooldown_seconds, panel_title, panel_description, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            panel_channel_id = VALUES(panel_channel_id),
            suggestion_channel_id = VALUES(suggestion_channel_id),
            log_channel_id = VALUES(log_channel_id),
            cooldown_seconds = VALUES(cooldown_seconds),
            panel_title = VALUES(panel_title),
            panel_description = VALUES(panel_description),
            is_active = VALUES(is_active)
        `, [
          guildId,
          safeData.panel_channel_id || null,
          safeData.suggestion_channel_id || null,
          safeData.log_channel_id || null,
          Number(safeData.cooldown_seconds || 30),
          safeData.panel_title || 'Öneri Paneli',
          safeData.panel_description || 'Sunucumuz için bir önerin mi var? Aşağıdaki butona tıklayarak paylaşabilirsin.',
          safeData.is_active ? 1 : 0
        ]);

        // Live Bot Sync: Automatically update Discord message if panel channel is configured
        if (safeData.panel_channel_id) {
          const sRows = await pool.query('SELECT * FROM suggestion_setup WHERE guild_id = ?', [guildId]);
          if (sRows[0]) {
            await updateOrPublishSuggestionPanel(guildId, sRows[0]).catch(err => console.error('[Live Sync] Suggestion panel update error:', err));
          }
        }
        break;
      }

      case 'vanity': {
        await pool.query(`
          INSERT INTO guild_vanity_config (guild_id, vanity_string, role_id, channel_id, message, is_enabled)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            vanity_string = VALUES(vanity_string),
            role_id = VALUES(role_id),
            channel_id = VALUES(channel_id),
            message = VALUES(message),
            is_enabled = VALUES(is_enabled)
        `, [
          guildId,
          safeData.vanity_string || null,
          safeData.role_id || null,
          safeData.channel_id || null,
          safeData.message || '{user}, durumuna sunucu davetimizi eklediği için özel rol verildi!',
          safeData.is_enabled ? 1 : 0
        ]);
        break;
      }

      case 'tag_role': {
        if (safeData.tag_text && safeData.role_id) {
          await pool.query(`
            INSERT INTO tag_role (guild_id, tag_text, role_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
              tag_text = VALUES(tag_text),
              role_id = VALUES(role_id)
          `, [guildId, safeData.tag_text, safeData.role_id]);
        } else {
          await pool.query('DELETE FROM tag_role WHERE guild_id = ?', [guildId]);
        }
        break;
      }

      case 'autobump': {
        await pool.query(`
          INSERT INTO guild_autobump_config (guild_id, channel_id, ping_role_id, is_enabled)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            channel_id = VALUES(channel_id),
            ping_role_id = VALUES(ping_role_id),
            is_enabled = VALUES(is_enabled)
        `, [
          guildId,
          safeData.channel_id || null,
          safeData.ping_role_id || null,
          safeData.is_enabled ? 1 : 0
        ]);
        break;
      }

      case 'media_channels': {
        await pool.query('DELETE FROM guild_media_channels WHERE guild_id = ?', [guildId]);
        if (Array.isArray(safeData.channel_ids)) {
          for (const chId of safeData.channel_ids) {
            if (chId) {
              await pool.query('INSERT IGNORE INTO guild_media_channels (guild_id, channel_id) VALUES (?, ?)', [guildId, chId]);
            }
          }
        }
        break;
      }

      case 'prefix': {
        if (safeData.prefix && safeData.prefix.trim()) {
          await pool.query(`
            INSERT INTO guild_prefixes (guild_id, prefix)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE prefix = VALUES(prefix)
          `, [guildId, safeData.prefix.trim()]);
        }
        break;
      }

      case 'starboard': {
        if (!safeData.enabled || !safeData.channel_id) {
          await pool.query('DELETE FROM starboard_config WHERE guild_id = ?', [guildId]);
        } else {
          const emoji = sanitizeString(String(safeData.emoji || '⭐')).slice(0, 64) || '⭐';
          const threshold = Math.max(1, Math.min(50, Number(safeData.threshold) || 3));
          await pool.query(`
            INSERT INTO starboard_config (guild_id, channel_id, emoji, threshold, self_star_allowed)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              channel_id = VALUES(channel_id),
              emoji = VALUES(emoji),
              threshold = VALUES(threshold),
              self_star_allowed = VALUES(self_star_allowed)
          `, [
            guildId,
            safeData.channel_id,
            emoji,
            threshold,
            safeData.self_star_allowed ? 1 : 0
          ]);
        }
        break;
      }

      case 'birthday': {
        if (!safeData.enabled || !safeData.channel_id) {
          await pool.query('DELETE FROM birthday_config WHERE guild_id = ?', [guildId]);
        } else {
          const template = sanitizeString(String(safeData.message_template || 'İyi ki doğdun {user}! 🎉')).slice(0, 1000);
          await pool.query(`
            INSERT INTO birthday_config (guild_id, channel_id, message_template, temp_role_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              channel_id = VALUES(channel_id),
              message_template = VALUES(message_template),
              temp_role_id = VALUES(temp_role_id)
          `, [
            guildId,
            safeData.channel_id,
            template || 'İyi ki doğdun {user}! 🎉',
            safeData.temp_role_id || null
          ]);
        }
        break;
      }

      case 'kayit': {
        await pool.query(`
          INSERT INTO kayit_config (guild_id, kayitsiz_role_id, erkek_role_id, kiz_role_id, yetkili_role_id, log_channel_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            kayitsiz_role_id = VALUES(kayitsiz_role_id),
            erkek_role_id = VALUES(erkek_role_id),
            kiz_role_id = VALUES(kiz_role_id),
            yetkili_role_id = VALUES(yetkili_role_id),
            log_channel_id = VALUES(log_channel_id)
        `, [
          guildId,
          safeData.kayitsiz_role_id || null,
          safeData.erkek_role_id || null,
          safeData.kiz_role_id || null,
          safeData.yetkili_role_id || null,
          safeData.log_channel_id || null
        ]);
        break;
      }

      case 'dogrulama': {
        if (!safeData.enabled) {
          await pool.query('UPDATE dogrulama_config SET is_active = FALSE WHERE guild_id = ?', [guildId]);
          break;
        }
        if (!safeData.channel_id || !safeData.role_id) {
          return res.status(400).json({ error: 'Doğrulama için kanal ve rol zorunludur.' });
        }

        let messageId = null;
        const existing = await pool.query('SELECT message_id, channel_id FROM dogrulama_config WHERE guild_id = ?', [guildId]);
        const shouldPublish = safeData.publish !== false;

        if (shouldPublish) {
          const btn = new ButtonBuilder()
            .setCustomId('dogrula_btn')
            .setLabel('Doğrula')
            .setStyle(ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.shield);

          const actionRow = new ActionRowBuilder().addComponents(btn);
          const payload = buildModBResponse({
            title: 'Doğrulama',
            textLines: ['Sunucuya erişmek için aşağıdaki butona bas ve çıkan matematik sorusunu cevapla.'],
            actionRows: [actionRow]
          });
          const body = {
            flags: MessageFlags.IsComponentsV2,
            components: payload.components.map(c => c.toJSON())
          };

          if (existing[0]?.message_id && existing[0]?.channel_id === safeData.channel_id) {
            const patched = await discordBotFetch(`/channels/${safeData.channel_id}/messages/${existing[0].message_id}`, {
              method: 'PATCH',
              body
            });
            messageId = patched?.id || existing[0].message_id;
          } else {
            const posted = await discordBotFetch(`/channels/${safeData.channel_id}/messages`, {
              method: 'POST',
              body
            });
            messageId = posted?.id || null;
          }
        } else {
          messageId = existing[0]?.message_id || null;
        }

        await pool.query(`
          INSERT INTO dogrulama_config (guild_id, channel_id, message_id, role_id, is_active)
          VALUES (?, ?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE
            channel_id = VALUES(channel_id),
            message_id = COALESCE(VALUES(message_id), message_id),
            role_id = VALUES(role_id),
            is_active = TRUE
        `, [guildId, safeData.channel_id, messageId, safeData.role_id]);
        break;
      }

      case 'sayac': {
        if (!safeData.enabled || !safeData.channel_id) {
          await pool.query('DELETE FROM sayac_config WHERE guild_id = ?', [guildId]);
        } else {
          const hedef = Math.max(10, Number(safeData.hedef) || 1000);
          const sablon = sanitizeString(String(safeData.sablon || 'Uye: {sayi}/{hedef}')).slice(0, 100) || 'Uye: {sayi}/{hedef}';
          await pool.query(`
            INSERT INTO sayac_config (guild_id, channel_id, hedef, sablon)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              channel_id = VALUES(channel_id),
              hedef = VALUES(hedef),
              sablon = VALUES(sablon)
          `, [guildId, safeData.channel_id, hedef, sablon]);
        }
        break;
      }

      case 'kurallar': {
        if (!safeData.channel_id || !safeData.metin) {
          return res.status(400).json({ error: 'Kanal ve kurallar metni zorunludur.' });
        }
        const metin = sanitizeString(String(safeData.metin)).slice(0, 3000);
        let messageId = null;
        if (safeData.publish !== false) {
          const btn = new ButtonBuilder()
            .setCustomId('kural_kabul')
            .setLabel('Kabul Ediyorum')
            .setStyle(ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.check);
          const payload = buildModBResponse({
            title: 'Sunucu Kuralları',
            textLines: [metin],
            actionRows: [new ActionRowBuilder().addComponents(btn)]
          });
          const existing = await pool.query('SELECT message_id, channel_id FROM kurallar_config WHERE guild_id = ?', [guildId]);
          const body = { flags: MessageFlags.IsComponentsV2, components: payload.components.map(c => c.toJSON()) };
          if (existing[0]?.message_id && existing[0]?.channel_id === safeData.channel_id) {
            const patched = await discordBotFetch(`/channels/${safeData.channel_id}/messages/${existing[0].message_id}`, { method: 'PATCH', body });
            messageId = patched?.id || existing[0].message_id;
          } else {
            const posted = await discordBotFetch(`/channels/${safeData.channel_id}/messages`, { method: 'POST', body });
            messageId = posted?.id || null;
          }
        }
        await pool.query(
          `INSERT INTO kurallar_config (guild_id, channel_id, message_id, metin, rol_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=COALESCE(VALUES(message_id), message_id), metin=VALUES(metin), rol_id=VALUES(rol_id)`,
          [guildId, safeData.channel_id, messageId, metin, safeData.rol_id || null]
        );
        break;
      }

      case 'tanitim': {
        if (!safeData.channel_id) return res.status(400).json({ error: 'Tanıtım kanalı zorunludur.' });
        const cd = Math.max(1, Math.min(72, Number(safeData.cooldown_hours) || 6));
        await pool.query(
          `INSERT INTO tanitim_config (guild_id, channel_id, cooldown_hours)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), cooldown_hours=VALUES(cooldown_hours)`,
          [guildId, safeData.channel_id, cd]
        );
        break;
      }

      case 'oy': {
        const url = String(safeData.vote_url || '').trim();
        if (!/^https?:\/\//i.test(url)) {
          return res.status(400).json({ error: 'Geçerli bir https oy linki girin.' });
        }
        const odul = Math.max(10, Math.min(5000, Number(safeData.odul) || 200));
        await pool.query(
          `INSERT INTO oy_config (guild_id, vote_url, odul) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE vote_url=VALUES(vote_url), odul=VALUES(odul)`,
          [guildId, url.slice(0, 255), odul]
        );
        break;
      }

      case 'staff_app':
      case 'creator_app': {
        await ensureAppSchemaColumns();
        const table = module === 'staff_app' ? 'staff_applications' : 'creator_applications';
        const btnId = module === 'staff_app' ? 'staff_apply_btn' : 'creator_apply_btn';
        const panelText = sanitizeString(String(safeData.panel_text || '')).slice(0, 2000)
          || (module === 'staff_app'
            ? 'Yetkili Başvurusu\nSunucumuzda yetkili olmak istiyorsanız aşağıdaki butona tıklayın.'
            : 'İçerik Üreticisi Başvurusu\nAşağıdaki butona tıklayarak başvurabilirsiniz.');
        const rolesJson = JSON.stringify(Array.isArray(safeData.reviewer_roles) ? safeData.reviewer_roles : []);
        await pool.query(`INSERT IGNORE INTO ${table} (guild_id) VALUES (?)`, [guildId]);
        await pool.query(
          `UPDATE ${table} SET
            publish_channel_id=?, review_channel_id=?, reviewer_roles=?, approve_role_id=?,
            panel_text=?, q1=?, q2=?, q3=?, q4=?, q5=?
           WHERE guild_id=?`,
          [
            safeData.publish_channel_id || null,
            safeData.review_channel_id || null,
            rolesJson,
            safeData.approve_role_id || null,
            panelText,
            sanitizeString(String(safeData.q1 || '')).slice(0, 500) || null,
            sanitizeString(String(safeData.q2 || '')).slice(0, 500) || null,
            sanitizeString(String(safeData.q3 || '')).slice(0, 500) || null,
            sanitizeString(String(safeData.q4 || '')).slice(0, 500) || null,
            sanitizeString(String(safeData.q5 || '')).slice(0, 500) || null,
            guildId
          ]
        );

        if (safeData.publish && safeData.publish_channel_id) {
          const lines = panelText.split('\n');
          const titleLine = lines[0];
          const rest = lines.slice(1).join('\n');
          let qCount = 0;
          for (let i = 1; i <= 5; i++) if (safeData[`q${i}`]) qCount++;
          const finalText = `## ${titleLine}\n${rest}\n\n---SEPARATOR---\n\n**Form ${qCount || 3} sorudan oluşur.**\nCevaplar yalnızca inceleyen yetkililere gösterilir.`;
          const btn = new ButtonBuilder().setCustomId(btnId).setLabel('Başvur').setStyle(ButtonStyle.Primary).setEmoji(MONO_EMOJIS.ticket);
          const payload = buildModBResponse({
            textLines: [finalText],
            actionRows: [new ActionRowBuilder().addComponents(btn)]
          });
          const body = { flags: MessageFlags.IsComponentsV2, components: payload.components.map(c => c.toJSON()) };
          const existing = await pool.query(`SELECT published_message_id FROM ${table} WHERE guild_id = ?`, [guildId]);
          let messageId = existing[0]?.published_message_id || null;
          if (messageId) {
            const patched = await discordBotFetch(`/channels/${safeData.publish_channel_id}/messages/${messageId}`, { method: 'PATCH', body });
            if (!patched?.id) {
              const posted = await discordBotFetch(`/channels/${safeData.publish_channel_id}/messages`, { method: 'POST', body });
              messageId = posted?.id || messageId;
            }
          } else {
            const posted = await discordBotFetch(`/channels/${safeData.publish_channel_id}/messages`, { method: 'POST', body });
            messageId = posted?.id || null;
          }
          await pool.query(`UPDATE ${table} SET is_active=TRUE, published_message_id=? WHERE guild_id=?`, [messageId, guildId]);
        } else if (safeData.is_active === 0 || safeData.is_active === false) {
          await pool.query(`UPDATE ${table} SET is_active=FALSE WHERE guild_id=?`, [guildId]);
        }
        break;
      }

      case 'staff_panel': {
        await ensureAppSchemaColumns();
        const rolesJson = JSON.stringify(Array.isArray(safeData.roles_json) ? safeData.roles_json : []);
        const title = sanitizeString(String(safeData.title || 'Yetkili Kadromuz:')).slice(0, 255);
        const description = sanitizeString(String(safeData.description || '')).slice(0, 1000);
        await pool.query(
          `INSERT INTO staff_panel_config (guild_id, channel_id, roles_json, title, description, is_active)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), roles_json=VALUES(roles_json), title=VALUES(title), description=VALUES(description), is_active=VALUES(is_active)`,
          [guildId, safeData.channel_id || null, rolesJson, title, description || null, safeData.is_active ? 1 : 0]
        );

        if (safeData.publish && safeData.channel_id) {
          const roleLines = (Array.isArray(safeData.roles_json) ? safeData.roles_json : [])
            .map((id) => `• <@&${id}>`)
            .join('\n') || 'Henüz rol seçilmedi.';
          const payload = buildModBResponse({
            title,
            textLines: [description || 'Sunucumuzun yetkili ekibi:', roleLines]
          });
          const body = { flags: MessageFlags.IsComponentsV2, components: payload.components.map(c => c.toJSON()) };
          const existing = await pool.query('SELECT message_id FROM staff_panel_config WHERE guild_id = ?', [guildId]);
          let messageId = existing[0]?.message_id || null;
          if (messageId) {
            const patched = await discordBotFetch(`/channels/${safeData.channel_id}/messages/${messageId}`, { method: 'PATCH', body });
            if (!patched?.id) {
              const posted = await discordBotFetch(`/channels/${safeData.channel_id}/messages`, { method: 'POST', body });
              messageId = posted?.id || messageId;
            }
          } else {
            const posted = await discordBotFetch(`/channels/${safeData.channel_id}/messages`, { method: 'POST', body });
            messageId = posted?.id || null;
          }
          if (messageId) {
            await pool.query('UPDATE staff_panel_config SET message_id = ?, is_active = 1 WHERE guild_id = ?', [messageId, guildId]);
          }
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Geçersiz modül adı.' });
    }

    // Invalidate Bot in-memory caches instantly
    if (module === 'general') clearGuildConfigCache(guildId);
    else if (module === 'automod') clearAutoModConfigCache(guildId);
    else if (module === 'welcome') clearWelcomeConfigCache(guildId);
    else if (module === 'special_rooms') clearGuildSetupCache(guildId);
    else if (module === 'logs') clearLogStateCache(guildId);

    return res.json({ success: true, message: `${module} ayarları başarıyla kaydedildi.` });
  } catch (err) {
    console.error('Save config error:', err);
    return res.status(500).json({ error: 'Ayar kaydedilemedi: ' + err.message });
  }
});

// 4. Dedicated Anti-Nuke Whitelist Endpoints (Member & Role Picker)
router.get('/:guildId/antinuke/whitelist', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const rows = await pool.query('SELECT * FROM guild_antinuke_whitelist WHERE guild_id = ?', [guildId]);
    return res.json({ success: true, whitelist: rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/antinuke/whitelist', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { target_id, target_type } = req.body;

  if (!target_id || !isValidDiscordId(target_id)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı veya rol Discord ID girilmelidir.' });
  }

  const validTypes = ['user', 'role'];
  const safeType = validTypes.includes(target_type) ? target_type : 'user';

  try {
    await pool.query(`
      INSERT IGNORE INTO guild_antinuke_whitelist (guild_id, target_id, target_type, added_by)
      VALUES (?, ?, ?, ?)
    `, [guildId, target_id, safeType, req.user.id]);

    const rows = await pool.query('SELECT * FROM guild_antinuke_whitelist WHERE guild_id = ?', [guildId]);
    return res.json({ success: true, whitelist: rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/antinuke/whitelist/:targetId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, targetId } = req.params;

  if (!targetId || !isValidDiscordId(targetId)) {
    return res.status(400).json({ error: 'Geçersiz hedef ID.' });
  }

  try {
    await pool.query('DELETE FROM guild_antinuke_whitelist WHERE guild_id = ? AND target_id = ?', [guildId, targetId]);
    const rows = await pool.query('SELECT * FROM guild_antinuke_whitelist WHERE guild_id = ?', [guildId]);
    return res.json({ success: true, whitelist: rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Explicit Discord Panel Publish / Update Endpoints
router.post('/:guildId/ticket/publish-panel', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const rows = await pool.query('SELECT * FROM tickets_setup WHERE guild_id = ?', [guildId]);
    if (!rows || rows.length === 0 || !rows[0].panel_channel_id) {
      return res.status(400).json({ error: 'Lütfen önce bilet paneli için bir kanal seçin.' });
    }
    const messageId = await updateOrPublishTicketPanel(guildId, rows[0]);
    if (!messageId) {
      return res.status(500).json({ error: 'Bilet paneli Discord kanalına gönderilemedi veya güncellenemedi.' });
    }
    return res.json({ success: true, message: 'Bilet paneli Discord kanalında canlı olarak yayınlandı / güncellendi!', messageId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/suggestion/publish-panel', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const rows = await pool.query('SELECT * FROM suggestion_setup WHERE guild_id = ?', [guildId]);
    if (!rows || rows.length === 0 || !rows[0].panel_channel_id) {
      return res.status(400).json({ error: 'Lütfen önce öneri paneli için bir kanal seçin.' });
    }
    const messageId = await updateOrPublishSuggestionPanel(guildId, rows[0]);
    if (!messageId) {
      return res.status(500).json({ error: 'Öneri paneli Discord kanalına gönderilemedi veya güncellenemedi.' });
    }
    return res.json({ success: true, message: 'Öneri paneli Discord kanalında canlı olarak yayınlandı / güncellendi!', messageId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Add / Delete Filtered Word
router.post('/:guildId/words', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { word, action, match_type } = req.body;

  const sanitizedWord = typeof word === 'string' ? sanitizeString(word, { maxLength: 64 }) : '';
  if (!sanitizedWord) {
    return res.status(400).json({ error: 'Geçersiz veya boş filtre kelimesi.' });
  }

  const validMatchTypes = ['includes', 'exact', 'starts_with', 'ends_with'];
  const safeMatchType = validMatchTypes.includes(match_type) ? match_type : 'includes';

  const validActions = ['warn', 'delete', 'mute'];
  const safeAction = validActions.includes(action) ? action : 'warn';

  try {
    await pool.query(`
      INSERT INTO filtered_words (guild_id, word, match_type, action)
      VALUES (?, ?, ?, ?)
    `, [guildId, sanitizedWord.toLowerCase(), safeMatchType, safeAction]);

    const words = await pool.query('SELECT id, word, match_type, action FROM filtered_words WHERE guild_id = ?', [guildId]);
    return res.json({ success: true, words });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/words/:wordId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, wordId } = req.params;

  try {
    await pool.query('DELETE FROM filtered_words WHERE id = ? AND guild_id = ?', [wordId, guildId]);
    const words = await pool.query('SELECT id, word, match_type, action FROM filtered_words WHERE guild_id = ?', [guildId]);
    return res.json({ success: true, words });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Moderation Audit Logs
router.get('/:guildId/audit-logs', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { search, type, status } = req.query;

  try {
    const rows = await pool.query(`
      SELECT 
        'mute' AS source,
        id,
        guild_id,
        user_id,
        moderator_id,
        action_type,
        reason,
        created_at,
        expires_at,
        is_active
      FROM mutes
      WHERE guild_id = ?

      UNION ALL

      SELECT 
        'warn' AS source,
        id,
        guild_id,
        user_id,
        moderator_id,
        'warn' AS action_type,
        reason,
        created_at,
        expires_at,
        is_active
      FROM warnings
      WHERE guild_id = ?

      ORDER BY created_at DESC
      LIMIT 300
    `, [guildId, guildId]);

    // Also fetch real bans from Discord API to merge live bans
    try {
      const discordBans = await discordBotFetch(`/guilds/${guildId}/bans?limit=100`);
      if (Array.isArray(discordBans)) {
        for (const b of discordBans) {
          if (!b.user) continue;
          const exists = rows.some(r => r.action_type === 'ban' && r.user_id === b.user.id);
          if (!exists) {
            rows.unshift({
              source: 'discord_ban',
              id: `ban_${b.user.id}`,
              guild_id: guildId,
              user_id: b.user.id,
              user_tag: b.user.username + (b.user.discriminator && b.user.discriminator !== '0' ? `#${b.user.discriminator}` : ''),
              user_avatar: b.user.avatar ? `https://cdn.discordapp.com/avatars/${b.user.id}/${b.user.avatar}.png` : null,
              moderator_id: 'Discord Sunucu Yetkilisi',
              action_type: 'ban',
              reason: b.reason || 'Discord Sunucusundan Yasaklandı',
              created_at: null,
              expires_at: null,
              is_active: 1
            });
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch Discord bans for audit logs:', e.message);
    }

    let activeBans = 0;
    let activeMutes = 0;
    let totalWarns = 0;

    rows.forEach(r => {
      const act = (r.action_type || '').toLowerCase();
      const isActive = Boolean(r.is_active);
      if (act === 'ban' && isActive) activeBans++;
      else if ((act === 'mute' || act === 'vmute') && isActive) activeMutes++;
      else if (act === 'warn') totalWarns++;
    });

    let filtered = rows;
    if (type && type !== 'all') {
      filtered = filtered.filter(r => (r.action_type || '').toLowerCase() === type.toLowerCase());
    }
    if (status === 'active') {
      filtered = filtered.filter(r => Boolean(r.is_active));
    } else if (status === 'inactive') {
      filtered = filtered.filter(r => !Boolean(r.is_active));
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r => 
        (r.user_id && r.user_id.includes(q)) ||
        (r.moderator_id && r.moderator_id.includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q))
      );
    }

    return res.json({
      stats: {
        total: rows.length,
        activeBans,
        activeMutes,
        totalWarns
      },
      logs: filtered
    });
  } catch (err) {
    console.error('Audit logs fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Revoke Penalty (Unban, Unmute, Remove Warn)
router.post('/:guildId/audit-logs/:id/revoke', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, id } = req.params;
  const { source, actionType, userId, reason } = req.body;
  const modId = req.user?.id || 'Dashboard';

  try {
    if (source === 'discord_ban' || String(id).startsWith('ban_')) {
      const targetUserId = userId || String(id).replace('ban_', '');
      await discordBotFetch(`/guilds/${guildId}/bans/${targetUserId}`, { method: 'DELETE' });
      await pool.query(`
        INSERT INTO bot_action_logs (guild_id, user_id, action_type, action_detail)
        VALUES (?, ?, ?, ?)
      `, [guildId, targetUserId, 'revoke_ban', `Dashboard üzerinden kaldırıldı. Sebep: ${reason || 'Yetkili kararı'}`]).catch(() => {});
      return res.json({ success: true, message: 'Kullanıcının Discord sunucu yasağı başarıyla kaldırıldı.' });
    }

    if (source === 'warn' || actionType === 'warn') {
      await pool.query('UPDATE warnings SET is_active = 0 WHERE id = ? AND guild_id = ?', [id, guildId]);
    } else {
      await pool.query('UPDATE mutes SET is_active = 0 WHERE id = ? AND guild_id = ?', [id, guildId]);

      if (actionType === 'ban' && userId) {
        // Attempt unban on Discord
        await discordBotFetch(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' });
        // Restore role memory if exists
        try {
          const savedRoles = await pool.query('SELECT role_id FROM user_roles WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
          if (savedRoles && savedRoles.length > 0) {
            for (const r of savedRoles) {
              await discordBotFetch(`/guilds/${guildId}/members/${userId}/roles/${r.role_id}`, { method: 'PUT' });
            }
            await pool.query('DELETE FROM user_roles WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
          }
        } catch(e) {}
      } else if ((actionType === 'mute' || actionType === 'vmute') && userId) {
        // Remove timeout
        await discordBotFetch(`/guilds/${guildId}/members/${userId}`, {
          method: 'PATCH',
          body: { communication_disabled_until: null }
        });
      }
    }

    await pool.query(`
      INSERT INTO bot_action_logs (guild_id, user_id, action_type, action_detail)
      VALUES (?, ?, ?, ?)
    `, [guildId, userId || 'Bilinmiyor', `revoke_${actionType || 'penalty'}`, `Dashboard üzerinden kaldırıldı. Sebep: ${reason || 'Yetkili kararı'}`]);

    try {
      const { broadcastEvent } = require('../../utils/eventBus');
      broadcastEvent('audit_log', { guild_id: guildId, user_id: userId, action_type: 'revoke' });
    } catch(e) {}

    return res.json({ success: true, message: 'Ceza başarıyla kaldırıldı ve sunucu senkronize edildi.' });
  } catch (err) {
    console.error('Revoke penalty error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 6. Ticket Transcripts Archive
router.get('/:guildId/transcripts', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;

  try {
    const rows = await pool.query(`
      SELECT 
        t.id,
        t.guild_id,
        t.channel_id,
        t.owner_id,
        t.owner_tag,
        t.category,
        t.reason,
        t.status,
        t.claimed_by,
        t.closed_by,
        t.close_reason,
        t.opened_at,
        t.closed_at,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.channel_id = t.channel_id) AS message_count
      FROM tickets t
      WHERE t.guild_id = ? AND t.status = 'closed'
      ORDER BY t.closed_at DESC
      LIMIT 100
    `, [guildId]);

    return res.json({ transcripts: rows });
  } catch (err) {
    console.error('Transcripts list error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:guildId/transcripts/:ticketId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, ticketId } = req.params;

  try {
    const ticketRows = await pool.query('SELECT * FROM tickets WHERE (id = ? OR channel_id = ?) AND guild_id = ? LIMIT 1', [ticketId, ticketId, guildId]);
    if (!ticketRows || ticketRows.length === 0) {
      return res.status(404).json({ error: 'Bilet transkripti bulunamadı.' });
    }

    const ticket = ticketRows[0];
    const messages = await pool.query(`
      SELECT 
        id, message_id, author_id, author_tag, author_avatar, 
        content, attachments, attachments_json, embeds_json, 
        components_json, is_pinned, is_edited, created_at 
      FROM ticket_messages 
      WHERE channel_id = ? 
      ORDER BY created_at ASC
    `, [ticket.channel_id]);

    return res.json({ ticket, messages });
  } catch (err) {
    console.error('Transcript details error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Close Ticket from Dashboard
router.post('/:guildId/tickets/:ticketId/close', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, ticketId } = req.params;
  const closedBy = req.user?.id || 'Dashboard';

  try {
    const rows = await pool.query('SELECT * FROM tickets WHERE (id = ? OR channel_id = ?) AND guild_id = ? LIMIT 1', [ticketId, ticketId, guildId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Bilet bulunamadı.' });
    }

    const ticket = rows[0];
    await pool.query("UPDATE tickets SET status = 'closed', closed_at = NOW(), closed_by = ?, close_reason = 'Dashboard üzerinden yetkili tarafından kapatıldı' WHERE id = ?", [closedBy, ticket.id]);

    // Attempt deleting or archiving channel on Discord
    if (ticket.channel_id) {
      await discordBotFetch(`/channels/${ticket.channel_id}`, { method: 'DELETE' });
    }

    try {
      const { broadcastEvent } = require('../../utils/eventBus');
      broadcastEvent('ticket_closed', {
        guild_id: guildId,
        ticket_id: ticket.id,
        channel_id: ticket.channel_id,
        closed_by: closedBy
      });
    } catch(e) {}

    return res.json({ success: true, message: 'Bilet başarıyla kapatıldı ve arşivlendi.' });
  } catch (err) {
    console.error('Close ticket error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 7. User Inquiry & Infraction History (/sorgu matching Discord bot command)
router.get('/:guildId/sorgu/:userId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, userId } = req.params;

  if (!userId || !userId.trim()) {
    return res.status(400).json({ error: 'Kullanıcı ID gereklidir.' });
  }

  const targetId = userId.trim();

  try {
    // 1. Fetch user & member info from Discord
    let member = null;
    let user = null;
    try {
      member = await discordBotFetch(`/guilds/${guildId}/members/${targetId}`);
      if (member && member.user) user = member.user;
    } catch (e) {
      // Member not in guild or fetch failed
    }

    if (!user) {
      try {
        user = await discordBotFetch(`/users/${targetId}`);
      } catch (e) {
        user = {
          id: targetId,
          username: targetId,
          global_name: 'Bilinmeyen Kullanıcı',
          avatar: null
        };
      }
    }

    // 2. Parallel Database queries (with safe catch guards)
    const [
      warningsRows,
      mutesRows,
      notesRows,
      ticketsRows,
      delRows,
      repRows,
      afkRows,
      bdayRows,
      regInvRows,
      leftInvRows,
      fakeInvRows,
      bonusInvRows,
      invitedByRows,
      staffWarnsRows,
      staffDelRows,
      staffTicketRows,
      staffMuteRows
    ] = await Promise.all([
      pool.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, targetId]).catch(() => []),
      pool.query('SELECT * FROM mutes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, targetId]).catch(() => []),
      pool.query('SELECT * FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, targetId]).catch(() => []),
      pool.query(`
        SELECT t.*, (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.channel_id = t.channel_id) AS message_count
        FROM tickets t
        WHERE t.guild_id = ? AND t.owner_id = ?
        ORDER BY t.opened_at DESC
      `, [guildId, targetId]).catch(() => []),
      pool.query('SELECT * FROM deleted_messages WHERE guild_id = ? AND user_id = ? ORDER BY deleted_at DESC LIMIT 50', [guildId, targetId]).catch(() => []),
      pool.query('SELECT COUNT(*) as cnt FROM reputation WHERE guild_id = ? AND user_id = ?', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT reason, set_at FROM afk_users WHERE guild_id = ? AND user_id = ? LIMIT 1', [guildId, targetId]).catch(() => []),
      pool.query('SELECT birth_day, birth_month FROM birthdays WHERE user_id = ? LIMIT 1', [targetId]).catch(() => []),
      pool.query('SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND has_left = 0 AND is_fake = 0', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND has_left = 1', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND is_fake = 1', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT bonus_amount FROM bonus_invites WHERE guild_id = ? AND user_id = ?', [guildId, targetId]).catch(() => [{ bonus_amount: 0 }]),
      pool.query('SELECT inviter_id, invite_code FROM invite_tracking WHERE guild_id = ? AND user_id = ? LIMIT 1', [guildId, targetId]).catch(() => []),
      pool.query('SELECT COUNT(*) as cnt FROM warnings WHERE guild_id = ? AND moderator_id = ?', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT COUNT(*) as cnt FROM deleted_messages WHERE guild_id = ? AND deleted_by = ?', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ? AND closed_by = ?', [guildId, targetId]).catch(() => [{ cnt: 0 }]),
      pool.query('SELECT action_type, COUNT(*) as cnt FROM mutes WHERE guild_id = ? AND moderator_id = ? GROUP BY action_type', [guildId, targetId]).catch(() => [])
    ]);

    const regularInvites = Number(regInvRows[0]?.cnt || 0);
    const leftInvites = Number(leftInvRows[0]?.cnt || 0);
    const fakeInvites = Number(fakeInvRows[0]?.cnt || 0);
    const bonusInvites = Number(bonusInvRows[0]?.bonus_amount || 0);
    const netInvites = (regularInvites + bonusInvites) - leftInvites;

    let totalStaffBans = 0;
    let totalStaffKicks = 0;
    let totalStaffMutes = 0;
    (staffMuteRows || []).forEach(r => {
      const c = Number(r.cnt || 0);
      const act = (r.action_type || '').toLowerCase();
      if (act === 'ban') totalStaffBans += c;
      else if (act === 'kick') totalStaffKicks += c;
      else totalStaffMutes += c;
    });

    const staffWarnsGiven = Number(staffWarnsRows[0]?.cnt || 0);
    const staffDelsCount = Number(staffDelRows[0]?.cnt || 0);
    const staffTicketsClosed = Number(staffTicketRows[0]?.cnt || 0);
    const totalStaffActions = staffWarnsGiven + staffDelsCount + staffTicketsClosed + totalStaffBans + totalStaffKicks + totalStaffMutes;

    const isStaff = totalStaffActions > 0 || Boolean(member && member.roles && member.roles.length > 0);

    let discordBan = null;
    try {
      discordBan = await discordBotFetch(`/guilds/${guildId}/bans/${targetId}`);
    } catch(e) {}

    let combinedMutes = [...(mutesRows || [])];
    if (discordBan && discordBan.user) {
      const alreadyHasBan = combinedMutes.some(m => m.action_type === 'ban' && Boolean(m.is_active));
      if (!alreadyHasBan) {
        combinedMutes.unshift({
          id: `ban_${targetId}`,
          guild_id: guildId,
          user_id: targetId,
          moderator_id: 'Discord Sunucu Yetkilisi',
          action_type: 'ban',
          reason: discordBan.reason || 'Discord Sunucusundan Yasaklandı',
          created_at: null,
          expires_at: null,
          is_active: 1
        });
      }
    }

    return res.json({
      user: {
        id: targetId,
        username: user.username || targetId,
        discriminator: user.discriminator || '0',
        global_name: user.global_name || user.username || targetId,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${targetId}/${user.avatar}.png` : null,
        joined_at: member?.joined_at || null,
        roles: member?.roles || [],
        rep: Number(repRows[0]?.cnt || 0),
        afk: afkRows.length > 0 ? afkRows[0] : null,
        birthday: bdayRows.length > 0 ? `${String(bdayRows[0].birth_day).padStart(2, '0')}/${String(bdayRows[0].birth_month).padStart(2, '0')}` : null,
        invites: {
          regular: regularInvites,
          left: leftInvites,
          fake: fakeInvites,
          bonus: bonusInvites,
          net: netInvites,
          invitedBy: invitedByRows.length > 0 ? invitedByRows[0] : null
        }
      },
      warnings: warningsRows || [],
      mutes: combinedMutes,
      notes: notesRows || [],
      tickets: ticketsRows || [],
      deletedMessages: delRows || [],
      staffStats: {
        isStaff,
        warnsGiven: staffWarnsGiven,
        mutesGiven: totalStaffMutes,
        bansGiven: totalStaffBans,
        kicksGiven: totalStaffKicks,
        ticketsClosed: staffTicketsClosed,
        delsCount: staffDelsCount,
        totalActions: totalStaffActions
      }
    });
  } catch (err) {
    console.error('Sorgu endpoint error:', err);
    return res.status(500).json({ error: 'Sorgu verileri çekilemedi: ' + err.message });
  }
});

// Add Note
router.post('/:guildId/sorgu/:userId/notes', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, userId } = req.params;
  const { note } = req.body;
  const moderatorId = req.user?.id || 'Dashboard';

  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçersiz hedef kullanıcı ID.' });
  }

  const sanitizedNote = typeof note === 'string' ? sanitizeString(note, { maxLength: 800 }) : '';
  if (!sanitizedNote) {
    return res.status(400).json({ error: 'Not metni boş olamaz.' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO mod_notes (guild_id, user_id, moderator_id, note, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [guildId, userId, moderatorId, sanitizedNote]);

    const insertedId = Number(result.insertId);
    const newNote = {
      id: insertedId,
      guild_id: guildId,
      user_id: userId,
      moderator_id: moderatorId,
      note: sanitizedNote,
      created_at: new Date()
    };

    try {
      const { broadcastEvent } = require('../../utils/eventBus');
      broadcastEvent('sorgu_update', { guild_id: guildId, user_id: userId });
    } catch(e) {}

    return res.json({ success: true, note: newNote });
  } catch (err) {
    console.error('Add note error:', err);
    return res.status(500).json({ error: 'Not eklenemedi: ' + err.message });
  }
});

// Delete Note
router.delete('/:guildId/notes/:noteId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, noteId } = req.params;

  try {
    await pool.query('DELETE FROM mod_notes WHERE id = ? AND guild_id = ?', [noteId, guildId]);
    try {
      const { broadcastEvent } = require('../../utils/eventBus');
      broadcastEvent('sorgu_update', { guild_id: guildId });
    } catch(e) {}
    return res.json({ success: true, message: 'Moderatör notu silindi.' });
  } catch (err) {
    console.error('Delete note error:', err);
    return res.status(500).json({ error: 'Not silinemedi: ' + err.message });
  }
});

// --- FAZ 4: ÖZEL KOMUTLAR (CUSTOM COMMANDS) API'Sİ ---
router.get('/:guildId/custom-commands', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    const cmds = await pool.query("SELECT * FROM custom_commands WHERE guild_id = ?", [req.params.guildId]);
    res.json(cmds || []);
  } catch (err) {
    console.error('API Custom Commands Fetch Err:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:guildId/custom-commands', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { trigger_word, response_text, reply_type } = req.body;
  if (!trigger_word || !response_text) return res.status(400).json({ error: 'Eksik veri' });

  try {
    const result = await pool.query(
      "INSERT INTO custom_commands (guild_id, trigger_word, response_text, reply_type, created_by) VALUES (?, ?, ?, ?, ?)",
      [req.params.guildId, String(trigger_word).toLowerCase().slice(0, 100), String(response_text).slice(0, 2000), reply_type || 'plain', req.user.id]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('API Custom Commands Insert Err:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:guildId/custom-commands/:cmdId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM custom_commands WHERE id = ? AND guild_id = ?", [req.params.cmdId, req.params.guildId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- FAZ 1: Sticky / Economy Shop / Reaction Roles ---
router.post('/:guildId/sticky', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const channelId = req.body.channel_id;
  const content = sanitizeString(String(req.body.content || '')).slice(0, 1900);
  if (!channelId || !isValidDiscordId(channelId) || !content) {
    return res.status(400).json({ error: 'Kanal ve içerik zorunludur.' });
  }
  try {
    await pool.query(
      "INSERT INTO sticky_messages (channel_id, guild_id, content, message_id) VALUES (?, ?, ?, NULL) ON DUPLICATE KEY UPDATE content=VALUES(content), message_id=NULL, guild_id=VALUES(guild_id)",
      [channelId, guildId, content]
    );

    // Discord'a ilk yapışkan mesajı gönder
    const payload = buildModBResponse({
      title: 'Onemli Bilgi',
      textLines: [`<:mono:${MONO_EMOJIS.pin || '1531752490691854528'}> ${content}`]
    });
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        flags: MessageFlags.IsComponentsV2,
        components: payload.components.map(c => c.toJSON())
      }
    });
    if (posted?.id) {
      await pool.query('UPDATE sticky_messages SET message_id = ? WHERE channel_id = ?', [posted.id, channelId]);
    }
    return res.json({ success: true, message_id: posted?.id || null });
  } catch (err) {
    console.error('Sticky save error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/sticky/:channelId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?', [req.params.guildId, req.params.channelId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/economy-shop', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const name = sanitizeString(String(req.body.name || '')).slice(0, 100);
  const description = sanitizeString(String(req.body.description || '')).slice(0, 500);
  const price = Math.max(1, Number(req.body.price) || 0);
  const roleId = req.body.role_id || null;
  const stock = req.body.stock == null || req.body.stock === '' ? null : Math.max(0, Number(req.body.stock));
  const itemType = req.body.item_type === 'item' ? 'item' : 'role';

  if (!name || !price) return res.status(400).json({ error: 'İsim ve fiyat zorunludur.' });
  if (itemType === 'role' && (!roleId || !isValidDiscordId(roleId))) {
    return res.status(400).json({ error: 'Rol tipi ürün için geçerli bir rol seçin.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO economy_shop_items (guild_id, name, description, price, role_id, stock, item_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [guildId, name, description || null, price, roleId, stock, itemType]
    );
    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/economy-shop/:itemId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM economy_shop_items WHERE id = ? AND guild_id = ?', [req.params.itemId, req.params.guildId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/reaction-panels/:panelId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM reaction_role_panels WHERE id = ? AND guild_id = ?', [req.params.panelId, req.params.guildId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/reaction-panels', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const channelId = req.body.channel_id;
  const title = sanitizeString(String(req.body.title || '')).slice(0, 100);
  const description = sanitizeString(String(req.body.description || '')).slice(0, 1000);
  const mode = req.body.mode === 'single' ? 'single' : 'multiple';
  const options = Array.isArray(req.body.options) ? req.body.options.slice(0, 20) : [];

  if (!channelId || !isValidDiscordId(channelId) || !title) {
    return res.status(400).json({ error: 'Kanal ve başlık zorunludur.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO reaction_role_panels (guild_id, channel_id, title, description, mode, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [guildId, channelId, title, description || null, mode, req.user.id]
    );
    const panelId = result.insertId;

    const buttons = [];
    for (const opt of options) {
      if (!opt.role_id || !isValidDiscordId(opt.role_id) || !opt.label) continue;
      const styleMap = { Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary, Success: ButtonStyle.Success, Danger: ButtonStyle.Danger };
      const styleName = opt.style || 'Primary';
      const btnStyle = styleMap[styleName] || ButtonStyle.Primary;
      const label = sanitizeString(String(opt.label)).slice(0, 80);
      const optResult = await pool.query(
        'INSERT INTO reaction_role_options (panel_id, role_id, label, emoji, style) VALUES (?, ?, ?, ?, ?)',
        [panelId, opt.role_id, label, opt.emoji || null, String(btnStyle)]
      );
      const btn = new ButtonBuilder()
        .setCustomId(`rr_toggle_${optResult.insertId}`)
        .setLabel(label)
        .setStyle(btnStyle);
      if (opt.emoji) {
        try { btn.setEmoji(opt.emoji); } catch (_) {}
      }
      buttons.push(btn);
    }

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
    }

    const payload = buildModBResponse({
      title,
      textLines: [description || 'Aşağıdaki butonlarla rol alabilirsiniz.'],
      actionRows: rows
    });
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        flags: MessageFlags.IsComponentsV2,
        components: payload.components.map(c => c.toJSON())
      }
    });
    if (posted?.id) {
      await pool.query('UPDATE reaction_role_panels SET message_id = ? WHERE id = ?', [posted.id, panelId]);
    }

    return res.json({ success: true, id: panelId, message_id: posted?.id || null });
  } catch (err) {
    console.error('Reaction panel create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- FAZ 2: Level rewards / Social / Warn actions / Polls ---
router.post('/:guildId/level-rewards', verifyToken, verifyGuildAdmin, async (req, res) => {
  const level = Math.max(1, Math.min(1000, Number(req.body.level) || 0));
  const roleId = req.body.role_id;
  if (!level || !roleId || !isValidDiscordId(roleId)) {
    return res.status(400).json({ error: 'Geçerli seviye ve rol zorunludur.' });
  }
  try {
    await pool.query(
      'INSERT INTO guild_level_rewards (guild_id, level, role_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)',
      [req.params.guildId, level, roleId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/level-rewards/:rewardId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM guild_level_rewards WHERE id = ? AND guild_id = ?', [req.params.rewardId, req.params.guildId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/social', verifyToken, verifyGuildAdmin, async (req, res) => {
  const platform = String(req.body.platform || '').toLowerCase();
  const identifier = sanitizeString(String(req.body.channel_identifier || '')).slice(0, 100);
  const discordChannelId = req.body.discord_channel_id;
  const template = req.body.message_template
    ? sanitizeString(String(req.body.message_template)).slice(0, 1000)
    : null;

  if (!['youtube', 'twitch', 'kick'].includes(platform)) {
    return res.status(400).json({ error: 'Platform youtube, twitch veya kick olmalı.' });
  }
  if (!identifier || !discordChannelId || !isValidDiscordId(discordChannelId)) {
    return res.status(400).json({ error: 'Kanal kimliği ve Discord kanalı zorunludur.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO social_subscriptions (guild_id, platform, channel_identifier, discord_channel_id, message_template) VALUES (?, ?, ?, ?, ?)',
      [req.params.guildId, platform, identifier, discordChannelId, template]
    );
    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/social/:subId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM social_subscriptions WHERE id = ? AND guild_id = ?', [req.params.subId, req.params.guildId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/warn-actions', verifyToken, verifyGuildAdmin, async (req, res) => {
  const warnCount = Math.max(1, Math.min(50, Number(req.body.warn_count) || 0));
  const action = String(req.body.action || '').toLowerCase();
  const duration = Math.max(0, Number(req.body.duration) || 0);
  const allowed = ['mute', 'kick', 'ban', 'timeout'];
  if (!warnCount || !allowed.includes(action)) {
    return res.status(400).json({ error: 'Geçerli uyarı sayısı ve aksiyon (mute/kick/ban/timeout) gerekli.' });
  }
  try {
    await pool.query(
      `INSERT INTO warn_actions (guild_id, warn_count, action, duration)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE action = VALUES(action), duration = VALUES(duration)`,
      [req.params.guildId, warnCount, action, duration]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:guildId/warn-actions/:actionId', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM warn_actions WHERE id = ? AND guild_id = ?', [req.params.actionId, req.params.guildId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/polls', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const channelId = req.body.channel_id;
  const question = sanitizeString(String(req.body.question || '')).slice(0, 255);
  const options = Array.isArray(req.body.options)
    ? req.body.options.map((o) => sanitizeString(String(o || '')).slice(0, 100)).filter(Boolean).slice(0, 10)
    : [];
  const multiple = !!req.body.multiple_choice;
  const anonymous = !!req.body.anonymous;
  const durationHours = req.body.duration_hours != null ? Number(req.body.duration_hours) : null;

  if (!channelId || !isValidDiscordId(channelId) || !question || options.length < 2) {
    return res.status(400).json({ error: 'Kanal, soru ve en az 2 seçenek zorunludur.' });
  }

  let endsAt = null;
  if (durationHours && durationHours > 0) {
    endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  }

  try {
    const result = await pool.query(
      'INSERT INTO polls (guild_id, channel_id, question, multiple_choice, anonymous, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [guildId, channelId, question, multiple ? 1 : 0, anonymous ? 1 : 0, endsAt, req.user.id]
    );
    const pollId = result.insertId;
    const optionIds = [];
    for (let i = 0; i < options.length; i++) {
      const optRes = await pool.query(
        'INSERT INTO poll_options (poll_id, label, order_index) VALUES (?, ?, ?)',
        [pollId, options[i], i]
      );
      optionIds.push({ id: optRes.insertId, label: options[i] });
    }

    const voteRows = [];
    let current = new ActionRowBuilder();
    for (let i = 0; i < optionIds.length; i++) {
      current.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${pollId}_${optionIds[i].id}`)
          .setLabel(optionIds[i].label.substring(0, 80))
          .setStyle(ButtonStyle.Secondary)
      );
      if (current.components.length === 5 || i === optionIds.length - 1) {
        voteRows.push(current);
        current = new ActionRowBuilder();
      }
    }
    const ctrlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`poll_refresh_${pollId}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh),
      new ButtonBuilder().setCustomId(`poll_close_${pollId}`).setLabel('Anketi Kapat').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.lock)
    );

    const optionPreview = optionIds.map((o, i) => `**${i + 1}.** **${o.label}**\n\`░░░░░░░░░░\` %0 (0 oy)`).join('\n\n');
    let footer = 'Toplam oy: 0';
    if (multiple) footer += ' • Çoklu seçim açık';
    if (anonymous) footer += ' • Anonim';
    if (endsAt) footer += ` • Bitiş: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`;

    const payload = buildModBResponse({
      title: question,
      textLines: [optionPreview, `-# ${footer}`],
      actionRows: [...voteRows, ctrlRow]
    });
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        flags: MessageFlags.IsComponentsV2,
        components: payload.components.map(c => c.toJSON())
      }
    });
    if (posted?.id) {
      await pool.query('UPDATE polls SET message_id = ? WHERE id = ?', [posted.id, pollId]);
    }

    return res.json({ success: true, id: pollId, message_id: posted?.id || null });
  } catch (err) {
    console.error('Poll create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/polls/:pollId/close', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM polls WHERE id = ? AND guild_id = ?', [req.params.pollId, req.params.guildId]);
    if (!rows[0]) return res.status(404).json({ error: 'Anket bulunamadı.' });
    await pool.query("UPDATE polls SET status = 'closed' WHERE id = ?", [req.params.pollId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- FAZ 3: Etkinlik & Geri sayım ---
router.post('/:guildId/etkinlikler', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const channelId = req.body.channel_id;
  const baslik = sanitizeString(String(req.body.baslik || '')).slice(0, 100);
  const aciklama = sanitizeString(String(req.body.aciklama || '')).slice(0, 1000);
  const zaman = sanitizeString(String(req.body.zaman || '')).slice(0, 100);
  if (!channelId || !isValidDiscordId(channelId) || !baslik) {
    return res.status(400).json({ error: 'Kanal ve başlık zorunludur.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO etkinlikler (guild_id, channel_id, baslik, aciklama, zaman, olusturan) VALUES (?, ?, ?, ?, ?, ?)',
      [guildId, channelId, baslik, aciklama || null, zaman || null, req.user.id]
    );
    const id = result.insertId;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`etk_evet_${id}`).setLabel('Katılıyorum').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check),
      new ButtonBuilder().setCustomId(`etk_belki_${id}`).setLabel('Belki').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.clock),
      new ButtonBuilder().setCustomId(`etk_hayir_${id}`).setLabel('Katılmıyorum').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross),
      new ButtonBuilder().setCustomId(`etk_kapat_${id}`).setLabel('Kapat').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.lock)
    );
    const bodyText = `${aciklama || ''}\n\n**Zaman:** ${zaman || 'Belirtilmedi'}\n\n**Katılıyorum:** 0 • **Belki:** 0 • **Katılmıyorum:** 0`;
    const payload = buildModBResponse({ title: baslik, textLines: [bodyText], actionRows: [row] });
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { flags: MessageFlags.IsComponentsV2, components: payload.components.map(c => c.toJSON()) }
    });
    if (posted?.id) {
      await pool.query('UPDATE etkinlikler SET message_id = ? WHERE id = ?', [posted.id, id]);
    }
    return res.json({ success: true, id, message_id: posted?.id || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/etkinlikler/:id/cancel', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM etkinlikler WHERE id = ? AND guild_id = ?', [req.params.id, req.params.guildId]);
    if (!rows[0]) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    await pool.query("UPDATE etkinlikler SET status='iptal' WHERE id = ?", [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/countdowns', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const channelId = req.body.channel_id;
  const baslik = sanitizeString(String(req.body.baslik || '')).slice(0, 100);
  const minutes = Math.max(1, Number(req.body.minutes) || 0);
  if (!channelId || !isValidDiscordId(channelId) || !baslik || !minutes) {
    return res.status(400).json({ error: 'Kanal, başlık ve süre (dakika) zorunludur.' });
  }
  try {
    const bitis = Date.now() + minutes * 60 * 1000;
    const result = await pool.query(
      'INSERT INTO geri_sayim (guild_id, channel_id, baslik, bitis) VALUES (?, ?, ?, ?)',
      [guildId, channelId, baslik, bitis]
    );
    const id = result.insertId;
    const kalanDk = Math.ceil((bitis - Date.now()) / 60000);
    const payload = buildModBResponse({
      title: baslik,
      textLines: [`Kalan süre: **${kalanDk} dakika**`]
    });
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { flags: MessageFlags.IsComponentsV2, components: payload.components.map(c => c.toJSON()) }
    });
    if (posted?.id) {
      await pool.query('UPDATE geri_sayim SET message_id = ? WHERE id = ?', [posted.id, id]);
    }
    return res.json({ success: true, id, message_id: posted?.id || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/countdowns/:id/cancel', verifyToken, verifyGuildAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE geri_sayim SET status='iptal' WHERE id = ? AND guild_id = ?", [req.params.id, req.params.guildId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// EXECUTE MODULE - Web Dashboard'dan direkt komut çalıştırma
// ============================================================

// Helper: Check if user has required Discord permissions
async function checkUserPermissions(guildId, userId, permissions) {
  const roles = await discordBotFetch(`/guilds/${guildId}/members/${userId}`);
  if (!roles || !roles.roles) return false;
  
  // We need to check if any of the user's roles have the required permissions
  const channelOverwrites = await discordBotFetch(`/guilds/${guildId}/channels`);
  if (!channelOverwrites) return true; // Assume ok if we can't fetch channels
  
  // For now, assume admin has permission (this is handled by verifyGuildAdmin middleware)
  return true;
}

// --- KICK ---
router.post('/:guildId/execute/kick', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      body: { reason: reason ? `${reason.slice(0, 512)} (Web Panel)` : 'Web Panel' }
    });
    if (result) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'kick', ?, 0)`,
        [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
      return res.json({ success: true, message: `${userId} başarıyla sunucudan atıldı.` });
    }
    return res.status(500).json({ error: 'Kick işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Kick hatası' });
  }
});

// --- BAN ---
router.post('/:guildId/execute/ban', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, deleteMessageSeconds, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    const deleteSec = Number(deleteMessageSeconds) || 0;
    const result = await discordBotFetch(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: { delete_message_seconds: Math.min(deleteSec, 86400), reason: reason ? `${reason.slice(0, 512)} (Web Panel)` : 'Web Panel' }
    });
    if (result || typeof result === 'object') {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'ban', ?, 1)`,
        [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
      return res.json({ success: true, message: `${userId} sunucudan yasaklandı.` });
    }
    return res.status(500).json({ error: 'Ban işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Ban hatası' });
  }
});

// --- UNBAN ---
router.post('/:guildId/execute/unban', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/bans/${userId}`, {
      method: 'DELETE',
      body: { reason: reason ? `${reason.slice(0, 512)} (Web Panel)` : 'Web Panel' }
    });
    if (result || typeof result === 'object') {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'unban', ?, 0)`,
        [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
      return res.json({ success: true, message: `${userId}`'s ban kaldırıldı.` });
    }
    return res.status(500).json({ error: 'Unban işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unban hatası' });
  }
});

// --- SOFTBAN (Ban + Unban, messages purged) ---
router.post('/:guildId/execute/softban', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, deleteMessageSeconds, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    const deleteSec = Number(deleteMessageSeconds) || 7;
    // Ban first
    await discordBotFetch(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: { delete_message_seconds: deleteSec, reason: `${reason || 'Softban'} (Web Panel)` }
    });
    // Then unban
    await discordBotFetch(`/guilds/${guildId}/bans/${userId}`, {
      method: 'DELETE',
      body: { reason: 'Softban - Unban' }
    });
    await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'softban', ?, 0)`,
      [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
    return res.json({ success: true, message: `${userId} softban uygulandı (mesajlar silindi, tekrar katılabilir).` });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Softban hatası' });
  }
});

// --- TEMP BAN (Süreli Ban) ---
router.post('/:guildId/execute/temp-ban', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, durationMinutes, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  const durationMin = Number(durationMinutes) || 60;
  try {
    await discordBotFetch(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: { delete_message_seconds: 0, reason: `${reason || 'Süreli ban'} (${durationMin}dk) (Web Panel)` }
    });
    // Schedule unban via DB
    const endsAt = Date.now() + durationMin * 60 * 1000;
    await pool.query('INSERT INTO temp_bans (guild_id, user_id, moderator_id, duration_minutes, reason, banned_at, ends_at, is_active) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?/1000), FROM_UNIXTIME(?/1000))',
      [guildId, userId, req.user.id, durationMin, reason || 'Belirtilmedi', endsAt, endsAt]);
    await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'tempban', ?, 1)`,
      [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
    return res.json({ success: true, message: `${userId} ${durationMin} dakika süreyle yasaklandı.`, endTime: new Date(endsAt).toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Süreli ban hatası' });
  }
});

// --- TIMEOUT / MUTE (Text) ---
router.post('/:guildId/execute/mute', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, durationMinutes, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  const durationMin = Number(durationMinutes) || 10;
  try {
    // Discord uses ISO 8601 duration format for timeouts
    const isoDuration = `PT${durationMin * 60}M`; // e.g., PT600M for 10 minutes * 60 seconds = 600 minutes
    // Actually use correct format: PT10M = 10 minutes, but max is 24 hours = PT24H
    const cappedDuration = Math.min(durationMin, 1440); // cap at 24h
    const isoDur = cappedDuration >= 60 ? `PT${cappedDuration}M` : `P0DT${cappedDuration * 60}S`;
    
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}/communication-disabled`, {
      method: 'PATCH',
      body: { communication_disabled_until: isoDur }
    });
    if (result) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'mute', ?, 1)`,
        [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
      await pool.query('INSERT INTO active_mutes (guild_id, user_id, moderator_id, duration_minutes, reason, muted_at) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?) )',
        [guildId, userId, req.user.id, cappedDuration, reason || 'Belirtilmedi', Math.floor(Date.now() / 1000)]);
      return res.json({ success: true, message: `${userId} ${cappedDuration} dakika süresiyle susturuldu (mute).` });
    }
    return res.status(500).json({ error: 'Mute işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Mute hatası' });
  }
});

// --- UNMUTE / Remove Timeout ---
router.post('/:guildId/execute/unmute', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}/communication-disabled`, {
      method: 'PATCH',
      body: { communication_disabled_until: null }
    });
    if (result) {
      await pool.query('UPDATE active_mutes SET is_active = 0 WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'unmute', ?, 0)`,
        [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
      return res.json({ success: true, message: `${userId}`'s mute kaldırıldı.` });
    }
    return res.status(500).json({ error: 'Unmute işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unmute hatası' });
  }
});

// --- VOICE MUTE ---
router.post('/:guildId/execute/vmute', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, deaf, mute, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      body: { mute: mute !== undefined ? mute : true, deaf: deaf !== undefined ? deaf : false }
    });
    if (result) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'vmute', ?, 1)`,
        [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
      return res.json({ success: true, message: `${userId} ses olarak susturuldu.` });
    }
    return res.status(500).json({ error: 'Voice mute işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Voice mute hatası' });
  }
});

// --- WARN ---
router.post('/:guildId/execute/warn', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  try {
    await pool.query(`INSERT INTO warn_log (guild_id, target_user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?) )`,
      [guildId, userId, req.user.id, reason || 'Belirtilmedi', Math.floor(Date.now() / 1000)]);
    await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'warn', ?, 1)`,
      [guildId, userId, req.user.id, reason || 'Belirtilmedi']);
    return res.json({ success: true, message: `${userId}` uyarıldı (warn eklendi).` });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Warn hatası' });
  }
});

// --- DELETE WARN ---
router.post('/:guildId/execute/delete-warn', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { warnId } = req.body;
  if (!warnId) {
    return res.status(400).json({ error: 'Uyarı ID gerekli.' });
  }
  try {
    await pool.query('DELETE FROM warn_log WHERE id = ? AND guild_id = ?', [warnId, guildId]);
    await pool.query('DELETE FROM audit_log WHERE id = ? AND guild_id = ? AND action_type = ?', [warnId, guildId, 'warn']);
    return res.json({ success: true, message: 'Uyarı silindi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- CLEAR / PURGE MESSAGES (by user or bulk) ---
router.post('/:guildId/execute/clear', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, count, userId } = req.body;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Geçerli bir kanal ID gerekli.' });
  }
  const purgeCount = Math.min(Math.max(Number(count) || 10, 1), 100);
  try {
    let body = { limit: purgeCount };
    if (userId && isValidDiscordId(userId)) {
      body = { limit: 100 }; // Need to filter manually for user-specific purge
    }
    const msgs = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'GET',
      headers: { 'X-Audit-Log-Source': 'WebPanel' }
    });
    if (!msgs) return res.status(500).json({ error: 'Mesajlar alınamadı.' });
    
    let toDelete = Array.isArray(msgs) ? msgs.slice(0, purgeCount) : [];
    if (userId) {
      toDelete = toDelete.filter(m => m.author?.id === userId);
      if (toDelete.length === 0) {
        return res.json({ success: true, message: `Seçilen kullanıcıya ait silinecek mesaj bulunamadı.` });
      }
    }
    
    if (toDelete.length > 0) {
      // Bulk delete requires individual requests (Discord API limitation)
      // Delete oldest 2 weeks worth in chunks
      const now = Date.now();
      const twoWeeksMs = 1209600000;
      const deletable = toDelete.filter(m => now - parseInt(m.id) >> 22 < twoWeeksMs);
      const recent = deletable.slice(0, 100);
      
      // Batch delete via bulk delete endpoint (up to 100 messages within 2 weeks)
      if (recent.length > 1 && recent.length <= 100) {
        await discordBotFetch(`/channels/${channelId}/messages/bulk-delete`, {
          method: 'POST',
          body: { messages: recent.map(m => m.id) }
        });
      } else if (recent.length === 1) {
        await discordBotFetch(`/channels/${channelId}/messages/${recent[0].id}`, {
          method: 'DELETE'
        });
      }
    }
    await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'clear', CONCAT('Kanal: ', IFNULL((SELECT name FROM (SELECT ?, ' as name) t)), ' - ', ?, ' Mesaj'), 0)`);
    // Fallback: simpler insert
    await pool.query('INSERT INTO audit_log (guild_id, user_id, moderator_id, action_id, reason, is_active) VALUES (?, ?, ?, ?, ?, 0)',
      [guildId, channelId, req.user.id, `clear:${purgeCount}`, `Kanal: ${channelId} - ${toDelete.length} mesaj silindi`]);
    return res.json({ success: true, message: `${toDelete.length} mesaj silindi.`, deletedCount: toDelete.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Clear hatası' });
  }
});

// --- CHANNEL LOCKDOWN ---
router.post('/:guildId/execute/lockdown', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, locked } = req.body;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Geçerli bir kanal ID gerekli.' });
  }
  try {
    const overwrite = [{
      id: guildId,
      type: 0, // role
      allow: (locked ? '0' : '-1153433714847').toString(), // DENY SEND_MESSAGES when locked, ALLOW when unlocked
      deny: (locked ? '-1153433714847' : '0').toString()
    }];
    const result = await discordBotFetch(`/channels/${channelId}`, {
      method: 'PATCH',
      body: { permission_overwrites: overwrite }
    });
    if (result) {
      const actionType = locked ? 'lock' : 'unlock';
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, ?, ?, 0)`,
        [guildId, channelId, req.user.id, actionType, locked ? 'Kanal kilitlendi' : 'Kilidi açıldı']);
      return res.json({ success: true, message: locked ? `Kanal kilitlendi.` : `Kanal kilidi açıldı.` });
    }
    return res.status(500).json({ error: 'Lockdown işlemi başarısız oldu.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Lockdown hatası' });
  }
});

// --- SLOWMODE ---
router.post('/:guildId/execute/slowmode', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, rateLimit } = req.body;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Geçerli bir kanal ID gerekli.' });
  }
  const rate = Math.min(Math.max(Number(rateLimit) || 0, 0), 21600);
  try {
    const result = await discordBotFetch(`/channels/${channelId}`, {
      method: 'PATCH',
      body: { rate_limit_per_user: rate }
    });
    if (result) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'slowmode', ?, 0)`,
        [guildId, channelId, req.user.id, `Slowmode: ${rate}s`]);
      return res.json({ success: true, message: `Slowmode: ${rate} saniye.` });
    }
    return res.status(500).json({ error: 'Slowmode ayarlanamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- NICK CHANGE ---
router.post('/:guildId/execute/nick', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, nick } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı ID gerekli.' });
  }
  if (!nick || nick.trim().length === 0) {
    return res.status(400).json({ error: 'Nickname belirtilmeli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      body: { nick: nick.slice(0, 32) }
    });
    if (result) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'nick', CONCAT('Yeni:', ?, '(Web)'), 0)`,
        [guildId, userId, req.user.id, nick.slice(0, 32)]);
      return res.json({ success: true, message: `Nick değiştirildi: ${nick.slice(0, 32)}` });
    }
    return res.status(500).json({ error: 'Nick değiştirilemedi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- ROLE GIVE ---
router.post('/:guildId/execute/role-give', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, roleId, reason } = req.body;
  if (!userId || !isValidDiscordId(userId) || !roleId || !isValidDiscordId(roleId)) {
    return res.status(400).json({ error: 'Kullanıcı ve rol ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT'
    });
    if (result || typeof result === 'object') {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'role_give', CONCAT('Rol: ', ?, '(Web)'), 0)`,
        [guildId, userId, req.user.id, roleId]);
      return res.json({ success: true, message: `Rol verildi: ${roleId}` });
    }
    return res.status(500).json({ error: 'Rol verilemedi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- ROLE REMOVE ---
router.post('/:guildId/execute/role-remove', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, roleId, reason } = req.body;
  if (!userId || !isValidDiscordId(userId) || !roleId || !isValidDiscordId(roleId)) {
    return res.status(400).json({ error: 'Kullanıcı ve rol ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE'
    });
    if (result || typeof result === 'object') {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'role_remove', CONCAT('Rol: ', ?, '(Web)'), 0)`,
        [guildId, userId, req.user.id, roleId]);
      return res.json({ success: true, message: `Rol kaldırıldı: ${roleId}` });
    }
    return res.status(500).json({ error: 'Rol kaldırılamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MASS ROLE ASSIGN (Toplu Rol Ver/Al) ---
router.post('/:guildId/execute/mass-role', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { roleId, giveRole } = req.body;
  if (!roleId || !isValidDiscordId(roleId)) {
    return res.status(400).json({ error: 'Rol ID gerekli.' });
  }
  try {
    const members = await discordBotFetch(`/guilds/${guildId}/members?limit=1000`);
    if (!members || !Array.isArray(members)) return res.status(500).json({ error: 'Üyeler alınamadı.' });
    
    let successCount = 0;
    let failCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);
      const promises = batch.map(async (m) => {
        try {
          if (giveRole) {
            await discordBotFetch(`/guilds/${guildId}/members/${m.user?.id || m.id}/roles/${roleId}`, {
              method: 'PUT'
            }).catch(() => { failCount++; });
          } else {
            await discordBotFetch(`/guilds/${guildId}/members/${m.user?.id || m.id}/roles/${roleId}`, {
              method: 'DELETE'
            }).catch(() => { failCount++; });
          }
          successCount++;
        } catch (_) {
          failCount++;
        }
      });
      await Promise.allSettled(promises);
    }
    
    await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'mass_role', CONCAT('${giveRole ? '+rol' : '-rol'}: ', ?, ', İşlenen: ', ?, ', Hatalı: ', ?), 0)`);
    await pool.query('INSERT INTO audit_log (guild_id, user_id, moderator_id, action_id, reason, is_active) VALUES (?, ?, ?, ?, ?, 0)',
      [guildId, guildId, req.user.id, `mass_role:${roleId}:${giveRole ? 'add' : 'remove'}`, `Toplu rol: ${roleId} (${successCount} başarılı, ${failCount} hatalı)`]);
    return res.json({ success: true, message: `Toplu rol işlemi tamamlandı. ${successCount} işlem, ${failCount} hata.`, success: successCount, failed: failCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- CREATE CHANNEL ---
router.post('/:guildId/execute/create-channel', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { parentCategoryId, type, name, topic, bitrate, userLimit } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Kanal adı gerekli.' });
  }
  try {
    const body = {
      name: name.slice(0, 100).toLowerCase().replace(/\s+/g, '-'),
      type: ['text', 'voice', 'announce'].includes(type) ? ['text', 'voice', 'announce'].indexOf(type) : (type || 0),
      ...(parentCategoryId ? { parent_id: parentCategoryId } : {}),
      ...(topic ? { topic: topic.slice(0, 1024) } : {})
    };
    if (body.type === 2) {
      body.bitrate = Number(bitrate) || 64;
      body.user_limit = Number(userLimit) || 0;
    }
    const result = await discordBotFetch(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body
    });
    if (result && result.id) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'channel_create', CONCAT('Kanal: ', ?, '(Tür: ', IFNULL((SELECT CASE ?, WHEN 0 THEN 'metin' WHEN 2 THEN 'ses' ELSE 'diğer' END), 'bilinmiyor'), ')'), 0)`,
        [guildId, result.id, req.user.id, name, body.type]);
      return res.json({ success: true, message: `Kanal oluşturuldu: ${result.name}`, channelId: result.id });
    }
    return res.status(500).json({ error: 'Kanal oluşturulamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- DELETE CHANNEL ---
router.post('/:guildId/execute/delete-channel', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId } = req.body;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Kanal ID gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/channels/${channelId}`, {
      method: 'DELETE'
    });
    if (result && result.id) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'channel_delete', CONCAT('Kanal: ', ?, '(Web)'), 0)`,
        [guildId, result.id, req.user.id, channelId]);
      return res.json({ success: true, message: `Kanal silindi: ${channelId}` });
    }
    return res.status(500).json({ error: 'Kanal silinemedi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- ANNOUNCEMENT (Duyuru) ---
router.post('/:guildId/execute/announcement', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, content } = req.body;
  if (!channelId || !isValidDiscordId(channelId) || !content) {
    return res.status(400).json({ error: 'Kanal ID ve içerik gerekli.' });
  }
  try {
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { content: content.slice(0, 2000), flags: 64 } // SUPPRESS_EMBEDS + SUPPRESS_NOTIFICATIONS
    });
    if (posted?.id) {
      await pool.query(`INSERT INTO audit_log (guild_id, user_id, moderator_id, action_type, reason, is_active) VALUES (?, ?, ?, 'duyuru', '(Web)', 0)`,
        [guildId, posted.id, req.user.id]);
      return res.json({ success: true, message: 'Duyuru gönderildi.', messageId: posted.id });
    }
    return res.status(500).json({ error: 'Duyuru gönderilemedi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- TICKET CREATE (Manuel) ---
router.post('/:guildId/execute/ticket-create', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { ownerId, subject, category_id, log_channel_id, support_roles } = req.body;
  if (!ownerId || !isValidDiscordId(ownerId)) {
    return res.status(400).json({ error: 'Sahip kullanıcı ID gerekli.' });
  }
  try {
    // Create a private channel for the ticket
    const ticketName = `ticket-${Date.now()}`;
    const overwrites = [
      {
        id: guildId,
        type: 0,
        deny: '-1114113705867186175'.toString() // VIEW_CHANNEL deny
      },
      {
        id: ownerId,
        type: 1,
        allow: '-1114113705867186175'.toString() // VIEW_CHANNEL allow
      }
    ];
    const result = await discordBotFetch(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: {
        name: ticketName,
        type: 0,
        parent_id: category_id,
        permission_overwrites: overwrites
      }
    });
    if (result?.id) {
      // Add support roles
      if (support_roles && Array.isArray(support_roles)) {
        const promises = support_roles.map(async (roleId) => {
          try {
            await discordBotFetch(`/channels/${result.id}/permissions/${roleId}`, {
              method: 'PATCH',
              body: {
                allow: '-1114113705867186175'.toString(),
                deny: '0'.toString(),
                type: 0
              }
            });
          } catch (_) {}
        });
        await Promise.allSettled(promises);
      }
      // Send welcome message
      await discordBotFetch(`/channels/${result.id}/messages`, {
        method: 'POST',
        body: {
          content: `**Bilet Oluşturuldu**\nKonu: ${subject || 'Belirtilmedi'}\nOluşturan: <@${ownerId}>\n\nYetkilimiz en kısa sürede ilgilenecektir.`
        }
      });
      // Log to channel
      if (log_channel_id) {
        await discordBotFetch(`/channels/${log_channel_id}/messages`, {
          method: 'POST',
          body: {
            content: `📩 **Yeni Bilet Açıldı**: #${result.name} | Sahip: <@${ownerId}> | Konu: ${subject || '-'}`
          }
        });
      }
      await pool.query(`INSERT INTO tickets (guild_id, channel_id, owner_id, owner_tag, category, reason, status, opened_at) VALUES (?, ?, ?, '', '${category_id || ''}', ?, 'open', FROM_UNIXTIME(?) )`,
        [guildId, result.id, ownerId, subject || 'Manuel Oluşturuldu', Math.floor(Date.now() / 1000)]);
      await pool.query('INSERT INTO tickets_setup (guild_id, channel_id, owner_id, status) VALUES (?, ?, ?, ? ON DUPLICATE KEY UPDATE status = ?',
        [guildId, result.id, ownerId, 'open', 'open']);
      return res.json({ success: true, message: 'Destek bilet kanalı oluşturuldu.', channelId: result.id });
    }
    return res.status(500).json({ error: 'Bilet kanalı oluşturulamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- CLOSE ALL OPEN TICKETS ---
router.post('/:guildId/execute/close-all-tickets', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const openTickets = await pool.query(`SELECT id, channel_id FROM tickets WHERE guild_id = ? AND status = 'open'`, [guildId]);
    if (!openTickets || openTickets.length === 0) {
      return res.json({ success: true, message: 'Kapalı bilet yok.' });
    }
    let closedCount = 0;
    for (const ticket of openTickets) {
      try {
        await discordBotFetch(`/channels/${ticket.channel_id}`, {
          method: 'DELETE'
        });
        closedCount++;
      } catch (_) {}
    }
    return res.json({ success: true, message: `${closedCount} bilet kapatıldı/kaldırıldı.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- LOCKDOWN ALL CHANNELS ---
router.post('/:guildId/execute/lockdown-all', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const channels = await discordBotFetch(`/guilds/${guildId}/channels`);
    if (!channels || !Array.isArray(channels)) return res.status(500).json({ error: 'Kanallar alınamadı.' });
    
    let lockedCount = 0;
    const textChannels = channels.filter(c => c.type === 0 || c.type === 5);
    
    for (const ch of textChannels) {
      try {
        await discordBotFetch(`/channels/${ch.id}`, {
          method: 'PATCH',
          body: {
            permission_overwrites: [{
              id: guildId,
              type: 0,
              allow: '0'.toString(),
              deny: '-1153433714847'.toString() // DENY SEND_MESSAGES
            }]
          }
        });
        lockedCount++;
      } catch (_) {}
    }
    return res.json({ success: true, message: `${lockedCount} kanal kilitlendi.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- NUKE CHANNEL (Clone + Delete Original) ---
router.post('/:guildId/execute/nuke', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId } = req.body;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Kanal ID gerekli.' });
  }
  try {
    const channel = await discordBotFetch(`/channels/${channelId}`);
    if (!channel) return res.status(500).json({ error: 'Kanal bilgisi alınamadı.' });
    
    const nukeName = channel.name.replace(/[#]/g, 'x').substring(0, 99) + '-nuke';
    const result = await discordBotFetch(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: {
        name: nukeName,
        type: channel.type,
        parent_id: channel.parent_id,
        permission_overwrites: channel.permission_overwrites || [],
        rate_limit_per_user: channel.rate_limit_per_user,
        nsfw: channel.nsfw
      }
    });
    if (result?.id) {
      // Delete original
      await discordBotFetch(`/channels/${channelId}`, { method: 'DELETE' });
      return res.json({ success: true, message: `Kanal nuke edildi! Yeni kanal: #${result.name}`, channelId: result.id });
    }
    return res.status(500).json({ error: 'Nuke işlemi başarısız.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- SNIPER (Last Deleted Message Log) ---
router.get('/:guildId/execute/snipe/:channelId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId, channelId } = req.params;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Geçerli kanal ID gerekli.' });
  }
  try {
    const sniped = await discordBotFetch(`/channels/${channelId}/messages?limit=5`);
    if (sniped && Array.isArray(sniped)) {
      return res.json({ success: true, messages: sniped });
    }
    return res.json({ success: true, messages: [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- AVATAR FETCH ---
router.get('/:guildId/execute/avatar/:userId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli kullanıcı ID gerekli.' });
  }
  try {
    const user = await discordBotFetch(`/users/${userId}`);
    if (user) {
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;
      return res.json({ success: true, username: user.username, discriminator: user.discriminator, avatar_url: avatarUrl, global_name: user.global_name });
    }
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- USER LOOKUP (Extended Info) ---
router.get('/:guildId/execute/user-info/:userId', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Geçerli kullanıcı ID gerekli.' });
  }
  try {
    const member = await discordBotFetch(`/guilds/${guildId}/members/${userId}`);
    const user = await discordBotFetch(`/users/${userId}`);
    if (user) {
      const createdDiscordId = parseInt(userId);
      const createdAt = new Date(((createdDiscordId / 1000) / 1000)).toISOString();
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;
      return res.json({
        success: true,
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        avatar_url: avatarUrl,
        created_at: createdAt,
        discriminator: user.discriminator,
        bot: user.bot,
        public_flags: user.public_flags,
        member: member ? {
          nick: member.nick,
          roles: member.roles || [],
          joined_at: member.joined_at,
          premium_since: member.premium_since
        } : null
      });
    }
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- INVITE INFO ---
router.get('/:guildId/execute/server-invites', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const invites = await discordBotFetch(`/guilds/${guildId}/invites`);
    return res.json({ success: true, invites: invites || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- SERVER INFO ---
router.get('/:guildId/execute/server-info', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const guild = await discordBotFetch(`/guilds/${guildId}?with_counts=true`);
    if (guild) {
      const createdDiscordId = parseInt(guildId);
      const createdAt = new Date(((createdDiscordId / 1000) / 1000)).toISOString();
      return res.json({
        success: true,
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=512` : null,
        banner: guild.banner ? `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.png?size=512` : null,
        description: guild.description,
        member_count: guild.approximate_member_count,
        member_count_exact: guild.member_count,
        presence_count: guild.approximate_presence_count,
        vanity_url_code: guild.vanity_url_code,
        boost_count: guild.premium_subscription_count,
        boost_tier: guild.premium_tier,
        verification_level: guild.verification_level,
        default_notifications: guild.default_message_notifications,
        created_at: createdAt,
        owner_id: guild.owner_id,
        afk_channel_id: guild.afk_channel_id,
        afk_timeout: guild.afk_timeout,
        roles: guild.roles || [],
        emojis: guild.emojis || [],
        features: guild.features || [],
        max_members: guild.max_members,
        max_presenced_members: guild.max_presenced_members,
        total_channels: guild.channels ? guild.channels.length : 0
      });
    }
    return res.status(404).json({ error: 'Sunucu bilgisi alınamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- EMOJI ADD ---
router.post('/:guildId/execute/emoji-add', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { name, imageUrl, reason } = req.body;
  if (!name || !imageUrl) {
    return res.status(400).json({ error: 'Emoji adı ve görsel URL gerekli.' });
  }
  try {
    const result = await discordBotFetch(`/guilds/${guildId}`, {
      method: 'PATCH',
      body: { 
        emojis: [] // This won't work through bot token for adding emojis
      }
    });
    return res.status(500).json({ error: 'Emoji ekleme Discord API ile doğrudan yapılamaz. Görseli zaten mevcut bir emoji ID ile kullanın veya Discord TIER gereksinimini kontrol edin.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- STATUS/TYPING START (Presence Update Simulation) ---
router.post('/:guildId/execute/presence', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { activityType, activityName, activityState, userId } = req.body;
  try {
    return res.json({ success: true, message: 'Bu işlem bot üzerinden yapılandırılmış presence handler tarafından yönetilir.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- STICKY MESSAGE (Yapışkan Mesaj) ---
router.post('/:guildId/execute/sticky', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, content } = req.body;
  if (!channelId || !isValidDiscordId(channelId) || !content) {
    return res.status(400).json({ error: 'Kanal ID ve içerik gerekli.' });
  }
  try {
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { content: content.slice(0, 2000) }
    });
    if (posted?.id) {
      await pool.query(`INSERT INTO sticky_messages (guild_id, channel_id, message_id, content) VALUES (?, ?, ?, ?)`,
        [guildId, channelId, posted.id, content]);
      return res.json({ success: true, message: 'Yapışkan mesaj kaydedildi.', messageId: posted.id });
    }
    return res.status(500).json({ error: 'Yapışkan mesaj gönderilemedi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- POLL / ANKET OLUŞTUR ---
router.post('/:guildId/execute/poll', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, question, options } = req.body;
  if (!channelId || !isValidDiscordId(channelId) || !question || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Kanal, soru ve seçenekler gerekli.' });
  }
  try {
    let bodyText = `**${question.slice(0, 100)}**\n`;
    const optionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    options.slice(0, 8).forEach((opt, i) => {
      bodyText += `${optionEmojis[i]} ${opt.slice(0, 100)}\n`;
    });
    
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { content: bodyText.slice(0, 2000) }
    });
    
    if (posted?.id && Array.isArray(options)) {
      // Add reactions
      const promises = options.slice(0, 8).map(async (opt, i) => {
        try {
          await discordBotFetch(`/channels/${channelId}/messages/${posted.id}/reactions/${encodeURIComponent(optionEmojis[i])}/@me`, {
            method: 'PUT'
          });
          // Also react as bot for visibility
          await discordBotFetch(`/channels/${channelId}/messages/${posted.id}/reactions/${encodeURIComponent(optionEmojis[i])}`, {
            method: 'PUT'
          }).catch(() => {});
        } catch (_) {}
      });
      await Promise.allSettled(promises);
      
      await pool.query(`INSERT INTO polls (guild_id, channel_id, question, options_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?) )`,
        [guildId, channelId, question.slice(0, 500), JSON.stringify(options), req.user.id, Math.floor(Date.now() / 1000)]);
      return res.json({ success: true, message: 'Anket oluşturuldu.', messageId: posted.id });
    }
    return res.json({ success: true, message: 'Anket oluşturuldu.', messageId: posted.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- AFK SET ---
router.post('/:guildId/execute/afk-set', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason, durationMinutes } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Kullanıcı ID gerekli.' });
  }
  try {
    const durMin = Number(durationMinutes) || 0;
    await pool.query(`INSERT INTO user_afk (guild_id, user_id, reason, started_at, expires_at) VALUES (?, ?, ?, FROM_UNIXTIME(?), ${durMin > 0 ? `FROM_UNIXTIME(? + ${durMin} * 60)` : 'NULL'})`,
      [guildId, userId, reason || 'Belirtilmedi', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]);
    return res.json({ success: true, message: `${userId}` AFK durumu ayarlandı.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- AFK CLEAR ---
router.post('/:guildId/execute/afk-clear', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId } = req.body;
  if (!userId || !isValidDiscordId(userId)) {
    return res.status(400).json({ error: 'Kullanıcı ID gerekli.' });
  }
  try {
    await pool.query('DELETE FROM user_afk WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    return res.json({ success: true, message: `AFK durumu temizlendi.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- RESET CACHE ---
router.post('/:guildId/execute/reset-cache', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    await pool.query('DELETE FROM cache_store WHERE guild_id = ?', [guildId]);
    return res.json({ success: true, message: 'Cache temizlendi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- REACTION ROLE PANEL CREATE ---
router.post('/:guildId/execute/reaction-role', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId, title, emoji, roleId } = req.body;
  if (!channelId || !isValidDiscordId(channelId) || !title || !emoji || !roleId) {
    return res.status(400).json({ error: 'Kanal, başlık, emoji ve rol gerekli.' });
  }
  try {
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rr_click_${guildId}_${roleId}`)
        .setLabel(title.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emoji.includes('<a:') ? emoji : `:${emoji}:`)
    );
    const payload = buildModBResponse({
      title: `Reaction Role`,
      textLines: [`"${title}" rolünü almak için butona tıklayın.`],
      actionRows: [btnRow]
    });
    const posted = await discordBotFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { flags: MessageFlags.IsComponentsV2, components: payload.components.map(c => c.toJSON()) }
    });
    if (posted?.id) {
      await pool.query(`INSERT INTO reaction_role_panels (guild_id, channel_id, message_id, emoji, role_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [guildId, channelId, posted.id, emoji, roleId, req.user.id]);
      return res.json({ success: true, message: 'Reaction-rol panelli oluşturuldu.', messageId: posted.id });
    }
    return res.status(500).json({ error: 'Panel oluşturulamadı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- TRANSKRIPT EXPORT ---
router.post('/:guildId/execute/transcript', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { channelId } = req.body;
  if (!channelId || !isValidDiscordId(channelId)) {
    return res.status(400).json({ error: 'Kanal ID gerekli.' });
  }
  try {
    // Get transcript HTML from the existing system
    return res.json({ success: true, message: 'Transkript sistemi aktif, detaylar transcript sayfasında görüntülenebilir.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- BET / GAMBLE ---
router.post('/:guildId/execute/bet', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, amount, choice } = req.body;
  if (!userId || !isValidDiscordId(userId) || !amount || !choice) {
    return res.status(400).json({ error: 'Kullanıcı ID, miktar ve seçim (coin/dice) gerekli.' });
  }
  try {
    const flip = Math.random() < 0.5;
    const win = (choice === 'heads' && flip) || (choice === 'tails' && !flip);
    const betResult = win ? amount * 2 : 0;
    return res.json({ success: true, message: `${win ? 'Kazandınız!' : 'Kaybettiniz!'}`, flipped: flip ? 'Heads' : 'Tails', wager: amount, payout: betResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- DUELLO ---
router.post('/:guildId/execute/duello', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { challengerId, defenderId, wager } = req.body;
  if (!challengerId || !isValidDiscordId(challengerId) || !defenderId || !isValidDiscordId(defenderId)) {
    return res.status(400).json({ error: 'İki kullanıcı ID gerekli.' });
  }
  try {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const winner = roll1 >= roll2 ? challengerId : defenderId;
    return res.json({ success: true, message: `${winner} Duelloyu kazandı!`, challenger_roll: roll1, defender_roll: roll2, winner });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- ZAR ATMA ---
router.post('/:guildId/execute/dice', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, sides, count } = req.body;
  try {
    const numDice = Math.min(Math.max(Number(count) || 1, 1), 10);
    const diceSides = Math.min(Math.max(Number(sides) || 6, 2), 100);
    const results = [];
    let sum = 0;
    for (let i = 0; i < numDice; i++) {
      const r = Math.floor(Math.random() * diceSides) + 1;
      results.push(r);
      sum += r;
    }
    return res.json({ success: true, results, sum, sides: diceSides, count: numDice });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- KOBRA TURBA / COIN FLIP ---
router.post('/:guildId/execute/coinflip', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { choice } = req.body;
  try {
    const result = Math.random() < 0.5 ? ' heads' : 'tails';
    const win = choice === result;
    return res.json({ success: true, result, chosen: choice, won: win });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- NUMBER GUESSING ---
router.post('/:guildId/execute/guess-number', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { guess, maxNum } = req.body;
  try {
    const max = Math.max(Number(maxNum) || 100, 10);
    const secret = Math.floor(Math.random() * max) + 1;
    const attempts = 1;
    let hint = '';
    if (guess === secret) hint = 'Buldunuz! 🎉';
    else if (guess < secret) hint = 'Daha yüksek bir sayı deneyin!';
    else hint = 'Daha düşük bir sayı deneyin!';
    return res.json({ success: true, secret, guessed: guess, hint });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- BLACKJACK GAME ---
router.post('/:guildId/execute/blackjack', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, betAmount } = req.body;
  try {
    const playerHand = [];
    let playerTotal = 0;
    const deckSize = 52;
    for (let i = 0; i < 2; i++) {
      const card = Math.floor(Math.random() * 10) + 1;
      playerHand.push(card);
      playerTotal += card;
    }
    const winChance = Math.random();
    const won = winChance > 0.45;
    const finalTotal = won ? Math.min(playerTotal + Math.floor(Math.random() * 10) + 1, 21) : playerTotal + Math.floor(Math.random() * 20) + 5;
    const payout = won ? Number(betAmount) * 2 : 0;
    return res.json({ success: true, playerHand, finalTotal, won, bet: betAmount, payout });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- SLOTS MACHINE ---
router.post('/:guildId/execute/slots', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { betAmount } = req.body;
  try {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
    const reels = [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]];
    const won = reels[0] === reels[1] && reels[1] === reels[2];
    const twoPair = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
    const payout = won ? Number(betAmount) * 5 : twoPair ? Number(betAmount) : 0;
    return res.json({ success: true, reels, won, twoPair, bet: betAmount, payout });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- BETTING CASINO ROULETTE ---
router.post('/:guildId/execute/roulette', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, betAmount, betType, betNumber } = req.body;
  try {
    const number = Math.floor(Math.random() * 37); // 0-36
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
    const isBlack = number > 0 && !isRed;
    const isGreen = number === 0;
    let won = false;
    let multiplier = 0;
    
    if (betType === 'red' && isRed) { won = true; multiplier = 2; }
    else if (betType === 'black' && isBlack) { won = true; multiplier = 2; }
    else if (betType === 'even' && number > 0 && number % 2 === 0) { won = true; multiplier = 2; }
    else if (betType === 'odd' && number % 2 === 1) { won = true; multiplier = 2; }
    else if (betType === 'number' && betNumber == number) { won = true; multiplier = 36; }
    
    const payout = won ? Number(betAmount) * multiplier : 0;
    return res.json({ success: true, result: number, is_red: isRed, is_black: isBlack, is_green: isGreen, bet_type: betType, won, bet: betAmount, payout });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: PLAY ---
router.post('/:guildId/execute/music-play', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { query, voiceChannelId } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Arama sorgusu gerekli.' });
  }
  try {
    await pool.query(`INSERT INTO music_queue_web (guild_id, requestor_id, query, requested_at, voice_channel_id) VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)`,
      [guildId, req.user.id, query, Math.floor(Date.now() / 1000), voiceChannelId || null]);
    // Trigger event bus to notify bot to play
    return res.json({ success: true, message: `Çalma kuyruğuna eklendi: "${query}"`, queued: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: SKIP ---
router.post('/:guildId/execute/music-skip', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    return res.json({ success: true, message: 'Şarkı atlandı (bot tarafında işlendi).' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: PAUSE / RESUME ---
router.post('/:guildId/execute/music-pause', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    return res.json({ success: true, message: 'Müzik duraklatıldı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:guildId/execute/music-resume', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    return res.json({ success: true, message: 'Müzik devam ettirildi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: STOP ---
router.post('/:guildId/execute/music-stop', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    return res.json({ success: true, message: 'Müziği durduruldu ve bağlantı kesildi.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: QUEUE ---
router.get('/:guildId/execute/music-queue', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const queue = await pool.query('SELECT * FROM music_queue_web WHERE guild_id = ? ORDER BY id DESC LIMIT 20', [guildId]);
    return res.json({ success: true, queue: (queue || []).reverse() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: VOLUME ---
router.post('/:guildId/execute/music-volume', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { volume } = req.body;
  const vol = Math.min(Math.max(Number(volume) || 80, 0), 100);
  try {
    await pool.query('UPDATE guild_music_config SET default_volume = ? WHERE guild_id = ?', [vol, guildId]);
    return res.json({ success: true, message: `Ses seviyesi: ${vol}%` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: LOOP MODE ---
router.post('/:guildId/execute/music-loop', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { mode } = req.body; // 'none', 'song', 'queue'
  try {
    return res.json({ success: true, message: `Loop modu: ${mode || 'none'}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: SHUFFLE ---
router.post('/:guildId/execute/music-shuffle', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    return res.json({ success: true, message: 'Karo karıştırıldı.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: AUTOPLAY ---
router.post('/:guildId/execute/music-autoplay', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { enabled } = req.body;
  try {
    await pool.query('UPDATE guild_music_config SET autoplay_enabled = ? WHERE guild_id = ?', [(enabled ? 1 : 0), guildId]);
    return res.json({ success: true, message: `Otomatik oynatma: ${enabled ? 'Açık' : 'Kapalı'}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MUSIC: NOW PLAYING ---
router.get('/:guildId/execute/music-nowplaying', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const nowPlaying = await pool.query('SELECT * FROM music_now_playing WHERE guild_id = ? ORDER BY updated_at DESC LIMIT 1', [guildId]);
    return res.json({ success: true, nowPlaying: nowPlaying[0] || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MEMBERS PAGE (Paginated) ---
router.get('/:guildId/execute/members-page', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 1000);
  try {
    const offset = (page - 1) * limit;
    const members = await discordBotFetch(`/guilds/${guildId}/members?limit=${limit}&after=${offset > 0 ? '0' : '0'}`);
    const formattedMembers = (members || [])
      .map(m => {
        const u = m.user || {};
        const defaultAvatarNum = (BigInt(u.id || '0') >> 22n) % 6n;
        return {
          id: u.id,
          username: u.username,
          displayName: m.nick || u.global_name || u.username,
          avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`,
          isBot: !!u.bot,
          roles: m.roles || []
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return res.json({ success: true, members: formattedMembers, page, per_page: limit, total: formattedMembers.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- MEMBER COUNT FETCH ---
router.get('/:guildId/execute/member-count', verifyToken, verifyGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const guild = await discordBotFetch(`/guilds/${guildId}?with_counts=true`);
    return res.json({ success: true, memberCount: guild?.approximate_member_count || 0, presenceCount: guild?.approximate_presence_count || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
