const { pool } = require('./db');

async function addIndexes() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        console.log("İndeksler ekleniyor...");
        try { await conn.query('ALTER TABLE warnings ADD INDEX idx_guild_user (guild_id, user_id)'); } catch(e) { console.log('warnings index already exists or error'); }
        try { await conn.query('ALTER TABLE mutes ADD INDEX idx_guild_user (guild_id, user_id)'); } catch(e) { console.log('mutes index already exists or error'); }
        try { await conn.query('ALTER TABLE mod_notes ADD INDEX idx_guild_user (guild_id, user_id)'); } catch(e) { console.log('mod_notes index already exists or error'); }
        
        console.log("İşlem tamam.");
    } catch(e) {
        console.error(e);
    } finally {
        if(conn) conn.release();
        process.exit(0);
    }
}
addIndexes();
