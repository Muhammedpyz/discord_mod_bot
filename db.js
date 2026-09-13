BigInt.prototype.toJSON = function() { return Number(this) <= Number.MAX_SAFE_INTEGER ? Number(this) : this.toString(); };

const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost', 
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'discord_mod',
    connectionLimit: 30,
    idleTimeout: 30000,
    acquireTimeout: 15000,
    connectTimeout: 10000,
    minDelayValidation: 5000
});

pool.on('error', err => {
    console.error('[DB Pool Error]:', err ? (err.message || err) : 'Bilinmeyen DB havuz hatası');
});

async function initDB() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_log_channels (
                guild_id VARCHAR(25) NOT NULL,
                category VARCHAR(50) NOT NULL,
                channel_id VARCHAR(25) NOT NULL,
                PRIMARY KEY (guild_id, category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_log_events (
                guild_id VARCHAR(25) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                PRIMARY KEY (guild_id, event_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_log_ignored (
                guild_id VARCHAR(25) NOT NULL,
                target_id VARCHAR(25) NOT NULL,
                target_type ENUM('user', 'channel', 'role') NOT NULL,
                PRIMARY KEY (guild_id, target_id, target_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_log_settings (
                guild_id VARCHAR(25) PRIMARY KEY,
                embed_color VARCHAR(10) DEFAULT '#2B2D31',
                log_level VARCHAR(20) DEFAULT 'all'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS developer_profile (
                user_id VARCHAR(30) PRIMARY KEY,
                bio TEXT,
                custom_title VARCHAR(100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if show_parts column exists
        try {
            await conn.query('SELECT show_parts FROM guild_giveaways LIMIT 1');
        } catch(e) {
            if(e.code === 'ER_BAD_FIELD_ERROR') {
                await conn.query('ALTER TABLE guild_giveaways ADD COLUMN show_parts BOOLEAN DEFAULT true');
            }
        }

        
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
                log_channel_id VARCHAR(25),
                starboard_channel_id VARCHAR(25),
                starboard_threshold INT DEFAULT 3
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
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN starboard_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN starboard_threshold INT DEFAULT 3'); } catch (e) {}
        // user_roles (Banlananların rollerini yedeklemek için)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(25),
                guild_id VARCHAR(25),
                role_id VARCHAR(25),
                UNIQUE KEY unique_user_role (user_id, guild_id, role_id)
            )
        `);
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_voice_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_ticket_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN log_system_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN role_backup_webhook VARCHAR(255)'); } catch (e) {}

        // Sürekli Rol Yedekleme (Tüm Kullanıcılar)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS member_roles_snapshot (
                user_id VARCHAR(25),
                guild_id VARCHAR(25),
                roles_json LONGTEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, guild_id)
            )
        `);

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
                invite_code VARCHAR(25),
                is_fake BOOLEAN DEFAULT FALSE,
                has_left BOOLEAN DEFAULT FALSE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_guild (user_id, guild_id)
            )
        `);
        try { await conn.query('ALTER TABLE invite_tracking ADD COLUMN is_fake BOOLEAN DEFAULT FALSE'); } catch(e){}
        try { await conn.query('ALTER TABLE invite_tracking ADD COLUMN has_left BOOLEAN DEFAULT FALSE'); } catch(e){}

        // Prefix Tracking
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_prefixes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                prefix VARCHAR(10) NOT NULL,
                UNIQUE KEY unique_guild_prefix (guild_id, prefix)
            )
        `);

        // Sticky Messages
        await conn.query(`
            CREATE TABLE IF NOT EXISTS sticky_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                channel_id VARCHAR(25) NOT NULL,
                content TEXT NOT NULL,
                last_message_id VARCHAR(25),
                UNIQUE KEY unique_channel (guild_id, channel_id)
            )
        `);

        // Blocked Channels
        await conn.query(`
            CREATE TABLE IF NOT EXISTS blocked_channels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                channel_id VARCHAR(25) NOT NULL,
                UNIQUE KEY unique_guild_channel (guild_id, channel_id)
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

        // Warn Actions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS warn_actions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                warn_count INT NOT NULL,
                action VARCHAR(25) NOT NULL,
                duration INT DEFAULT 0,
                UNIQUE KEY unique_guild_warn (guild_id, warn_count)
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
                claimed_by VARCHAR(25) DEFAULT NULL,
                closed_by VARCHAR(25),
                transcript_html LONGTEXT,
                transcript_text LONGTEXT,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP NULL,
                INDEX idx_guild_owner (guild_id, owner_id),
                INDEX idx_channel (channel_id)
            )
        `);

        // 7.5. Tickets Setup
        await conn.query(`
            CREATE TABLE IF NOT EXISTS tickets_setup (
                guild_id VARCHAR(25) PRIMARY KEY,
                room_type VARCHAR(50) DEFAULT 'channel',
                category_id VARCHAR(25),
                support_roles JSON,
                log_channel_id VARCHAR(25),
                ticket_types JSON,
                published_panel_id VARCHAR(25),
                panel_channel_id VARCHAR(25),
                thread_channel_id VARCHAR(25),
                archive_category_id VARCHAR(25),
                room_name_template VARCHAR(50) DEFAULT 'ticket-{number}',
                user_limit INT DEFAULT 1,
                create_transcript TINYINT DEFAULT 1,
                ping_roles TINYINT DEFAULT 0,
                panel_sections JSON,
                close_behavior VARCHAR(50) DEFAULT 'archive',
                welcome_message TEXT NULL
            )
        `);
        try { await conn.query('ALTER TABLE tickets_setup MODIFY COLUMN room_type VARCHAR(50)'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup MODIFY COLUMN close_behavior VARCHAR(50)'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup ADD COLUMN welcome_message TEXT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup ADD COLUMN thread_channel_id VARCHAR(25) NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup ADD COLUMN archive_category_id VARCHAR(25) NULL'); } catch (e) {}
        try { await conn.query("ALTER TABLE tickets_setup ADD COLUMN room_name_template VARCHAR(50) DEFAULT 'ticket-{number}'"); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup ADD COLUMN user_limit INT DEFAULT 1'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup ADD COLUMN create_transcript TINYINT DEFAULT 1'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets_setup ADD COLUMN ping_roles TINYINT DEFAULT 0'); } catch (e) {}

        try { await conn.query("ALTER TABLE tickets MODIFY COLUMN status VARCHAR(20) DEFAULT 'open'"); } catch (e) {}
        try { await conn.query("ALTER TABLE tickets ADD COLUMN priority VARCHAR(20) DEFAULT 'Normal'"); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets ADD COLUMN closed_at TIMESTAMP NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets ADD COLUMN closed_by VARCHAR(25) NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets ADD COLUMN close_reason TEXT NULL'); } catch (e) {}

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
                part_num INT DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, scope_key)
            )
        `);
        try { await conn.query('ALTER TABLE voice_log_state ADD COLUMN part_num INT DEFAULT 1'); } catch (e) {}


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

        // 9. Öneri (Suggestion) Sistemi
        await conn.query(`
            CREATE TABLE IF NOT EXISTS suggestion_setup (
                guild_id VARCHAR(25) PRIMARY KEY,
                panel_channel_id VARCHAR(25) NULL,
                suggestion_channel_id VARCHAR(25) NULL,
                log_channel_id VARCHAR(25) NULL,
                cooldown_seconds INT DEFAULT 30,
                panel_title VARCHAR(100) DEFAULT 'Öneri Paneli',
                panel_description TEXT NULL,
                is_active TINYINT DEFAULT 1,
                published_message_id VARCHAR(25) NULL
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                user_id VARCHAR(25) NOT NULL,
                message_id VARCHAR(25) NULL,
                content TEXT NOT NULL,
                is_anonymous TINYINT DEFAULT 0,
                upvotes INT DEFAULT 0,
                downvotes INT DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_guild_status (guild_id, status),
                INDEX idx_user (user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS suggestion_votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                suggestion_id INT NOT NULL,
                user_id VARCHAR(25) NOT NULL,
                vote_type VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_vote (suggestion_id, user_id)
            )
        `);
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
        // Tag Role System
        await conn.query(`
            CREATE TABLE IF NOT EXISTS tag_role (
                guild_id VARCHAR(25) PRIMARY KEY,
                tag_text VARCHAR(50) NOT NULL,
                role_id VARCHAR(25) NOT NULL
            )
        `);

        // Staff Board System
        await conn.query(`
            CREATE TABLE IF NOT EXISTS staff_board (
                guild_id VARCHAR(25) PRIMARY KEY,
                channel_id VARCHAR(25) NOT NULL,
                message_id VARCHAR(25),
                role_ids TEXT NOT NULL
            )
        `);

        // --- PHASE 4 USER EXPERIENCE TABLES ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS afk_users (
                user_id VARCHAR(25) NOT NULL,
                guild_id VARCHAR(25) NOT NULL,
                reason VARCHAR(255) DEFAULT 'AFK',
                set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reputation (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(25) NOT NULL,
                user_id VARCHAR(25) NOT NULL,
                given_by VARCHAR(25) NOT NULL,
                given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS rep_cooldown (
                guild_id VARCHAR(25) NOT NULL,
                user_id VARCHAR(25) NOT NULL,
                last_given TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS birthdays (
                user_id VARCHAR(25) NOT NULL,
                guild_id VARCHAR(25) NOT NULL,
                birth_day INT NOT NULL,
                birth_month INT NOT NULL,
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                message TEXT NOT NULL,
                remind_at TIMESTAMP NOT NULL,
                is_dm BOOLEAN DEFAULT FALSE,
                recurring ENUM('none','daily','weekly') DEFAULT 'none',
                sent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_reminders_time (remind_at)
            )
        `);
        try {
            await conn.query(`ALTER TABLE reminders ADD COLUMN sent BOOLEAN DEFAULT FALSE`);
        } catch(e) {}
        try {
            await conn.query(`ALTER TABLE reminders ADD COLUMN message TEXT`);
        } catch(e) {}

        // --- MUSIC SYSTEM TABLES ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_liked_songs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(32) NOT NULL,
                track_title VARCHAR(255) NOT NULL,
                artist VARCHAR(255) NULL,
                track_url TEXT NOT NULL,
                thumbnail_url TEXT NULL,
                duration INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_music_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                default_volume INT DEFAULT 100,
                is_247_enabled TINYINT(1) DEFAULT 0,
                voice_channel_id VARCHAR(32) NULL,
                text_channel_id VARCHAR(32) NULL,
                autoplay_enabled TINYINT(1) DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_music_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                track_title VARCHAR(255) NOT NULL,
                track_url TEXT NOT NULL,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_guild (guild_id)
            )
        `);

        // --- PAKET 1: GÜVENLİK, OTOMASYON & SUNUCU KALKANI TABLOLARI ---
        
        // 1. Anti-Nuke (Sunucu Koruma Kalkanı)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_antinuke_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                is_enabled BOOLEAN DEFAULT FALSE,
                punishment VARCHAR(20) DEFAULT 'strip_roles',
                log_channel_id VARCHAR(32) DEFAULT NULL,
                channel_delete_limit INT DEFAULT 3,
                channel_create_limit INT DEFAULT 3,
                role_delete_limit INT DEFAULT 3,
                role_create_limit INT DEFAULT 3,
                ban_limit INT DEFAULT 4,
                kick_limit INT DEFAULT 4,
                bot_add_action VARCHAR(20) DEFAULT 'kick',
                webhook_action VARCHAR(20) DEFAULT 'delete',
                anti_bot_add BOOLEAN DEFAULT TRUE,
                anti_webhook BOOLEAN DEFAULT TRUE,
                anti_integration BOOLEAN DEFAULT TRUE,
                anti_unban BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        try { await conn.query('ALTER TABLE guild_antinuke_config ADD COLUMN IF NOT EXISTS anti_bot_add BOOLEAN DEFAULT TRUE'); } catch(e){}
        try { await conn.query('ALTER TABLE guild_antinuke_config ADD COLUMN IF NOT EXISTS anti_webhook BOOLEAN DEFAULT TRUE'); } catch(e){}
        try { await conn.query('ALTER TABLE guild_antinuke_config ADD COLUMN IF NOT EXISTS anti_integration BOOLEAN DEFAULT TRUE'); } catch(e){}
        try { await conn.query('ALTER TABLE guild_antinuke_config ADD COLUMN IF NOT EXISTS anti_unban BOOLEAN DEFAULT TRUE'); } catch(e){}

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_antinuke_whitelist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                target_id VARCHAR(32) NOT NULL,
                target_type VARCHAR(10) DEFAULT 'user',
                added_by VARCHAR(32) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_guild_target (guild_id, target_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_antinuke_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                executor_id VARCHAR(32) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                details TEXT NOT NULL,
                punishment_taken VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_guild (guild_id)
            )
        `);

        // 2. Vanity Roles (Özel Durum Rolü)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_vanity_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                vanity_string VARCHAR(100) DEFAULT NULL,
                role_id VARCHAR(32) DEFAULT NULL,
                roles JSON DEFAULT NULL,
                channel_id VARCHAR(32) DEFAULT NULL,
                message TEXT DEFAULT NULL,
                is_enabled BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        await conn.query(`ALTER TABLE guild_vanity_config ADD COLUMN IF NOT EXISTS roles JSON DEFAULT NULL`).catch(() => {});
        await conn.query(`ALTER TABLE guild_vanity_config ADD COLUMN IF NOT EXISTS channel_id VARCHAR(32) DEFAULT NULL`).catch(() => {});
        await conn.query(`ALTER TABLE guild_vanity_config ADD COLUMN IF NOT EXISTS message TEXT DEFAULT NULL`).catch(() => {});

        // 2.1 Vanity Users (Durumunda yazı taşıyan üyelerin geçmişi ve anlık takibi)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_vanity_users (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                adopted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        // 3. Medya Kanalları (Media Only)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_media_channels (
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, channel_id)
            )
        `);

        // 4. Otomatik Tepki (Auto-React)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_autoreact_channels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                emojis TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_guild_ch (guild_id, channel_id)
            )
        `);

        // 5. Otomatik Bump Hatırlatıcı (Auto-Bump)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_autobump_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) NOT NULL,
                ping_role_id VARCHAR(32) DEFAULT NULL,
                last_bump_time BIGINT DEFAULT 0,
                is_enabled BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 6. Otomatik İçerik Gönderici (Auto-Post)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_autopost_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                feed_type VARCHAR(30) NOT NULL,
                last_post_time BIGINT DEFAULT 0,
                is_enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_guild_feed (guild_id, channel_id, feed_type)
            )
        `);

        // --- PAKET 2: ÇEKİLİŞ (GIVEAWAY) MOTORU TABLOSU ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_giveaways (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id VARCHAR(32) UNIQUE NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                guild_id VARCHAR(32) NOT NULL,
                prize VARCHAR(255) NOT NULL,
                description TEXT DEFAULT NULL,
                winner_count INT DEFAULT 1,
                required_role_id VARCHAR(32) DEFAULT NULL,
                host_id VARCHAR(32) NOT NULL,
                ends_at BIGINT NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                participants LONGTEXT DEFAULT '[]',
                winners LONGTEXT DEFAULT '[]',
                exempt_roles TEXT DEFAULT NULL,
                min_account_age_days INT DEFAULT NULL,
                min_membership_days INT DEFAULT NULL,
                min_boost_tier INT DEFAULT NULL,
                entries_closed TINYINT DEFAULT 0,
                image_url VARCHAR(500) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_guild_status (guild_id, status)
            )
        `);

        // --- Geriye dönük ALTER'lar: eski (sütun yok) DB'ler için idempotency kontrollü ---
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS exempt_roles TEXT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS min_account_age_days INT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS min_membership_days INT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS min_boost_tier INT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS entries_closed TINYINT DEFAULT 0'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS min_messages INT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS min_voice_minutes INT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_giveaways ADD COLUMN IF NOT EXISTS min_invites INT DEFAULT NULL'); } catch (e) {}
        try { await conn.query('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS message_id VARCHAR(32) DEFAULT NULL'); } catch (e) {}

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_giveaway_settings (
                guild_id VARCHAR(32) PRIMARY KEY,
                manager_roles JSON DEFAULT NULL,
                log_channel_id VARCHAR(32) DEFAULT NULL,
                ping_role_id VARCHAR(32) DEFAULT NULL,
                ignored_roles JSON DEFAULT NULL,
                dm_winner BOOLEAN DEFAULT TRUE,
                show_parts BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // --- PAKET 5: KULLANICI PROFİLİ & SOSYAL EVLİLİK TABLOSU ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id VARCHAR(32) PRIMARY KEY,
                bio TEXT DEFAULT NULL,
                partner_id VARCHAR(32) DEFAULT NULL,
                married_at TIMESTAMP NULL,
                badges LONGTEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS staff_applications (
                guild_id VARCHAR(25) PRIMARY KEY,
                panel_channel_id VARCHAR(25),
                panel_message_id VARCHAR(25),
                result_channel_id VARCHAR(25)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS creator_applications (
                guild_id VARCHAR(25) PRIMARY KEY,
                publish_channel_id VARCHAR(25),
                review_channel_id VARCHAR(25),
                reviewer_roles TEXT,
                approve_role_id VARCHAR(25),
                panel_text TEXT,
                q1 TEXT, q2 TEXT, q3 TEXT, q4 TEXT, q5 TEXT,
                is_active BOOLEAN DEFAULT FALSE,
                published_message_id VARCHAR(25)
            )
        `);

        // --- MINECRAFT HESAP EŞLEME TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mc_linked_accounts (
                discord_id VARCHAR(32) PRIMARY KEY,
                mc_uuid VARCHAR(64) NOT NULL,
                mc_username VARCHAR(32) NOT NULL,
                linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mc_uuid (mc_uuid),
                INDEX idx_mc_username (mc_username)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS mc_link_requests (
                verify_code VARCHAR(16) PRIMARY KEY,
                discord_id VARCHAR(32) NOT NULL,
                mc_username VARCHAR(32) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                INDEX idx_discord_req (discord_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS automod_config (
                guild_id VARCHAR(25) PRIMARY KEY,
                anti_swear BOOLEAN DEFAULT FALSE,
                custom_words_enabled BOOLEAN DEFAULT FALSE,
                anti_invite BOOLEAN DEFAULT FALSE,
                anti_link BOOLEAN DEFAULT FALSE,
                caps_percent INT DEFAULT 0,
                mention_limit INT DEFAULT 0,
                spam_limit VARCHAR(20) DEFAULT '0',
                media_channels TEXT DEFAULT NULL,
                exempt_roles TEXT DEFAULT NULL,
                exempt_channels TEXT DEFAULT NULL,
                punishment_type VARCHAR(30) DEFAULT 'delete',
                mute_duration INT DEFAULT 10,
                dm_notify BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 13. Karşılama (Hoşgeldin & Uğurlama) Sistemi
        await conn.query(`
            CREATE TABLE IF NOT EXISTS welcome_config (
                guild_id VARCHAR(25) PRIMARY KEY,
                welcome_channel_id VARCHAR(25),
                goodbye_channel_id VARCHAR(25),
                welcome_message TEXT,
                goodbye_message TEXT,
                welcome_dm_message TEXT,
                welcome_title VARCHAR(255),
                goodbye_title VARCHAR(255),
                welcome_show_title BOOLEAN DEFAULT TRUE,
                goodbye_show_title BOOLEAN DEFAULT TRUE,
                welcome_gen_image BOOLEAN DEFAULT FALSE,
                goodbye_gen_image BOOLEAN DEFAULT FALSE,
                welcome_plain_text BOOLEAN DEFAULT FALSE,
                goodbye_plain_text BOOLEAN DEFAULT FALSE
            )
        `);
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN welcome_dm_message TEXT'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN welcome_title VARCHAR(255)'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN goodbye_title VARCHAR(255)'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN welcome_show_title BOOLEAN DEFAULT TRUE'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN goodbye_show_title BOOLEAN DEFAULT TRUE'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN welcome_gen_image BOOLEAN DEFAULT FALSE'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN goodbye_gen_image BOOLEAN DEFAULT FALSE'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN welcome_plain_text BOOLEAN DEFAULT FALSE'); } catch (e) {}
        try { await conn.query('ALTER TABLE welcome_config ADD COLUMN goodbye_plain_text BOOLEAN DEFAULT FALSE'); } catch (e) {}

        try { await conn.query('ALTER TABLE guild_config ADD COLUMN ghost_ping_enabled BOOLEAN DEFAULT FALSE'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN counting_channel_id VARCHAR(25)'); } catch (e) {}
        try { await conn.query('ALTER TABLE guild_config ADD COLUMN suggestion_channel_id VARCHAR(25)'); } catch (e) {}

        // --- LEVEL (SEVİYE) SİSTEMİ TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_level_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                enabled BOOLEAN DEFAULT TRUE,
                announcement_channel_id VARCHAR(32) DEFAULT NULL,
                announcement_type VARCHAR(20) DEFAULT 'channel',
                msg_xp INT DEFAULT 15,
                voice_xp INT DEFAULT 10,
                xp_per_level INT DEFAULT 100,
                cooldown_secs INT DEFAULT 60,
                invite_xp INT DEFAULT 200,
                reward_mode VARCHAR(20) DEFAULT 'stack',
                exempt_channels JSON DEFAULT NULL,
                exempt_roles JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_level_users (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                xp BIGINT DEFAULT 0,
                level INT DEFAULT 0,
                messages INT DEFAULT 0,
                voice_secs INT DEFAULT 0,
                invites INT DEFAULT 0,
                last_xp_at BIGINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id),
                INDEX idx_guild_xp (guild_id, xp DESC)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS guild_level_rewards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                level INT NOT NULL,
                role_id VARCHAR(32) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_guild_level_role (guild_id, level, role_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_daily_quests (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                quest_date VARCHAR(10) NOT NULL,
                messages_count INT DEFAULT 0,
                voice_minutes INT DEFAULT 0,
                suggestions_count INT DEFAULT 0,
                claimed_msg INT DEFAULT 0,
                claimed_voice INT DEFAULT 0,
                claimed_sug INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id, quest_date),
                INDEX idx_user_date (user_id, quest_date)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_playlists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(32) NOT NULL,
                playlist_name VARCHAR(64) NOT NULL,
                tracks LONGTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_playlist (user_id, playlist_name),
                INDEX idx_user (user_id)
            )
        `);
        // ---------------------------------------

        // --- REACTION ROLES (TEPKİ ROLLERİ) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS reaction_role_panels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                mode ENUM('multiple','single') DEFAULT 'multiple',
                created_by VARCHAR(32) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_guild (guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reaction_role_options (
                id INT AUTO_INCREMENT PRIMARY KEY,
                panel_id INT NOT NULL,
                role_id VARCHAR(32) NOT NULL,
                label VARCHAR(100) NOT NULL,
                emoji VARCHAR(64) DEFAULT NULL,
                style VARCHAR(20) DEFAULT 'Primary',
                description VARCHAR(100) DEFAULT NULL,
                requires_role_id VARCHAR(32) DEFAULT NULL,
                max_uses INT DEFAULT NULL,
                current_uses INT DEFAULT 0,
                FOREIGN KEY (panel_id) REFERENCES reaction_role_panels(id) ON DELETE CASCADE
            )
        `);

        // Rol Paketleri (Tek butonla birden fazla rol verilmesi)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS reaction_role_packs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                option_id INT NOT NULL,
                role_id VARCHAR(32) NOT NULL,
                FOREIGN KEY (option_id) REFERENCES reaction_role_options(id) ON DELETE CASCADE
            )
        `);

        // --- POLLS (ANKET) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS polls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                question VARCHAR(255) NOT NULL,
                multiple_choice BOOLEAN DEFAULT FALSE,
                anonymous BOOLEAN DEFAULT FALSE,
                ends_at TIMESTAMP NULL,
                created_by VARCHAR(32) NOT NULL,
                status ENUM('active','closed') DEFAULT 'active',
                INDEX idx_poll_guild (guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS poll_options (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poll_id INT NOT NULL,
                label VARCHAR(100) NOT NULL,
                emoji VARCHAR(64) DEFAULT NULL,
                order_index INT DEFAULT 0,
                FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS poll_votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poll_id INT NOT NULL,
                option_id INT NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
                FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
            )
        `);

        // --- BIRTHDAYS (DOĞUM GÜNÜ) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_birthdays (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                day INT NOT NULL,
                month INT NOT NULL,
                year INT DEFAULT NULL,
                announced_year INT DEFAULT NULL,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS birthday_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) DEFAULT NULL,
                message_template TEXT,
                temp_role_id VARCHAR(32) DEFAULT NULL,
                server_timezone VARCHAR(50) DEFAULT 'Europe/Istanbul'
            )
        `);

        // --- ECONOMY (EKONOMİ) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS economy_users (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                balance BIGINT DEFAULT 0,
                bank_balance BIGINT DEFAULT 0,
                last_daily TIMESTAMP NULL,
                last_weekly TIMESTAMP NULL,
                daily_streak INT DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS economy_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                from_user VARCHAR(32) DEFAULT NULL,
                to_user VARCHAR(32) DEFAULT NULL,
                amount BIGINT NOT NULL,
                type ENUM('daily','weekly','transfer','shop_purchase','message_reward','admin_adjust') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_eco_trans (guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS economy_shop_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price BIGINT NOT NULL,
                role_id VARCHAR(32) DEFAULT NULL,
                stock INT DEFAULT NULL,
                item_type ENUM('role','item') DEFAULT 'role',
                INDEX idx_eco_shop (guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS economy_inventory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                item_id INT NOT NULL,
                quantity INT DEFAULT 1,
                FOREIGN KEY (item_id) REFERENCES economy_shop_items(id) ON DELETE CASCADE
            )
        `);

        // --- SOCIAL ALERTS (SOSYAL MEDYA BİLDİRİMLERİ) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS social_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                platform ENUM('youtube','twitch','kick') NOT NULL,
                channel_identifier VARCHAR(100) NOT NULL,
                discord_channel_id VARCHAR(32) NOT NULL,
                message_template TEXT,
                last_seen_id VARCHAR(100) DEFAULT NULL,
                is_currently_live BOOLEAN DEFAULT FALSE,
                INDEX idx_social_guild (guild_id)
            )
        `);

        // --- STARBOARD (YILDIZ PANOSU) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS starboard_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) NOT NULL,
                emoji VARCHAR(64) DEFAULT '⭐',
                threshold INT DEFAULT 3,
                self_star_allowed BOOLEAN DEFAULT FALSE
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS starboard_entries (
                guild_id VARCHAR(32) NOT NULL,
                original_message_id VARCHAR(32) NOT NULL,
                starboard_message_id VARCHAR(32) NOT NULL,
                star_count INT DEFAULT 0,
                PRIMARY KEY (guild_id, original_message_id)
            )
        `);

        // --- REMINDERS (HATIRLATICILAR) TABLOSU ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                message TEXT NOT NULL,
                remind_at TIMESTAMP NOT NULL,
                is_dm BOOLEAN DEFAULT FALSE,
                recurring ENUM('none','daily','weekly') DEFAULT 'none',
                sent BOOLEAN DEFAULT FALSE,
                INDEX idx_reminders_time (remind_at)
            )
        `);

        // --- CUSTOM COMMANDS (ÖZEL KOMUTLAR) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS custom_commands (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                trigger_word VARCHAR(100) NOT NULL,
                response_text TEXT NOT NULL,
                reply_type ENUM('plain','embed') DEFAULT 'plain',
                created_by VARCHAR(32) NOT NULL,
                INDEX idx_cc_guild (guild_id)
            )
        `);

        // --- AI CHATBOT (YAPAY ZEKA) TABLOLARI ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS ai_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                ai_channel_id VARCHAR(32) DEFAULT NULL,
                personality ENUM('friendly','sarcastic','professional','gamer') DEFAULT 'friendly',
                is_active BOOLEAN DEFAULT FALSE
            )
        `);

        // --- AFK SISTEMI TABLOSU ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_afk (
                user_id VARCHAR(32) PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                reason VARCHAR(255) DEFAULT 'Belirtilmedi',
                timestamp BIGINT NOT NULL
            )
        `);

        // --- STICKY MESSAGES (YAPIŞKAN MESAJLAR) TABLOSU ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS sticky_messages (
                channel_id VARCHAR(32) PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                content TEXT NOT NULL
            )
        `);

        // --- V2 TAM TEŞEKKÜL MIGRATION (Achievements + sosyal live_msg + indexler) ---
        // NOT: AI sistemi istenmediği için AI tablosu/kolonu YOKTUR.
        await conn.query(`
            CREATE TABLE IF NOT EXISTS achievement_definitions (
                code VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                emoji VARCHAR(64) DEFAULT 'trophy',
                requirement_type VARCHAR(30) NOT NULL,
                requirement_value INT NOT NULL,
                reward_coins INT DEFAULT 0
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                achievement_code VARCHAR(50) NOT NULL,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id, achievement_code)
            )
        `);

        try { await conn.query("ALTER TABLE social_subscriptions ADD COLUMN live_message_id VARCHAR(32) DEFAULT NULL"); } catch (e) {}
        try { await conn.query("ALTER TABLE custom_commands ADD COLUMN button_label VARCHAR(80) DEFAULT NULL"); } catch (e) {}
        try { await conn.query("ALTER TABLE custom_commands ADD COLUMN button_url VARCHAR(255) DEFAULT NULL"); } catch (e) {}
        try { await conn.query("CREATE INDEX idx_poll_votes ON poll_votes (poll_id, user_id)"); } catch (e) {}
        try { await conn.query("CREATE INDEX idx_eco_users ON economy_users (guild_id)"); } catch (e) {}
        try { await conn.query("CREATE INDEX idx_rr_panels ON reaction_role_panels (guild_id)"); } catch (e) {}
        try { await conn.query("CREATE INDEX idx_birth ON user_birthdays (day, month)"); } catch (e) {}

        // Sabit başarım tanımları (idempotent seed — emoji kolonunda SADECE MONO_EMOJIS anahtarı)
        const _achSeeds = [
            ['ilk_adim','İlk Adım','İlk mesajını gönder', 'tick','messages',1,50],
            ['muhabbetci','Muhabbetçi','100 mesaj gönder', 'message_square','messages',100,200],
            ['fenomen','Fenomen','1000 mesaj gönder', 'star','messages',1000,1000],
            ['birikimci','Birikimci','10.000 Jeton biriktir (nakit+banka)', 'coins','balance',10000,300],
            ['zengin','Zengin','100.000 Jeton biriktir', 'trophy','balance',100000,1500],
            ['sadakat','Sadakat','7 gün günlük ödül serisi yap', 'flame','daily_streak',7,500],
            ['secmen','Seçmen','Bir ankette oy kullan', 'vote','poll_votes',1,50],
            ['demokrat','Demokrat','10 ankette oy kullan', 'crown','poll_votes',10,300],
            ['rol_avcisi','Rol Avcısı','Buton panelle 5 farklı rol al', 'medal','roles',5,250],
            ['hatirlatici','Hatırlatıcı','5 hatırlatıcı kur', 'bell','reminders',5,150],
            ['oyuncu','Oyuncu','Herhangi bir oyunda ilk ödülünü kazan', 'gamepad','games',1,100],
            ['davetci','Davetçi','Sunucuya 1 üye davet et', 'invite','invites',1,150]
        ];
        for (const a of _achSeeds) {
            await conn.query(
                "INSERT IGNORE INTO achievement_definitions (code, name, description, emoji, requirement_type, requirement_value, reward_coins) VALUES (?, ?, ?, ?, ?, ?, ?)",
                a
            ).catch(() => {});
        }

        // --- ALL-IN-ONE MIGRATION v2 (kayıt, doğrulama, sayaç, etkinlik, kurallar, geri-sayım, tanıtım, oy, tempban) ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS kayitlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                admin_id VARCHAR(32) NOT NULL,
                isim VARCHAR(50) NOT NULL,
                yas INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_kayit_guild (guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS kayit_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                kayitsiz_role_id VARCHAR(32) DEFAULT NULL,
                erkek_role_id VARCHAR(32) DEFAULT NULL,
                kiz_role_id VARCHAR(32) DEFAULT NULL,
                yetkili_role_id VARCHAR(32) DEFAULT NULL,
                log_channel_id VARCHAR(32) DEFAULT NULL
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dogrulama_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) DEFAULT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                role_id VARCHAR(32) DEFAULT NULL,
                is_active BOOLEAN DEFAULT FALSE
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS sayac_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) NOT NULL,
                hedef INT DEFAULT 1000,
                sablon VARCHAR(100) DEFAULT 'Uye: {sayi}/{hedef}'
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS etkinlikler (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                baslik VARCHAR(100) NOT NULL,
                aciklama TEXT,
                zaman VARCHAR(100) DEFAULT NULL,
                olusturan VARCHAR(32) NOT NULL,
                status VARCHAR(20) DEFAULT 'acik',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_etk_guild (guild_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS etkinlik_katilim (
                etkinlik_id INT NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                durum ENUM('evet','hayir','belki') NOT NULL,
                PRIMARY KEY (etkinlik_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS kurallar_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) NOT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                metin TEXT NOT NULL,
                rol_id VARCHAR(32) DEFAULT NULL
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS geri_sayim (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32) NOT NULL,
                channel_id VARCHAR(32) NOT NULL,
                message_id VARCHAR(32) DEFAULT NULL,
                baslik VARCHAR(100) NOT NULL,
                bitis BIGINT NOT NULL,
                status VARCHAR(20) DEFAULT 'aktif',
                INDEX idx_geri_time (status, bitis)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS tanitim_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                channel_id VARCHAR(32) NOT NULL,
                cooldown_hours INT DEFAULT 6
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS tanitim_log (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                last_at BIGINT NOT NULL,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS oy_config (
                guild_id VARCHAR(32) PRIMARY KEY,
                vote_url VARCHAR(255) DEFAULT NULL,
                odul INT DEFAULT 200
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS oy_odul (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                last_claim BIGINT NOT NULL,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS tempbans (
                guild_id VARCHAR(32) NOT NULL,
                user_id VARCHAR(32) NOT NULL,
                expires_at BIGINT NOT NULL,
                sebep TEXT,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS aile (
                user_id VARCHAR(32) PRIMARY KEY,
                partner_id VARCHAR(32) DEFAULT NULL,
                parent_id VARCHAR(32) DEFAULT NULL
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS notlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(32) NOT NULL,
                baslik VARCHAR(100) NOT NULL,
                icerik TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_not_user (user_id)
            )
        `);

        // --- GLOBAL EKONOMİ (OwO tarzı: tüm sunucularda tek cüzdan) ---
        await conn.query(`
            CREATE TABLE IF NOT EXISTS global_wallet (
                user_id VARCHAR(32) PRIMARY KEY,
                balance BIGINT DEFAULT 0,
                bank_balance BIGINT DEFAULT 0,
                last_daily TIMESTAMP NULL,
                last_weekly TIMESTAMP NULL,
                daily_streak INT DEFAULT 0
            )
        `);

        // Tek seferlik migrasyon: eski sunucu-bazlı bakiyeler globale toplanır (sadece tablo boşsa)
        try {
            const cnt = await conn.query('SELECT COUNT(*) as c FROM global_wallet');
            if (Number(cnt[0]?.c || 0) === 0) {
                await conn.query(`
                    INSERT IGNORE INTO global_wallet (user_id, balance, bank_balance)
                    SELECT user_id, SUM(balance), SUM(bank_balance) FROM economy_users GROUP BY user_id
                `);
            }
        } catch (e) {
            console.error('[Migrasyon] global_wallet:', e.message);
        }

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

// Memory Cache with 5s TTL to guarantee instant multi-process live sync
const CACHE_TTL = 5000;
const guildConfigCache = new Map();

async function getGuildConfig(guildId) {
    const cached = guildConfigCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            guildConfigCache.set(guildId, { data: rows[0], timestamp: Date.now() });
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
    let cached = guildConfigCache.get(guildId);
    let config = (cached && cached.data) ? cached.data : {};
    config[key] = value;
    guildConfigCache.set(guildId, { data: config, timestamp: Date.now() });
}

function updateGuildConfigCache(guildId, configData) {
    guildConfigCache.set(guildId, { data: configData, timestamp: Date.now() });
}

function clearGuildConfigCache(guildId) {
    guildConfigCache.delete(guildId);
}

const filteredWordsCache = new Map();

async function getFilteredWords(guildId) {
    const cached = filteredWordsCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    try {
        const rows = await pool.query('SELECT word, match_type, action FROM filtered_words WHERE guild_id = ?', [guildId]);
        const data = rows || [];
        filteredWordsCache.set(guildId, { data, timestamp: Date.now() });
        return data;
    } catch (e) {
        console.error("Cache fetch error:", e);
        return [];
    }
}

function updateFilteredWordsCache(guildId, words) {
    filteredWordsCache.set(guildId, { data: words, timestamp: Date.now() });
}

function clearFilteredWordsCache(guildId) {
    filteredWordsCache.delete(guildId);
}

const guildSetupCache = new Map();

async function getGuildSetup(guildId) {
    const cached = guildSetupCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_setup WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            guildSetupCache.set(guildId, { data: rows[0], timestamp: Date.now() });
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
    guildSetupCache.set(guildId, { data: setupData, timestamp: Date.now() });
}

function clearGuildSetupCache(guildId) {
    guildSetupCache.delete(guildId);
}

const automodConfigCache = new Map();

async function getAutoModConfig(guildId) {
    const cached = automodConfigCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            const data = rows[0];
            automodConfigCache.set(guildId, { data, timestamp: Date.now() });
            return data;
        }
        const defaultCfg = {
            guild_id: guildId,
            anti_swear: false,
            custom_words_enabled: false,
            anti_invite: false,
            anti_link: false,
            caps_percent: 0,
            mention_limit: 0,
            spam_limit: '0',
            media_channels: null,
            exempt_roles: null,
            exempt_channels: null,
            punishment_type: 'delete',
            mute_duration: 10,
            dm_notify: true
        };
        await conn.query(
            'INSERT INTO automod_config (guild_id, anti_swear, custom_words_enabled, anti_invite, anti_link, caps_percent, mention_limit, spam_limit, punishment_type, mute_duration, dm_notify) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [guildId, 0, 0, 0, 0, 0, 0, '0', 'delete', 10, 1]
        ).catch(() => {});
        automodConfigCache.set(guildId, { data: defaultCfg, timestamp: Date.now() });
        return defaultCfg;
    } catch (e) {
        return null;
    } finally {
        if (conn) conn.release();
    }
}

function updateAutoModConfigCache(guildId, data) {
    automodConfigCache.set(guildId, { data, timestamp: Date.now() });
}

function clearAutoModConfigCache(guildId) {
    automodConfigCache.delete(guildId);
}

const welcomeConfigCache = new Map();

async function getWelcomeConfig(guildId) {
    const cached = welcomeConfigCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM welcome_config WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            welcomeConfigCache.set(guildId, { data: rows[0], timestamp: Date.now() });
            return rows[0];
        }
        const defaultCfg = {
            guild_id: guildId,
            welcome_channel_id: null,
            goodbye_channel_id: null,
            welcome_message: '{user} sunucumuza hoş geldin!',
            goodbye_message: '{user} sunucumuzdan ayrıldı.',
            welcome_dm_message: null,
            welcome_title: null,
            goodbye_title: null,
            welcome_show_title: true,
            goodbye_show_title: true,
            welcome_gen_image: false,
            goodbye_gen_image: false,
            welcome_plain_text: false,
            goodbye_plain_text: false
        };
        await conn.query(
            'INSERT INTO welcome_config (guild_id, welcome_message, goodbye_message, welcome_show_title, goodbye_show_title, welcome_gen_image, goodbye_gen_image, welcome_plain_text, goodbye_plain_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [guildId, defaultCfg.welcome_message, defaultCfg.goodbye_message, 1, 1, 0, 0, 0, 0]
        ).catch(() => {});
        welcomeConfigCache.set(guildId, { data: defaultCfg, timestamp: Date.now() });
        return defaultCfg;
    } catch (e) {
        return null;
    } finally {
        if (conn) conn.release();
    }
}

function updateWelcomeConfigCache(guildId, data) {
    welcomeConfigCache.set(guildId, { data, timestamp: Date.now() });
}

function clearWelcomeConfigCache(guildId) {
    welcomeConfigCache.delete(guildId);
}

const logStateCache = new Map();

async function getCompleteGuildLogState(guildId) {
    const cached = logStateCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    let conn;
    try {
        conn = await pool.getConnection();
        const [channelsRows, eventsRows, ignoredRows, settingsRows] = await Promise.all([
            conn.query('SELECT category, channel_id FROM guild_log_channels WHERE guild_id = ?', [guildId]),
            conn.query('SELECT event_name, is_enabled FROM guild_log_events WHERE guild_id = ?', [guildId]),
            conn.query('SELECT target_type, target_id FROM guild_log_ignored WHERE guild_id = ?', [guildId]),
            conn.query('SELECT ignore_bots FROM guild_log_settings WHERE guild_id = ? LIMIT 1', [guildId])
        ]);

        const channels = {};
        for (const row of channelsRows) {
            channels[row.category] = row.channel_id;
        }

        const events = {};
        for (const row of eventsRows) {
            events[row.event_name] = !!row.is_enabled;
        }

        const ignored = {
            channels: new Set(),
            roles: new Set(),
            users: new Set()
        };
        for (const row of ignoredRows) {
            if (row.target_type === 'channel') ignored.channels.add(row.target_id);
            else if (row.target_type === 'role') ignored.roles.add(row.target_id);
            else if (row.target_type === 'user') ignored.users.add(row.target_id);
        }

        const ignoreBots = settingsRows.length > 0 ? !!settingsRows[0].ignore_bots : false;

        const state = {
            channels,
            events,
            ignored,
            ignoreBots
        };

        logStateCache.set(guildId, { data: state, timestamp: Date.now() });
        return state;
    } catch (e) {
        console.error('getCompleteGuildLogState error:', e);
        return { channels: {}, events: {}, ignored: { channels: new Set(), roles: new Set(), users: new Set() }, ignoreBots: false };
    } finally {
        if (conn) conn.release();
    }
}

function clearLogStateCache(guildId) {
    logStateCache.delete(guildId);
}

async function setGuildLogChannel(guildId, category, channelId) {
    let conn;
    try {
        conn = await pool.getConnection();
        if (channelId) {
            await conn.query(
                'INSERT INTO guild_log_channels (guild_id, category, channel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?',
                [guildId, category, channelId, channelId]
            );
        } else {
            await conn.query(
                'DELETE FROM guild_log_channels WHERE guild_id = ? AND category = ?',
                [guildId, category]
            );
        }
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function setAllGuildLogChannels(guildId, channelId) {
    const { LOG_CATEGORIES } = require('./utils/logCatalog');
    let conn;
    try {
        conn = await pool.getConnection();
        if (channelId) {
            for (const catId of Object.keys(LOG_CATEGORIES)) {
                await conn.query(
                    'INSERT INTO guild_log_channels (guild_id, category, channel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?',
                    [guildId, catId, channelId, channelId]
                );
            }
        } else {
            await conn.query('DELETE FROM guild_log_channels WHERE guild_id = ?', [guildId]);
        }
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function setGuildLogEvent(guildId, eventName, isEnabled) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO guild_log_events (guild_id, event_name, is_enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_enabled = ?',
            [guildId, eventName, isEnabled ? 1 : 0, isEnabled ? 1 : 0]
        );
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function setAllCategoryEvents(guildId, categoryId, isEnabled) {
    const { LOG_CATEGORIES } = require('./utils/logCatalog');
    const cat = LOG_CATEGORIES[categoryId];
    if (!cat) return;

    let conn;
    try {
        conn = await pool.getConnection();
        for (const ev of cat.events) {
            await conn.query(
                'INSERT INTO guild_log_events (guild_id, event_name, is_enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_enabled = ?',
                [guildId, ev.id, isEnabled ? 1 : 0, isEnabled ? 1 : 0]
            );
        }
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function addGuildLogIgnored(guildId, targetType, targetId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT IGNORE INTO guild_log_ignored (guild_id, target_type, target_id) VALUES (?, ?, ?)',
            [guildId, targetType, targetId]
        );
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function removeGuildLogIgnored(guildId, targetType, targetId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'DELETE FROM guild_log_ignored WHERE guild_id = ? AND target_type = ? AND target_id = ?',
            [guildId, targetType, targetId]
        );
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function setGuildLogSettings(guildId, ignoreBots) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO guild_log_settings (guild_id, ignore_bots) VALUES (?, ?) ON DUPLICATE KEY UPDATE ignore_bots = ?',
            [guildId, ignoreBots ? 1 : 0, ignoreBots ? 1 : 0]
        );
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function resetGuildLogs(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await Promise.all([
            conn.query('DELETE FROM guild_log_channels WHERE guild_id = ?', [guildId]),
            conn.query('DELETE FROM guild_log_events WHERE guild_id = ?', [guildId]),
            conn.query('DELETE FROM guild_log_ignored WHERE guild_id = ?', [guildId]),
            conn.query('DELETE FROM guild_log_settings WHERE guild_id = ?', [guildId])
        ]);
        clearLogStateCache(guildId);
    } finally {
        if (conn) conn.release();
    }
}

async function getLikedSongs(userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM user_liked_songs WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return rows || [];
    } finally {
        if (conn) conn.release();
    }
}

async function addLikedSong(userId, trackTitle, artist, trackUrl, thumbnailUrl, duration) {
    let conn;
    try {
        conn = await pool.getConnection();
        const existing = await conn.query('SELECT id FROM user_liked_songs WHERE user_id = ? AND track_url = ?', [userId, trackUrl]);
        if (existing && existing.length > 0) return false;
        await conn.query(
            'INSERT INTO user_liked_songs (user_id, track_title, artist, track_url, thumbnail_url, duration) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, trackTitle, artist, trackUrl, thumbnailUrl, duration || 0]
        );
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function removeLikedSong(userId, trackUrl) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM user_liked_songs WHERE user_id = ? AND track_url = ?', [userId, trackUrl]);
        return res.affectedRows > 0;
    } finally {
        if (conn) conn.release();
    }
}

async function getMusicConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_music_config WHERE guild_id = ?', [guildId]);
        return rows[0] || {
            guild_id: guildId,
            default_volume: 100,
            is_247_enabled: 0,
            autoplay_enabled: 0
        };
    } finally {
        if (conn) conn.release();
    }
}

async function updateMusicConfig(guildId, updates = {}) {
    let conn;
    try {
        const current = await getMusicConfig(guildId);
        const merged = { ...current, ...updates };
        conn = await pool.getConnection();

        await conn.query(`
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
            merged.default_volume || 100,
            merged.is_247_enabled ? 1 : 0,
            merged.voice_channel_id || null,
            merged.text_channel_id || null,
            merged.autoplay_enabled ? 1 : 0
        ]);
        return merged;
    } finally {
        if (conn) conn.release();
    }
}

async function addMusicHistory(guildId, userId, trackTitle, trackUrl) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO guild_music_history (guild_id, user_id, track_title, track_url) VALUES (?, ?, ?, ?)',
            [guildId, userId, trackTitle, trackUrl]
        );
    } finally {
        if (conn) conn.release();
    }
}

