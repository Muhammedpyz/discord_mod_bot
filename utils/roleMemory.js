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

        // EĞER KULLANICININ ZATEN YEDEĞİ VARSA (Yani zaten mutelu/cezalıysa), 
        // Orijinal rollerini EZMEMEK için yeni yedek alma. Sadece yeni eklenen rolleri yedeğe dahil et.
        const existing = await conn.query('SELECT roles FROM role_memory WHERE guild_id = ? AND user_id = ?', [member.guild.id, member.id]);
        let rolesToSave = new Set();
        
        if (existing.length > 0) {
            // Eski yedeği al
            for (const row of existing) {
                const oldRoles = JSON.parse(row.roles);
                oldRoles.forEach(r => rolesToSave.add(r));
            }
        }

        // Mevcut rolleri de yedeğe ekle (Ceza rolleri ASLA yedeğe alınmaz!)
        member.roles.cache.forEach(role => {
            if (role.id !== member.guild.id && role.id !== roleToKeepId && !role.managed && role.name !== '@everyone') {
                // HİÇBİR ceza rolünü yedeğe dahil etme
                if (role.id !== config.text_mute_role_id && 
                    role.id !== config.voice_mute_role_id && 
                    role.id !== config.banned_role_id &&
                    role.id !== config.warn1_role_id &&
                    role.id !== config.warn2_role_id) {
                    rolesToSave.add(role.id);
                }
            }
        });

        const finalRoles = Array.from(rolesToSave);

        if (finalRoles.length > 0) {
            // Tek bir birleştirilmiş yedek kaydı oluştur
            await conn.query('DELETE FROM role_memory WHERE guild_id = ? AND user_id = ?', [member.guild.id, member.id]);
            await conn.query(`
                INSERT INTO role_memory (guild_id, user_id, roles, action_type)
                VALUES (?, ?, ?, ?)
            `, [member.guild.id, member.id, JSON.stringify(finalRoles), 'punishment_backup']);
            
            // Tüm rolleri sök (Sadece ceza rolü kalacak)
            await member.roles.remove(finalRoles, 'Ceza (Mute/Ban): Roller yedeklendi ve söküldü').catch(()=>{});
        }
    } catch(e) {
        console.error("saveRolesAndApplyMute Error:", e);
    } finally {
        if (conn) conn.release();
    }
}

async function restoreRoles(member) {
    let conn;
    try {
        conn = await pool.getConnection();
        const config = await getGuildConfig(member.guild.id);
        
        // Eğer hala aktif bir cezası varsa rollerini GİRİ VERME.
        if (config) {
            const hasMute = config.text_mute_role_id && member.roles.cache.has(config.text_mute_role_id);
            const hasVoiceMute = config.voice_mute_role_id && member.roles.cache.has(config.voice_mute_role_id);
            const hasBan = config.banned_role_id && member.roles.cache.has(config.banned_role_id);
            
            if (hasMute || hasVoiceMute || hasBan) {
                return; // Kullanıcı hala cezalı, rolleri geri vermiyoruz.
            }
        }

        const rows = await conn.query(`
            SELECT id, roles FROM role_memory 
            WHERE guild_id = ? AND user_id = ? AND action_type = 'punishment_backup'
        `, [member.guild.id, member.id]);

        if (rows.length > 0) {
            const rolesArray = JSON.parse(rows[0].roles);
            const rolesToGive = [];
            for (const rId of rolesArray) {
                if (member.guild.roles.cache.has(rId)) {
                    rolesToGive.push(rId);
                }
            }
            if (rolesToGive.length > 0) {
                await member.roles.add(rolesToGive, 'Cezalar Bitti: Roller geri verildi').catch(()=>{});
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
