const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost', 
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'discord_mod',
    connectionLimit: 20,
    idleTimeout: 30000
});

async function initDB() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // 1. Guild Config
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_config (
                guild_id VARCHAR(25) PRIMARY KEY,
                mod_role_id VARCHAR(25),
                warn1_role_id VARCHAR(25),
                warn2_role_id VARCHAR(25),
                banned_role_id VARCHAR(25),
                anti_spam_enabled BOOLEAN DEFAULT TRUE,
                anti_link_enabled BOOLEAN DEFAULT TRUE,
                anti_swear_enabled BOOLEAN DEFAULT TRUE,
                caps_filter_enabled BOOLEAN DEFAULT TRUE,
                anti_raid_enabled BOOLEAN DEFAULT TRUE,
                warn_decay_days INT DEFAULT 30,
                join_gate_active BOOLEAN DEFAULT FALSE,
                welcome_channel_id VARCHAR(25),
                goodbye_channel_id VARCHAR(25),
                autorole_id VARCHAR(25),
                ticket_channel_id VARCHAR(25),
                ticket_role_id VARCHAR(255),
                ticket_category_id VARCHAR(25),
                log_channel_id VARCHAR(25)
            )
        `);

        // Tablo zaten varsa kolonları ekle
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN welcome_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN goodbye_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN autorole_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN ticket_channel_id VARCHAR(25)'); } catch (e) {}
        try { 
            await conn.query('ALTER TABLE guild_config ADD COLUMN ticket_role_id VARCHAR(255)'); 
        } catch (e) {
            try { await conn.query('ALTER TABLE guild_config MODIFY COLUMN ticket_role_id VARCHAR(255)'); } catch(e2) {}
        }
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN ticket_category_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_voice_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_ticket_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_system_channel_id VARCHAR(25)'); } catch (e) {}

        // Ticket limit takibi için log tablosu
        await conn.query(`
            CREATE TABLE IF NOT EXISTS ticket_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                user_id VARCHAR(25),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Üye Takip Tablosu (Loglar ve İsim Geçmişi İçin)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS members (
                user_id VARCHAR(25) PRIMARY KEY,
                username VARCHAR(100),
                is_in_guild BOOLEAN DEFAULT TRUE,
                last_join TIMESTAMP NULL,
                last_leave TIMESTAMP NULL
            )
        `);

        // Invite Tracking
        await conn.query(`
            CREATE TABLE IF NOT EXISTS invite_tracking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                user_id VARCHAR(25),
                inviter_id VARCHAR(25),
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_guild (user_id, guild_id)
            )
        `);

        // 2. Filtered Words
        await conn.query(`
            CREATE TABLE IF NOT EXISTS filtered_words (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                word VARCHAR(100),
                match_type ENUM('exact', 'includes', 'regex') DEFAULT 'includes',
                action ENUM('delete', 'warn', 'mute', 'kick', 'ban') DEFAULT 'warn'
            )
        `);

        // 3. Warnings
        await conn.query(`
            CREATE TABLE IF NOT EXISTS warnings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                user_id VARCHAR(25),
                moderator_id VARCHAR(25),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE
            )
        `);

        // 4. Mutes/Bans
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mutes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                user_id VARCHAR(25),
                moderator_id VARCHAR(25),
                action_type VARCHAR(25),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                reason TEXT
            )
        `);
        try { await conn.query('ALTER TABLE mutes ADD COLUMN is_active BOOLEAN DEFAULT TRUE'); } catch (e) {}
        try { await conn.query('ALTER TABLE mutes MODIFY COLUMN action_type VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE mutes ADD COLUMN moderator_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE mutes ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}

        // Role Memory System
        await conn.query(`
            CREATE TABLE IF NOT EXISTS role_memory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                user_id VARCHAR(25) NOT NULL,
                roles TEXT NOT NULL,
                action_type VARCHAR(25) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Moderatör Notları
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mod_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                user_id VARCHAR(25) NOT NULL,
                moderator_id VARCHAR(25) NOT NULL,
                note TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. Whitelists
        await conn.query(`
            CREATE TABLE IF NOT EXISTS whitelists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                target_id VARCHAR(25),
                target_type ENUM('role', 'channel'),
                exempt_from VARCHAR(50) DEFAULT 'all'
            )
        `);
        // 6. Deleted Messages
        await conn.query(`
            CREATE TABLE IF NOT EXISTS deleted_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                channel_id VARCHAR(25),
                user_id VARCHAR(25),
                deleted_by VARCHAR(25),
                reason VARCHAR(255),
                content TEXT,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        try { await conn.query('ALTER TABLE deleted_messages ADD COLUMN deleted_by VARCHAR(25)'); } catch(e){}
        try { await conn.query('ALTER TABLE deleted_messages ADD COLUMN reason VARCHAR(255)'); } catch(e){}

        // 6.5. Global Action Logs
        await conn.query(`
            CREATE TABLE IF NOT EXISTS bot_action_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25),
                user_id VARCHAR(25),
                action_type VARCHAR(50),
                action_detail TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 7. Tickets
        await conn.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                channel_id VARCHAR(25) NOT NULL,
                owner_id VARCHAR(25) NOT NULL,
                owner_tag VARCHAR(100),
                category VARCHAR(50),
                reason TEXT,
                status ENUM('open', 'closed') DEFAULT 'open',
                closed_by VARCHAR(25),
                transcript_html LONGTEXT,
                transcript_text LONGTEXT,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP NULL,
                INDEX idx_guild_owner (guild_id, owner_id),
                INDEX idx_channel (channel_id)
            )
        `);

        // 8. Özel Oda (Private Rooms) Sistemi
        await conn.query(`
            CREATE TABLE IF NOT EXISTS active_rooms (
                channel_id VARCHAR(255) PRIMARY KEY,
                owner_id VARCHAR(255) NOT NULL,
                guild_id VARCHAR(255) NOT NULL,
                log_message_id VARCHAR(255),
                log_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        try { await conn.query("ALTER TABLE active_rooms ADD COLUMN room_name VARCHAR(100)"); } catch (e) {}
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_setup (
                guild_id VARCHAR(255) PRIMARY KEY,
                setup_category_id VARCHAR(255),
                setup_channel_id VARCHAR(255),
                setup_voice_channel_id VARCHAR(255),
                active_rooms_category_id VARCHAR(255),
                log_channel_id VARCHAR(255)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS room_whitelists (
                channel_id VARCHAR(255),
                user_id VARCHAR(255),
                PRIMARY KEY(channel_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS room_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255) NOT NULL,
                channel_id VARCHAR(255) NOT NULL,
                owner_id VARCHAR(255),
                action_name VARCHAR(100),
                description TEXT,
                executor_id VARCHAR(255),
                log_type VARCHAR(20) DEFAULT 'room',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        try { await conn.query('ALTER TABLE room_logs ADD COLUMN log_type VARCHAR(20) DEFAULT \'room\''); } catch (e) {}

        // Ses log kanali bazli tek-mesaj takibi (duzenle guncelle)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS voice_log_state (
                guild_id VARCHAR(255) NOT NULL,
                scope_key VARCHAR(100) NOT NULL,
                log_message_id VARCHAR(255),
                log_text LONGTEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, scope_key)
            )
        `);


        await conn.query(`
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id VARCHAR(25),
                guild_id VARCHAR(25) NOT NULL,
                channel_id VARCHAR(25) NOT NULL,
                ticket_owner_id VARCHAR(25),
                author_id VARCHAR(25) NOT NULL,
                author_tag VARCHAR(100),
                author_avatar VARCHAR(255),
                content TEXT,
                attachments TEXT,
                attachments_json LONGTEXT,
                embeds_json LONGTEXT,
                is_deleted BOOLEAN DEFAULT FALSE,
                is_edited BOOLEAN DEFAULT FALSE,
                edited_content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_channel (channel_id),
                INDEX idx_guild (guild_id),
                INDEX idx_message (message_id)
            )
        `);

        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN message_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN author_avatar VARCHAR(255)'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN attachments_json LONGTEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN embeds_json LONGTEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN components_json LONGTEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN edited_content TEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN old_content TEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN reply_to_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN stickers_json LONGTEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE ticket_messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE'); } catch (e) {}
        // İlk açılışta config'i cache'le
        const rows = await conn.query('SELECT * FROM guild_config');
        for (const row of rows) {
            guildConfigCache.set(row.guild_id, row);
        }

        console.log("Database tables initialized.");
    } catch (err) {
        console.error("Database init error:", err);
    } finally {
        if (conn) conn.release();
    }
}