async function getMusicHistory(guildId, limit = 10) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_music_history WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?', [guildId, limit]);
        return rows || [];
    } finally {
        if (conn) conn.release();
    }
}

// --- PAKET 1: GÜVENLİK & OTOMASYON YARDIMCI FONKSİYONLARI ---

async function getAntiNukeConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_antinuke_config WHERE guild_id = ?', [guildId]);
        return rows[0] || null;
    } finally {
        if (conn) conn.release();
    }
}

async function setAntiNukeConfig(guildId, data) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_antinuke_config (
                guild_id, is_enabled, punishment, log_channel_id,
                channel_delete_limit, channel_create_limit, role_delete_limit,
                role_create_limit, ban_limit, kick_limit, bot_add_action, webhook_action,
                anti_bot_add, anti_webhook, anti_integration, anti_unban,
                anti_server_update, anti_everyone_admin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                is_enabled = VALUES(is_enabled),
                punishment = VALUES(punishment),
                log_channel_id = VALUES(log_channel_id),
                channel_delete_limit = VALUES(channel_delete_limit),
                channel_create_limit = VALUES(channel_create_limit),
                role_delete_limit = VALUES(role_delete_limit),
                role_create_limit = VALUES(role_create_limit),
                ban_limit = VALUES(ban_limit),
                kick_limit = VALUES(kick_limit),
                bot_add_action = VALUES(bot_add_action),
                webhook_action = VALUES(webhook_action),
                anti_bot_add = VALUES(anti_bot_add),
                anti_webhook = VALUES(anti_webhook),
                anti_integration = VALUES(anti_integration),
                anti_unban = VALUES(anti_unban),
                anti_server_update = VALUES(anti_server_update),
                anti_everyone_admin = VALUES(anti_everyone_admin)
        `, [
            guildId, data.is_enabled ?? true, data.punishment || 'strip_roles', data.log_channel_id || null,
            data.channel_delete_limit || 3, data.channel_create_limit || 3, data.role_delete_limit || 3,
            data.role_create_limit || 3, data.ban_limit || 4, data.kick_limit || 4,
            data.bot_add_action || 'kick', data.webhook_action || 'delete',
            data.anti_bot_add ?? true, data.anti_webhook ?? true, data.anti_integration ?? true, data.anti_unban ?? true,
            data.anti_server_update ?? true, data.anti_everyone_admin ?? true
        ]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function getAntiNukeWhitelist(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        return await conn.query('SELECT * FROM guild_antinuke_whitelist WHERE guild_id = ?', [guildId]);
    } finally {
        if (conn) conn.release();
    }
}

async function addAntiNukeWhitelist(guildId, targetId, targetType, addedBy) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT IGNORE INTO guild_antinuke_whitelist (guild_id, target_id, target_type, added_by)
            VALUES (?, ?, ?, ?)
        `, [guildId, targetId, targetType, addedBy]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function removeAntiNukeWhitelist(guildId, targetId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM guild_antinuke_whitelist WHERE guild_id = ? AND target_id = ?', [guildId, targetId]);
        return res.affectedRows > 0;
    } finally {
        if (conn) conn.release();
    }
}

