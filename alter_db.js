const db = require('./db');
(async () => {
    try {
        const pool = db.pool;
        const conn = await pool.getConnection();
        await conn.query('ALTER TABLE guild_giveaway_settings ADD COLUMN show_parts BOOLEAN DEFAULT TRUE');
        console.log("Added show_parts column successfully!");
        conn.release();
    } catch (e) {
        console.error("Error (might already exist):", e.message);
    }
    process.exit(0);
})();