// Memory Cache
const guildConfigCache = new Map();

async function getGuildConfig(guildId) {
    if (guildConfigCache.has(guildId)) {
        return guildConfigCache.get(guildId);
    }
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            guildConfigCache.set(guildId, rows[0]);
            return rows[0];
        }
        return null;
    } catch (e) {
        console.error("Cache fetch error:", e);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

function updateConfigCache(guildId, key, value) {
    let config = guildConfigCache.get(guildId) || {};
    config[key] = value;
    guildConfigCache.set(guildId, config);
}

const filteredWordsCache = new Map();

async function getFilteredWords(guildId) {
    if (filteredWordsCache.has(guildId)) {
        return filteredWordsCache.get(guildId);
    }
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT word, match_type, action FROM filtered_words WHERE guild_id = ?', [guildId]);
        filteredWordsCache.set(guildId, rows);
        return rows;
    } catch (e) {
        console.error("Cache fetch error:", e);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

function updateFilteredWordsCache(guildId, words) {
    filteredWordsCache.set(guildId, words);
}

function updateGuildConfigCache(guildId, configData) {
    guildConfigCache.set(guildId, configData);
}

const guildSetupCache = new Map();

async function getGuildSetup(guildId) {
    if (guildSetupCache.has(guildId)) return guildSetupCache.get(guildId);
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_setup WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            guildSetupCache.set(guildId, rows[0]);
            return rows[0];
        }
        return null;
    } catch (e) {
        return null;
    } finally {
        if (conn) conn.release();
    }
}

function updateGuildSetupCache(guildId, setupData) {
    guildSetupCache.set(guildId, setupData);
}

function clearFilteredWordsCache(guildId) {
    filteredWordsCache.delete(guildId);
}

module.exports = { pool, initDB, getGuildConfig, updateConfigCache, updateGuildConfigCache, getGuildSetup, updateGuildSetupCache, getFilteredWords, updateFilteredWordsCache, clearFilteredWordsCache };