async function addAntiNukeLog(guildId, executorId, actionType, details, punishment) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_antinuke_logs (guild_id, executor_id, action_type, details, punishment_taken)
            VALUES (?, ?, ?, ?, ?)
        `, [guildId, executorId, actionType, details, punishment]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

const vanityConfigCache = new Map();
const mediaChannelsCache = new Map();
const autoReactChannelsCache = new Map();

async function getVanityConfig(guildId) {
    const cached = vanityConfigCache.get(guildId);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_vanity_config WHERE guild_id = ?', [guildId]);
        let data = rows[0] || null;
        if (data) {
            // Parse roles JSON
            if (typeof data.roles === 'string') {
                try { data.roles = JSON.parse(data.roles); } catch (e) { data.roles = []; }
            } else if (!data.roles) {
                data.roles = data.role_id ? [data.role_id] : [];
            }
            if (!Array.isArray(data.roles)) {
                data.roles = data.role_id ? [data.role_id] : [];
            }
        }
        vanityConfigCache.set(guildId, { data, expiresAt: Date.now() + 60000 }); // 60s TTL
        return data;
    } finally {
        if (conn) conn.release();
    }
}

async function setVanityConfig(guildId, vanityString, roleIdOrRoles, channelId = null, isEnabled = true, message = null) {
    let conn;
    try {
        conn = await pool.getConnection();
        let rolesArr = [];
        let primaryRoleId = null;

        if (Array.isArray(roleIdOrRoles)) {
            rolesArr = roleIdOrRoles.filter(Boolean);
            primaryRoleId = rolesArr[0] || null;
        } else if (roleIdOrRoles) {
            rolesArr = [roleIdOrRoles];
            primaryRoleId = roleIdOrRoles;
        }

        const rolesJson = JSON.stringify(rolesArr);

        await conn.query(`
            INSERT INTO guild_vanity_config (guild_id, vanity_string, role_id, roles, channel_id, is_enabled, message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                vanity_string = VALUES(vanity_string),
                role_id = VALUES(role_id),
                roles = VALUES(roles),
                channel_id = VALUES(channel_id),
                is_enabled = VALUES(is_enabled),
                message = VALUES(message)
        `, [guildId, vanityString, primaryRoleId, rolesJson, channelId, isEnabled, message]);
        
        vanityConfigCache.delete(guildId);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function addVanityUser(guildId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query(`
            INSERT IGNORE INTO guild_vanity_users (guild_id, user_id)
            VALUES (?, ?)
        `, [guildId, userId]);
        return res.affectedRows > 0;
    } catch (e) {
        return false;
    } finally {
        if (conn) conn.release();
    }
}

async function removeVanityUser(guildId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`DELETE FROM guild_vanity_users WHERE guild_id = ? AND user_id = ?`, [guildId, userId]);
        return true;
    } catch (e) {
        return false;
    } finally {
        if (conn) conn.release();
    }
}

async function getVanityUsers(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
            SELECT user_id, adopted_at FROM guild_vanity_users 
            WHERE guild_id = ? 
            ORDER BY adopted_at DESC
        `, [guildId]);
        return rows || [];
    } catch (e) {
        return [];
    } finally {
        if (conn) conn.release();
    }
}

