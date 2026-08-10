const { pool, getGuildConfig } = require('../db');

async function saveRolesAndApplyMute(member, actionType) {
    let conn;
    try {
        conn = await pool.getConnection();
        const config = await getGuildConfig(member.guild.id);
        if (!config) return;

        let roleToKeepId = null;
        if (actionType === 'mute') roleToKeepId = config.text_mute_role_id;
        else if (actionType === 'voice_mute') roleToKeepId = config.voice_mute_role_id;
        else if (actionType === 'warn3_ban') roleToKeepId = config.banned_role_id;

        if (!roleToKeepId) return;

        const rolesToSave = [];
        member.roles.cache.forEach(role => {
            if (role.id !== member.guild.id && role.id !== roleToKeepId && !role.managed && role.name !== '@everyone') {
                rolesToSave.push(role.id);
            }
        });

        if (rolesToSave.length > 0) {
            await conn.query(`
                INSERT INTO role_memory (guild_id, user_id, roles, action_type)
                VALUES (?, ?, ?, ?)
            `, [member.guild.id, member.id, JSON.stringify(rolesToSave), actionType]);
            
            await member.roles.remove(rolesToSave, 'Karantina / Mute: Rol Hafızası (Roller söküldü)').catch(()=>{});
        }
    } catch(e) {
        console.error("saveRolesAndApplyMute Error:", e);
    } finally {
        if (conn) conn.release();
    }
}

async function restoreRoles(member, actionType) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
            SELECT id, roles FROM role_memory 
            WHERE guild_id = ? AND user_id = ? AND action_type = ? 
            ORDER BY created_at DESC LIMIT 1
        `, [member.guild.id, member.id, actionType]);

        if (rows.length > 0) {
            const rolesArray = JSON.parse(rows[0].roles);
            const rolesToGive = [];
            for (const rId of rolesArray) {
                if (member.guild.roles.cache.has(rId)) {
                    rolesToGive.push(rId);
                }
            }
            if (rolesToGive.length > 0) {
                await member.roles.add(rolesToGive, 'Karantina / Mute Bitti: Roller geri verildi').catch(()=>{});
            }
            await conn.query('DELETE FROM role_memory WHERE id = ?', [rows[0].id]);
        }
    } catch(e) {
        console.error("restoreRoles Error:", e);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { saveRolesAndApplyMute, restoreRoles };
