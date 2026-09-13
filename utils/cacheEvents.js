/**
 * Veri-değişim olayları (bot -> site).
 * Kural: site cache'i SADECE gerçek veri değişince yenilenir (webhook mantığı).
 * Bu helper, DB'ye yazan akışların SONUNA tek satırla eklenir; hata fırlatmaz.
 *
 * Olaylar:
 *  - moderation_action : mute/warn/ban/kick/role_memory değişimi
 *  - ticket_opened     : yeni bilet (sayılar değişir)
 *  - member_join       : üye girişi (üye/guild sayıları değişir)
 *  - member_leave      : üye ayrılışı
 *  - guild_list_changed: bot sunucuya girdi/çıktı
 *  - commands_changed  : komut seti değişti (deploy scriptinden yayınlanır)
 */
function dataChanged(type, guildId) {
    try {
        const { broadcastEvent } = require('./eventBus');
        broadcastEvent(type, guildId ? { guild_id: String(guildId) } : {});
    } catch {}
}

module.exports = { dataChanged };