async function getMediaChannels(guildId) {
    const cached = mediaChannelsCache.get(guildId);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT channel_id FROM guild_media_channels WHERE guild_id = ?', [guildId]);
        const data = rows.map(r => r.channel_id);
        mediaChannelsCache.set(guildId, { data, expiresAt: Date.now() + 60000 }); // 60s TTL
        return data;
    } finally {
        if (conn) conn.release();
    }
}

async function addMediaChannel(guildId, channelId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('INSERT IGNORE INTO guild_media_channels (guild_id, channel_id) VALUES (?, ?)', [guildId, channelId]);
        mediaChannelsCache.delete(guildId);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function removeMediaChannel(guildId, channelId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM guild_media_channels WHERE guild_id = ? AND channel_id = ?', [guildId, channelId]);
        mediaChannelsCache.delete(guildId);
        return res.affectedRows > 0;
    } finally {
        if (conn) conn.release();
    }
}

async function getAutoReactChannels(guildId) {
    const cached = autoReactChannelsCache.get(guildId);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const data = await conn.query('SELECT channel_id, emojis FROM guild_autoreact_channels WHERE guild_id = ?', [guildId]);
        autoReactChannelsCache.set(guildId, { data, expiresAt: Date.now() + 60000 }); // 60s TTL
        return data;
    } finally {
        if (conn) conn.release();
    }
}

