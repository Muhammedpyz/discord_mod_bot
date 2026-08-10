const { createV2Message, COLORS, EMOJIS } = require('./uiBuilder');
const { pool } = require('../db');

const userLocks = new Map();

module.exports.issueWarning = async function(guild, user, moderatorId, reason) {
    const lockKey = `${guild.id}-${user.id}`;
    let currentLock = userLocks.get(lockKey) || Promise.resolve();
    
    let releaseLock;
    const nextLock = new Promise(resolve => releaseLock = resolve);
    userLocks.set(lockKey, currentLock.then(() => nextLock));

    return currentLock.then(async () => {
        let conn;
        try {
            conn = await pool.getConnection();
            
            await conn.query('UPDATE warnings SET is_active = FALSE WHERE expires_at IS NOT NULL AND expires_at < NOW()');

            const configRows = await conn.query('SELECT warn_decay_days, warn1_role_id, warn2_role_id, banned_role_id FROM guild_config WHERE guild_id = ?', [guild.id]);
            const daysToAdd = configRows.length > 0 ? configRows[0].warn_decay_days : 30;

            const activeWarnsCountQuery = await conn.query(
                'SELECT COUNT(id) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE',
                [guild.id, user.id]
            );
            const currentActiveCount = Number(activeWarnsCountQuery[0].count);

            let expireDays = 1;
            if (currentActiveCount === 1) expireDays = 3;
            else if (currentActiveCount >= 2) expireDays = null;

            if (expireDays === null) {
                await conn.query(
                    `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, expires_at) 
                     VALUES (?, ?, ?, ?, NULL)`,
                    [guild.id, user.id, moderatorId, reason]
                );
            } else {
                await conn.query(
                    `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, expires_at) 
                     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
                    [guild.id, user.id, moderatorId, reason, expireDays]
                );
            }

            const totalWarns = currentActiveCount + 1;
            
            let extraAction = '';
            let missingRole = false;
            let missingRoleMsg = '';
            
            let dmInfo;
            if (expireDays === null) {
                dmInfo = `**Geçerlilik:** Bu uyarı süresiz olarak kaydedilmiştir.\n**Toplam Aktif Uyarı:** ${totalWarns}`;
            } else {
                dmInfo = `**Geçerlilik:** Bu uyarı ${expireDays} gün sonra arşivlenecektir.\n**Toplam Aktif Uyarı:** ${totalWarns}`;
            }
            
            if (totalWarns === 1) {
                if (configRows.length > 0 && configRows[0].warn1_role_id) {
                    const roleId = configRows[0].warn1_role_id;
                    try {
                        const member = await guild.members.fetch(user.id);
                        if (member) {
                            await member.roles.add(roleId);
                            extraAction = `\nKullanıcı ilk uyarısını aldığı için <@&${roleId}> rolü tanımlandı.`;
                        }
                    } catch (roleErr) { 
                        console.error("Rol atama hatası 1:", roleErr.message); 
                        missingRole = true;
                        missingRoleMsg = `1. Uyarı Rolü (Hata: ${roleErr.message})`;
                    }
                } else {
                    missingRole = true;
                    missingRoleMsg = '1. Uyarı Rolü (Ayarlanmamış)';
                }
            }
            else if (totalWarns === 2) {
                if (configRows.length > 0 && configRows[0].warn2_role_id) {
                    const roleId = configRows[0].warn2_role_id;
                    const warn1RoleId = configRows[0].warn1_role_id;
                    try {
                        const member = await guild.members.fetch(user.id);
                        if (member) {
                            const newRoles = member.roles.cache
                                .filter(r => r.id !== warn1RoleId && r.id !== guild.id)
                                .map(r => r.id);
                            if (!newRoles.includes(roleId)) newRoles.push(roleId);
                            await member.roles.set(newRoles);
                            extraAction = `\nKullanıcı ikinci uyarısını aldığı için birinci uyarı rolü kaldırıldı ve <@&${roleId}> rolü tanımlandı.`;
                        }
                    } catch (roleErr) { 
                        console.error("Rol atama hatası 2:", roleErr.message); 
                        missingRole = true;
                        missingRoleMsg = `2. Uyarı Rolü (Hata: ${roleErr.message})`;
                    }
                } else {
                    missingRole = true;
                    missingRoleMsg = '2. Uyarı Rolü (Ayarlanmamış)';
                }
            }
            else if (totalWarns >= 3) {
                if (configRows.length > 0 && configRows[0].banned_role_id) {
                    const bannedRoleId = configRows[0].banned_role_id;
                    try {
                        const member = await guild.members.fetch(user.id);
                        if (member) {
                            const rolesToKeep = member.roles.cache
                                .filter(r => !r.editable || r.id === guild.id)
                                .map(r => r.id);
                            
                            const rolesToSave = member.roles.cache
                                .filter(r => r.editable && r.id !== guild.id && r.id !== bannedRoleId)
                                .map(r => r.id);

                            if (!rolesToKeep.includes(bannedRoleId)) {
                                rolesToKeep.push(bannedRoleId);
                            }
                            
                            await member.roles.set(rolesToKeep);

                            if (rolesToSave.length > 0) {
                                const values = rolesToSave.map(rId => [user.id, guild.id, rId]);
                                await conn.query('INSERT IGNORE INTO user_roles (user_id, guild_id, role_id) VALUES ?', [values]);
                            }
                            extraAction = `\nKullanıcı kural ihlali sınırına (3) ulaştığı için diğer rolleri alındı ve <@&${bannedRoleId}> rolü tanımlandı.`;
                            dmInfo += `\n\n**Önemli Bildirim:** Kural ihlali sınırına ulaştığınız için sunucuda yetkileriniz kısıtlanmıştır. Durumu görüşmek için bir destek talebi açabilirsiniz.`;
                        }
                    } catch (roleErr) {
                        console.error("Rol atama hatası 3:", roleErr.message);
                        missingRole = true;
                        missingRoleMsg = `3. Uyarı Rolü (Hata: ${roleErr.message})`;
                    }
                } else {
                    missingRole = true;
                    missingRoleMsg = '3. Uyarı Rolü (Ayarlanmamış)';
                }
            }

            let dmBasarili = true;
            try {
                const dmPayload = createV2Message({
                    title: `${EMOJIS.warning} Sunucu Uyarı Bildirimi`,
                    description: `**${guild.name}** sunucusunda kural ihlali nedeniyle uyarıldınız.\n**Yetkili:** <@${moderatorId}>\n**Sebep:** ${reason}\n\n${dmInfo}`,
                    color: COLORS.WARNING
                });
                await user.send(dmPayload);
            } catch (err) {
                dmBasarili = false;
            }

            return {
                success: true,
                totalWarns,
                daysToAdd: expireDays,
                dmBasarili,
                extraAction,
                missingRole,
                missingRoleMsg
            };

        } catch (err) {
            console.error("Uyarı sistemi hatası:", err);
            return { success: false };
        } finally {
            if (conn) conn.release();
            
            releaseLock();
            if (userLocks.get(lockKey) === nextLock) {
                userLocks.delete(lockKey);
            }
        }
    });
};