async function addAutoReactChannel(guildId, channelId, emojis) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_autoreact_channels (guild_id, channel_id, emojis)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE emojis = VALUES(emojis)
        `, [guildId, channelId, emojis]);
        autoReactChannelsCache.delete(guildId);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function removeAutoReactChannel(guildId, channelId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM guild_autoreact_channels WHERE guild_id = ? AND channel_id = ?', [guildId, channelId]);
        autoReactChannelsCache.delete(guildId);
        return res.affectedRows > 0;
    } finally {
        if (conn) conn.release();
    }
}

async function getAutoBumpConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_autobump_config WHERE guild_id = ?', [guildId]);
        return rows[0] || null;
    } finally {
        if (conn) conn.release();
    }
}

async function setAutoBumpConfig(guildId, channelId, roleId = null, isEnabled = true) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_autobump_config (guild_id, channel_id, ping_role_id, is_enabled)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                channel_id = VALUES(channel_id),
                ping_role_id = VALUES(ping_role_id),
                is_enabled = VALUES(is_enabled)
        `, [guildId, channelId, roleId, isEnabled]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function updateAutoBumpTime(guildId, timestamp) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE guild_autobump_config SET last_bump_time = ? WHERE guild_id = ?', [timestamp, guildId]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function getAutoPostConfigs() {
    let conn;
    try {
        conn = await pool.getConnection();
        return await conn.query('SELECT * FROM guild_autopost_config WHERE is_enabled = TRUE');
    } finally {
        if (conn) conn.release();
    }
}

async function addAutoPostConfig(guildId, channelId, feedType) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_autopost_config (guild_id, channel_id, feed_type)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE is_enabled = TRUE
        `, [guildId, channelId, feedType]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function removeAutoPostConfig(guildId, channelId, feedType) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM guild_autopost_config WHERE guild_id = ? AND channel_id = ? AND feed_type = ?', [guildId, channelId, feedType]);
        return res.affectedRows > 0;
    } finally {
        if (conn) conn.release();
    }
}

async function updateAutoPostTime(id, timestamp) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE guild_autopost_config SET last_post_time = ? WHERE id = ?', [timestamp, id]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

// --- PAKET 2: ÇEKİLİŞ & VERİ DÖKÜMÜ YARDIMCI FONKSİYONLARI ---

async function getGiveawaySettings(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_giveaway_settings WHERE guild_id = ?', [guildId]);
        if (rows.length === 0) return { guild_id: guildId, manager_roles: [], log_channel_id: null, ping_role_id: null, ignored_roles: [], dm_winner: true, show_parts: true };
        const s = rows[0];
        try { s.manager_roles = JSON.parse(s.manager_roles || '[]'); } catch (e) { s.manager_roles = []; }
        try { s.ignored_roles = JSON.parse(s.ignored_roles || '[]'); } catch (e) { s.ignored_roles = []; }
        s.dm_winner = !!s.dm_winner;
        s.show_parts = s.show_parts !== 0; // if it's explicitly 0/false
        return s;
    } finally {
        if (conn) conn.release();
    }
}

async function setGiveawaySettings(guildId, data) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT guild_id FROM guild_giveaway_settings WHERE guild_id = ?', [guildId]);
        if (rows.length === 0) {
            await conn.query(`
                INSERT INTO guild_giveaway_settings (guild_id, manager_roles, log_channel_id, ping_role_id, dm_winner, ignored_roles, show_parts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                guildId, JSON.stringify(data.manager_roles || []), data.log_channel_id || null, data.ping_role_id || null, data.dm_winner !== false, JSON.stringify(data.ignored_roles || []), data.show_parts !== false
            ]);
        } else {
            await conn.query(`
                UPDATE guild_giveaway_settings
                SET manager_roles = ?, log_channel_id = ?, ping_role_id = ?, dm_winner = ?, ignored_roles = ?, show_parts = ?
                WHERE guild_id = ?
            `, [
                JSON.stringify(data.manager_roles || []), data.log_channel_id || null, data.ping_role_id || null, data.dm_winner !== false, JSON.stringify(data.ignored_roles || []), data.show_parts !== false, guildId
            ]);
        }
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function createGiveaway(data) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_giveaways (
                message_id, channel_id, guild_id, prize, description,
                winner_count, required_role_id, host_id, ends_at, status, participants, winners, show_parts, image_url,
                is_drop, paused, remaining_time_ms, exempt_roles, min_account_age_days, min_membership_days, min_boost_tier,
                min_messages, min_voice_minutes, min_invites
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '[]', '[]', ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.message_id, data.channel_id, data.guild_id, data.prize, data.description || null,
            data.winner_count || 1, data.required_role_id || null, data.host_id, data.ends_at, data.show_parts !== false,
            data.image_url || null, data.is_drop ? 1 : 0,
            JSON.stringify(data.exempt_roles || []), data.min_account_age_days || null, data.min_membership_days || null, data.min_boost_tier || null,
            data.min_messages || null, data.min_voice_minutes || null, data.min_invites || null
        ]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function getGiveaway(messageId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_giveaways WHERE message_id = ?', [messageId]);
        if (rows.length === 0) return null;
        const gw = rows[0];
        try { gw.participants = JSON.parse(gw.participants || '[]'); } catch (e) { gw.participants = []; }
        try { gw.winners = JSON.parse(gw.winners || '[]'); } catch (e) { gw.winners = []; }
        try { gw.exempt_roles = JSON.parse(gw.exempt_roles || '[]'); } catch (e) { gw.exempt_roles = []; }
        gw.entries_closed = !!gw.entries_closed;
        gw.is_drop = !!gw.is_drop;
        gw.paused = !!gw.paused;
        gw.remaining_time_ms = gw.remaining_time_ms ? Number(gw.remaining_time_ms) : null;
        return gw;
    } finally {
        if (conn) conn.release();
    }
}

async function getActiveGiveaways() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM guild_giveaways WHERE status = 'active' OR status = 'paused'");
        return rows.map(gw => {
            try { gw.participants = JSON.parse(gw.participants || '[]'); } catch (e) { gw.participants = []; }
            try { gw.winners = JSON.parse(gw.winners || '[]'); } catch (e) { gw.winners = []; }
            try { gw.exempt_roles = JSON.parse(gw.exempt_roles || '[]'); } catch (e) { gw.exempt_roles = []; }
            gw.entries_closed = !!gw.entries_closed;
            gw.is_drop = !!gw.is_drop;
            gw.paused = !!gw.paused;
            gw.remaining_time_ms = gw.remaining_time_ms ? Number(gw.remaining_time_ms) : null;
            return gw;
        });
    } finally {
        if (conn) conn.release();
    }
}

async function getGuildGiveaways(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_giveaways WHERE guild_id = ? ORDER BY id DESC LIMIT 25', [guildId]);
        return rows.map(gw => {
            try { gw.participants = JSON.parse(gw.participants || '[]'); } catch (e) { gw.participants = []; }
            try { gw.winners = JSON.parse(gw.winners || '[]'); } catch (e) { gw.winners = []; }
            try { gw.exempt_roles = JSON.parse(gw.exempt_roles || '[]'); } catch (e) { gw.exempt_roles = []; }
            gw.entries_closed = !!gw.entries_closed;
            gw.is_drop = !!gw.is_drop;
            gw.paused = !!gw.paused;
            gw.remaining_time_ms = gw.remaining_time_ms ? Number(gw.remaining_time_ms) : null;
            return gw;
        });
    } finally {
        if (conn) conn.release();
    }
}

async function pauseGiveaway(messageId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT ends_at, status FROM guild_giveaways WHERE message_id = ?', [messageId]);
        if (rows.length === 0) return { error: 'Çekiliş bulunamadı.' };
        if (rows[0].status !== 'active') return { error: 'Sadece aktif çekilişler duraklatılabilir.' };
        const remainingMs = Math.max(1000, Number(rows[0].ends_at) - Date.now());
        await conn.query("UPDATE guild_giveaways SET status = 'paused', paused = 1, remaining_time_ms = ? WHERE message_id = ?", [remainingMs, messageId]);
        return { success: true, remainingMs };
    } finally {
        if (conn) conn.release();
    }
}

async function resumeGiveaway(messageId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT remaining_time_ms, status FROM guild_giveaways WHERE message_id = ?', [messageId]);
        if (rows.length === 0) return { error: 'Çekiliş bulunamadı.' };
        if (rows[0].status !== 'paused') return { error: 'Sadece duraklatılmış çekilişler devam ettirilebilir.' };
        const remainingMs = Number(rows[0].remaining_time_ms) || 60000;
        const newEndsAt = Date.now() + remainingMs;
        await conn.query("UPDATE guild_giveaways SET status = 'active', paused = 0, ends_at = ?, remaining_time_ms = NULL WHERE message_id = ?", [newEndsAt, messageId]);
        return { success: true, endsAt: newEndsAt };
    } finally {
        if (conn) conn.release();
    }
}

async function editGiveaway(messageId, updates) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_giveaways WHERE message_id = ?', [messageId]);
        if (rows.length === 0) return { error: 'Çekiliş bulunamadı.' };
        const current = rows[0];
        
        let newEndsAt = Number(current.ends_at);
        let newRemainingMs = current.remaining_time_ms ? Number(current.remaining_time_ms) : null;
        
        if (updates.extraTimeMs && updates.extraTimeMs > 0) {
            if (current.status === 'paused' && newRemainingMs) {
                newRemainingMs += updates.extraTimeMs;
            } else {
                newEndsAt += updates.extraTimeMs;
            }
        }
        
        const newPrize = updates.prize || current.prize;
        const newWinnerCount = updates.winnerCount ? Math.max(1, Math.min(50, updates.winnerCount)) : current.winner_count;
        const newDesc = updates.description !== undefined ? updates.description : current.description;

        await conn.query(`
            UPDATE guild_giveaways 
            SET prize = ?, winner_count = ?, description = ?, ends_at = ?, remaining_time_ms = ?
            WHERE message_id = ?
        `, [newPrize, newWinnerCount, newDesc, newEndsAt, newRemainingMs, messageId]);

        return { success: true, prize: newPrize, winnerCount: newWinnerCount, endsAt: newEndsAt };
    } finally {
        if (conn) conn.release();
    }
}

async function updateGiveawayStatus(messageId, status) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE guild_giveaways SET status = ? WHERE message_id = ?', [status, messageId]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function toggleGiveawayParticipant(messageId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT status, participants FROM guild_giveaways WHERE message_id = ? FOR UPDATE', [messageId]);
        if (rows.length === 0 || rows[0].status !== 'active') return null;

        let parts = [];
        try {
            parts = typeof rows[0].participants === 'string' ? JSON.parse(rows[0].participants || '[]') : (rows[0].participants || []);
        } catch (e) {
            parts = [];
        }

        const uid = String(userId);
        const index = parts.indexOf(uid);
        let joined = false;

        if (index > -1) {
            parts.splice(index, 1);
            joined = false;
        } else {
            parts.push(uid);
            joined = true;
        }

        await conn.query('UPDATE guild_giveaways SET participants = ? WHERE message_id = ?', [JSON.stringify(parts), messageId]);
        return { joined, count: parts.length, participants: parts };
    } finally {
        if (conn) conn.release();
    }
}


async function setGiveawayWinners(messageId, winnersArray) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("UPDATE guild_giveaways SET winners = ?, status = 'ended' WHERE message_id = ?", [JSON.stringify(winnersArray), messageId]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function cancelGiveaway(messageId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("UPDATE guild_giveaways SET status = 'cancelled' WHERE message_id = ?", [messageId]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function setShowParts(messageId, showParts) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("UPDATE guild_giveaways SET show_parts = ? WHERE message_id = ?", [showParts, messageId]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

// Veri Dökümü Yardımcıları
async function dumpGuildPunishments(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        return await conn.query('SELECT * FROM mutes WHERE guild_id = ? ORDER BY id DESC', [guildId]);
    } finally {
        if (conn) conn.release();
    }
}

async function dumpGuildWarnings(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        return await conn.query('SELECT * FROM warnings WHERE guild_id = ? ORDER BY id DESC', [guildId]);
    } finally {
        if (conn) conn.release();
    }
}

// --- PAKET 5: PROFİL & EVLİLİK YARDIMCI FONKSİYONLARI ---

async function getUserProfile(userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
        if (rows.length === 0) return null;
        const p = rows[0];
        try { p.badges = JSON.parse(p.badges || '[]'); } catch (e) { p.badges = []; }
        return p;
    } finally {
        if (conn) conn.release();
    }
}

async function setUserBio(userId, bio) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO user_profiles (user_id, bio)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE bio = VALUES(bio)
        `, [userId, bio]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function setMarriage(user1Id, user2Id) {
    let conn;
    try {
        conn = await pool.getConnection();
        const now = new Date();
        await conn.query(`
            INSERT INTO user_profiles (user_id, partner_id, married_at)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE partner_id = VALUES(partner_id), married_at = VALUES(married_at)
        `, [user1Id, user2Id, now]);

        await conn.query(`
            INSERT INTO user_profiles (user_id, partner_id, married_at)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE partner_id = VALUES(partner_id), married_at = VALUES(married_at)
        `, [user2Id, user1Id, now]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function removeMarriage(userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const p = await getUserProfile(userId);
        if (!p || !p.partner_id) return false;
        const partnerId = p.partner_id;

        await conn.query('UPDATE user_profiles SET partner_id = NULL, married_at = NULL WHERE user_id IN (?, ?)', [userId, partnerId]);
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function updateGiveawayExemptRoles(messageId, exempt_roles) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE guild_giveaways SET exempt_roles = ? WHERE message_id = ?', [JSON.stringify(exempt_roles), messageId]);
    } catch (e) {
        console.error('[DB] updateGiveawayExemptRoles error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function setGiveawayConditions(messageId, data) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            UPDATE guild_giveaways
            SET
                required_role_id = ?,
                exempt_roles = ?,
                min_account_age_days = ?,
                min_membership_days = ?,
                min_boost_tier = ?,
                min_messages = ?,
                min_voice_minutes = ?,
                min_invites = ?
            WHERE message_id = ?
        `, [
            data.required_role_id ?? null,
            data.exempt_roles ? JSON.stringify(data.exempt_roles) : null,
            data.min_account_age_days ?? null,
            data.min_membership_days ?? null,
            data.min_boost_tier ?? null,
            data.min_messages ?? null,
            data.min_voice_minutes ?? null,
            data.min_invites ?? null,
            messageId
        ]);
        return true;
    } catch (e) {
        console.error('[DB] setGiveawayConditions error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function setGiveawayEntriesClosed(messageId, closed) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE guild_giveaways SET entries_closed = ? WHERE message_id = ?', [closed ? 1 : 0, messageId]);
        return true;
    } catch (e) {
        console.error('[DB] setGiveawayEntriesClosed error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function setGiveawayImage(messageId, imageUrl) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('UPDATE guild_giveaways SET image_url = ? WHERE message_id = ?', [imageUrl, messageId]);
        return true;
    } catch (e) {
        console.error('[DB] setGiveawayImage error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

// --- LEVEL / SEVİYE SİSTEMİ VERİTABANI METOTLARI ---

async function getLevelConfig(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_level_config WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            const row = rows[0];
            return {
                ...row,
                enabled: row.enabled === 1 || row.enabled === true,
                exempt_channels: typeof row.exempt_channels === 'string' ? JSON.parse(row.exempt_channels || '[]') : (row.exempt_channels || []),
                exempt_roles: typeof row.exempt_roles === 'string' ? JSON.parse(row.exempt_roles || '[]') : (row.exempt_roles || [])
            };
        }
        // Varsayılan ayarlar: Sistem yönetici tarafından açılana ve kanal seçilene kadar kapalıdır
        return {
            guild_id: guildId,
            enabled: false,
            announcement_channel_id: null,
            announcement_type: 'channel',
            msg_xp: 15,
            voice_xp: 10,
            xp_per_level: 100,
            cooldown_secs: 60,
            invite_xp: 200,
            reward_mode: 'stack',
            exempt_channels: [],
            exempt_roles: []
        };
    } catch (e) {
        console.error('[DB] getLevelConfig error:', e.message);
        return {
            guild_id: guildId,
            enabled: false,
            announcement_channel_id: null,
            announcement_type: 'channel',
            msg_xp: 15,
            voice_xp: 10,
            xp_per_level: 100,
            cooldown_secs: 60,
            invite_xp: 200,
            reward_mode: 'stack',
            exempt_channels: [],
            exempt_roles: []
        };
    } finally {
        if (conn) conn.release();
    }
}

async function updateLevelConfig(guildId, updates) {
    let conn;
    try {
        conn = await pool.getConnection();
        const existing = await conn.query('SELECT * FROM guild_level_config WHERE guild_id = ?', [guildId]);
        
        const exemptChans = updates.exempt_channels !== undefined ? JSON.stringify(updates.exempt_channels) : (existing[0]?.exempt_channels || '[]');
        const exemptRoles = updates.exempt_roles !== undefined ? JSON.stringify(updates.exempt_roles) : (existing[0]?.exempt_roles || '[]');
        
        if (existing.length === 0) {
            await conn.query(`
                INSERT INTO guild_level_config (
                    guild_id, enabled, announcement_channel_id, announcement_type,
                    msg_xp, voice_xp, xp_per_level, cooldown_secs, invite_xp,
                    reward_mode, exempt_channels, exempt_roles
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                guildId,
                updates.enabled !== undefined ? updates.enabled : true,
                updates.announcement_channel_id !== undefined ? updates.announcement_channel_id : null,
                updates.announcement_type !== undefined ? updates.announcement_type : 'channel',
                updates.msg_xp !== undefined ? updates.msg_xp : 15,
                updates.voice_xp !== undefined ? updates.voice_xp : 10,
                updates.xp_per_level !== undefined ? updates.xp_per_level : 100,
                updates.cooldown_secs !== undefined ? updates.cooldown_secs : 60,
                updates.invite_xp !== undefined ? updates.invite_xp : 200,
                updates.reward_mode !== undefined ? updates.reward_mode : 'stack',
                exemptChans,
                exemptRoles
            ]);
        } else {
            const fields = [];
            const values = [];
            for (const [key, val] of Object.entries(updates)) {
                if (key === 'exempt_channels' || key === 'exempt_roles') {
                    fields.push(`${key} = ?`);
                    values.push(JSON.stringify(val));
                } else {
                    fields.push(`${key} = ?`);
                    values.push(val);
                }
            }
            if (fields.length > 0) {
                values.push(guildId);
                await conn.query(`UPDATE guild_level_config SET ${fields.join(', ')} WHERE guild_id = ?`, values);
            }
        }
        return true;
    } catch (e) {
        console.error('[DB] updateLevelConfig error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

function sanitizeLevelUser(row, guildId, userId) {
    if (!row) {
        return {
            guild_id: guildId,
            user_id: userId,
            xp: 0,
            level: 0,
            messages: 0,
            voice_secs: 0,
            invites: 0,
            last_xp_at: 0
        };
    }
    return {
        guild_id: row.guild_id || guildId,
        user_id: row.user_id || userId,
        xp: Number(row.xp || 0),
        level: Number(row.level || 0),
        messages: Number(row.messages || 0),
        voice_secs: Number(row.voice_secs || 0),
        invites: Number(row.invites || 0),
        last_xp_at: Number(row.last_xp_at || 0)
    };
}

async function getLevelUser(guildId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return sanitizeLevelUser(rows[0], guildId, userId);
    } catch (e) {
        console.error('[DB] getLevelUser error:', e.message);
        return sanitizeLevelUser(null, guildId, userId);
    } finally {
        if (conn) conn.release();
    }
}

async function addLevelUserXP(guildId, userId, xpToAdd, isMessage = false, voiceSecs = 0, lastXpAt = null) {
    let conn;
    try {
        conn = await pool.getConnection();
        const msgIncrement = isMessage ? 1 : 0;
        const lastXp = lastXpAt || Date.now();
        
        await conn.query(`
            INSERT INTO guild_level_users (guild_id, user_id, xp, level, messages, voice_secs, invites, last_xp_at)
            VALUES (?, ?, ?, 0, ?, ?, 0, ?)
            ON DUPLICATE KEY UPDATE
                xp = xp + VALUES(xp),
                messages = messages + VALUES(messages),
                voice_secs = voice_secs + VALUES(voice_secs),
                last_xp_at = CASE WHEN ? THEN VALUES(last_xp_at) ELSE last_xp_at END
        `, [guildId, userId, xpToAdd, msgIncrement, voiceSecs, lastXp, isMessage]);

        const rows = await conn.query('SELECT * FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return sanitizeLevelUser(rows[0], guildId, userId);
    } catch (e) {
        console.error('[DB] addLevelUserXP error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function addLevelUserInvites(guildId, userId, count = 1, xpToAdd = 0) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_level_users (guild_id, user_id, xp, level, messages, voice_secs, invites, last_xp_at)
            VALUES (?, ?, ?, 0, 0, 0, ?, 0)
            ON DUPLICATE KEY UPDATE
                xp = xp + VALUES(xp),
                invites = invites + VALUES(invites)
        `, [guildId, userId, xpToAdd, count]);

        const rows = await conn.query('SELECT * FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return sanitizeLevelUser(rows[0], guildId, userId);
    } catch (e) {
        console.error('[DB] addLevelUserInvites error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function setLevelUser(guildId, userId, xp, level) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_level_users (guild_id, user_id, xp, level, messages, voice_secs, invites, last_xp_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 0)
            ON DUPLICATE KEY UPDATE
                xp = VALUES(xp),
                level = VALUES(level)
        `, [guildId, userId, xp, level]);
        const rows = await conn.query('SELECT * FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return sanitizeLevelUser(rows[0], guildId, userId);
    } catch (e) {
        console.error('[DB] setLevelUser error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function resetLevelUser(guildId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM guild_level_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return true;
    } catch (e) {
        console.error('[DB] resetLevelUser error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function resetGuildLevels(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM guild_level_users WHERE guild_id = ?', [guildId]);
        return true;
    } catch (e) {
        console.error('[DB] resetGuildLevels error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function getLevelRewards(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_level_rewards WHERE guild_id = ? ORDER BY level ASC', [guildId]);
        return rows;
    } catch (e) {
        console.error('[DB] getLevelRewards error:', e.message);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

async function addLevelReward(guildId, level, roleId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO guild_level_rewards (guild_id, level, role_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
        `, [guildId, level, roleId]);
        return true;
    } catch (e) {
        console.error('[DB] addLevelReward error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function removeLevelReward(guildId, rewardId) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM guild_level_rewards WHERE guild_id = ? AND id = ?', [guildId, rewardId]);
        return true;
    } catch (e) {
        console.error('[DB] removeLevelReward error:', e.message);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function getTopLevelUsers(guildId, limit = 10, category = 'xp') {
    let conn;
    try {
        conn = await pool.getConnection();
        let orderByClause = 'xp DESC';
        if (category === 'messages') orderByClause = 'messages DESC';
        else if (category === 'voice') orderByClause = 'voice_secs DESC';
        else if (category === 'invites') orderByClause = 'invites DESC';

        const rows = await conn.query(`SELECT * FROM guild_level_users WHERE guild_id = ? ORDER BY ${orderByClause} LIMIT ?`, [guildId, limit]);
        return rows.map(r => sanitizeLevelUser(r, guildId, r.user_id));
    } catch (e) {
        console.error('[DB] getTopLevelUsers error:', e.message);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

async function getTopReputationUsers(guildId, limit = 10) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
            SELECT user_id, COUNT(*) AS rep_count, MAX(given_at) AS last_given_at
            FROM reputation
            WHERE guild_id = ?
            GROUP BY user_id
            ORDER BY rep_count DESC
            LIMIT ?
        `, [guildId, limit]);
        return rows;
    } catch (e) {
        console.error('[DB] getTopReputationUsers error:', e.message);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

async function getUserDailyQuests(guildId, userId, dateStr) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT * FROM user_daily_quests WHERE guild_id = ? AND user_id = ? AND quest_date = ?',
            [guildId, userId, dateStr]
        );
        if (rows.length > 0) {
            return rows[0];
        }
        return {
            guild_id: guildId,
            user_id: userId,
            quest_date: dateStr,
            messages_count: 0,
            voice_minutes: 0,
            suggestions_count: 0,
            claimed_msg: 0,
            claimed_voice: 0,
            claimed_sug: 0
        };
    } catch (e) {
        console.error('[DB] getUserDailyQuests error:', e.message);
        return {
            guild_id: guildId,
            user_id: userId,
            quest_date: dateStr,
            messages_count: 0,
            voice_minutes: 0,
            suggestions_count: 0,
            claimed_msg: 0,
            claimed_voice: 0,
            claimed_sug: 0
        };
    } finally {
        if (conn) conn.release();
    }
}

async function incrementDailyQuestProgress(guildId, userId, dateStr, type, amount = 1) {
    let conn;
    try {
        conn = await pool.getConnection();
        let column = 'messages_count';
        if (type === 'voice') column = 'voice_minutes';
        else if (type === 'suggestion') column = 'suggestions_count';

        await conn.query(`
            INSERT INTO user_daily_quests (guild_id, user_id, quest_date, ${column})
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE ${column} = ${column} + ?
        `, [guildId, userId, dateStr, amount, amount]);

        const rows = await conn.query(
            'SELECT * FROM user_daily_quests WHERE guild_id = ? AND user_id = ? AND quest_date = ?',
            [guildId, userId, dateStr]
        );
        return rows[0];
    } catch (e) {
        console.error('[DB] incrementDailyQuestProgress error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function claimDailyQuest(guildId, userId, dateStr, type) {
    let conn;
    try {
        conn = await pool.getConnection();
        let col = 'claimed_msg';
        if (type === 'voice') col = 'claimed_voice';
        else if (type === 'suggestion') col = 'claimed_sug';

        await conn.query(`
            UPDATE user_daily_quests
            SET ${col} = 1
            WHERE guild_id = ? AND user_id = ? AND quest_date = ?
        `, [guildId, userId, dateStr]);

        const rows = await conn.query(
            'SELECT * FROM user_daily_quests WHERE guild_id = ? AND user_id = ? AND quest_date = ?',
            [guildId, userId, dateStr]
        );
        return rows[0];
    } catch (e) {
        console.error('[DB] claimDailyQuest error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function getLevelRank(guildId, userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
            SELECT COUNT(*) + 1 AS rank_position
            FROM guild_level_users
            WHERE guild_id = ? AND xp > (
                SELECT COALESCE(xp, 0) FROM guild_level_users WHERE guild_id = ? AND user_id = ?
            )
        `, [guildId, guildId, userId]);
        return Number(rows[0]?.rank_position || 1);
    } catch (e) {
        console.error('[DB] getLevelRank error:', e.message);
        return 1;
    } finally {
        if (conn) conn.release();
    }
}

// --- MINECRAFT HESAP EŞLEME YARDIMCILARI ---
async function createMCLinkRequest(discordId, mcUsername = null) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM mc_link_requests WHERE discord_id = ?', [discordId]);
        const num = Math.floor(100000 + Math.random() * 900000);
        const code = `TL-${num}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await conn.query(
            'INSERT INTO mc_link_requests (verify_code, discord_id, mc_username, expires_at) VALUES (?, ?, ?, ?)',
            [code, discordId, mcUsername, expiresAt]
        );
        return { code, expiresAt };
    } catch (e) {
        console.error('[DB] createMCLinkRequest error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function getMCLinkRequestByCode(code) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT * FROM mc_link_requests WHERE verify_code = ? AND expires_at > NOW()',
            [code]
        );
        return rows[0] || null;
    } catch (e) {
        console.error('[DB] getMCLinkRequestByCode error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function completeMCLink(code, mcUsername, mcUuid) {
    let conn;
    try {
        conn = await pool.getConnection();
        const req = await getMCLinkRequestByCode(code);
        if (!req) return { success: false, reason: 'KOD_GECERSIZ_VEYA_SURESI_DOLMUS' };
        
        await conn.query(`
            INSERT INTO mc_linked_accounts (discord_id, mc_uuid, mc_username, linked_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE mc_uuid = VALUES(mc_uuid), mc_username = VALUES(mc_username), last_sync = NOW()
        `, [req.discord_id, mcUuid, mcUsername]);

        await conn.query('DELETE FROM mc_link_requests WHERE verify_code = ?', [code]);
        return { success: true, discord_id: req.discord_id, mc_username: mcUsername, mc_uuid: mcUuid };
    } catch (e) {
        console.error('[DB] completeMCLink error:', e.message);
        return { success: false, reason: e.message };
    } finally {
        if (conn) conn.release();
    }
}

async function getMCLinkedAccount(discordId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM mc_linked_accounts WHERE discord_id = ?', [discordId]);
        return rows[0] || null;
    } catch (e) {
        console.error('[DB] getMCLinkedAccount error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function getMCLinkByUsername(mcUsername) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM mc_linked_accounts WHERE LOWER(mc_username) = LOWER(?)', [mcUsername]);
        return rows[0] || null;
    } catch (e) {
        console.error('[DB] getMCLinkByUsername error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function unlinkMCAccount(discordId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM mc_linked_accounts WHERE discord_id = ?', [discordId]);
        return (res.affectedRows || 0) > 0;
    } catch (e) {
        console.error('[DB] unlinkMCAccount error:', e.message);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

// --- KİŞİSEL ÇALMA LİSTELERİ (USER PLAYLISTS) ---
async function getUserPlaylists(userId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT playlist_name, tracks, updated_at FROM user_playlists WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
        return (rows || []).map(r => ({
            name: r.playlist_name,
            tracks: typeof r.tracks === 'string' ? JSON.parse(r.tracks || '[]') : (r.tracks || []),
            updated_at: r.updated_at
        }));
    } catch(e) {
        console.error('[DB] getUserPlaylists error:', e.message);
        return [];
    } finally {
        if (conn) conn.release();
    }
}

async function getUserPlaylist(userId, playlistName) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT playlist_name, tracks, updated_at FROM user_playlists WHERE user_id = ? AND playlist_name = ?', [userId, playlistName]);
        if (!rows || !rows.length) return null;
        return {
            name: rows[0].playlist_name,
            tracks: typeof rows[0].tracks === 'string' ? JSON.parse(rows[0].tracks || '[]') : (rows[0].tracks || []),
            updated_at: rows[0].updated_at
        };
    } catch(e) {
        console.error('[DB] getUserPlaylist error:', e.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function saveUserPlaylist(userId, playlistName, tracks = []) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO user_playlists (user_id, playlist_name, tracks)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE tracks = VALUES(tracks)
        `, [userId, playlistName, JSON.stringify(tracks)]);
        return true;
    } catch(e) {
        console.error('[DB] saveUserPlaylist error:', e.message);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

async function deleteUserPlaylist(userId, playlistName) {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query('DELETE FROM user_playlists WHERE user_id = ? AND playlist_name = ?', [userId, playlistName]);
        return (res.affectedRows || 0) > 0;
    } catch(e) {
        console.error('[DB] deleteUserPlaylist error:', e.message);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    pool,
    initDB,
    getUserPlaylists,
    getUserPlaylist,
    saveUserPlaylist,
    deleteUserPlaylist,
    getGuildConfig,
    updateConfigCache,
    updateGuildConfigCache,
    clearGuildConfigCache,
    getGuildSetup,
    updateGuildSetupCache, 
    clearGuildSetupCache,
    getFilteredWords, 
    updateFilteredWordsCache,
    clearFilteredWordsCache,
    getAutoModConfig,
    updateAutoModConfigCache,
    clearAutoModConfigCache,
    getWelcomeConfig,
    updateWelcomeConfigCache,
    clearWelcomeConfigCache,
    getCompleteGuildLogState,
    clearLogStateCache,
    setGuildLogChannel,
    setAllGuildLogChannels,
    setGuildLogEvent,
    setAllCategoryEvents,
    addGuildLogIgnored,
    removeGuildLogIgnored,
    setGuildLogSettings,
    setGiveawayExemptRoles: updateGiveawayExemptRoles,
    resetGuildLogs,
    getVanityConfig,
    setVanityConfig,
    addVanityUser,
    removeVanityUser,
    getVanityUsers,
    getAntiNukeConfig,
    setAntiNukeConfig,
    getAntiNukeWhitelist,
    addAntiNukeWhitelist,
    removeAntiNukeWhitelist,
    getAutoPostConfigs,
    addAutoPostConfig,
    removeAutoPostConfig,
    updateAutoPostTime,
    getMediaChannels,
    getAutoReactChannels,
    getAutoBumpConfig,
    updateAutoBumpTime,
    getGiveawaySettings,
    setGiveawaySettings,
    createGiveaway,
    pauseGiveaway,
    resumeGiveaway,
    editGiveaway,
    setGiveawayConditions,
    setGiveawayEntriesClosed,
    setGiveawayImage,
    getGiveaway,
    getActiveGiveaways,
    getGuildGiveaways,
    updateGiveawayStatus,
    toggleGiveawayParticipant,
    setGiveawayWinners,
    cancelGiveaway,
    setShowParts,
    dumpGuildPunishments,
    dumpGuildWarnings,
    getUserProfile,
    setUserBio,
    setMarriage,
    removeMarriage,
    // Müzik Sistemi
    getLikedSongs,
    addLikedSong,
    removeLikedSong,
    getMusicConfig,
    updateMusicConfig,
    addMusicHistory,
    getMusicHistory,
    // Level Sistemi
    getLevelConfig,
    updateLevelConfig,
    getLevelUser,
    addLevelUserXP,
    addLevelUserInvites,
    setLevelUser,
    resetLevelUser,
    resetGuildLevels,
    getLevelRewards,
    addLevelReward,
    removeLevelReward,
    getTopLevelUsers,
    getTopReputationUsers,
    getUserDailyQuests,
    incrementDailyQuestProgress,
    claimDailyQuest,
    getLevelRank,
    // Minecraft Hesap Eşleme
    createMCLinkRequest,
    getMCLinkRequestByCode,
    completeMCLink,
    getMCLinkedAccount,
    getMCLinkByUsername,
    unlinkMCAccount
};

