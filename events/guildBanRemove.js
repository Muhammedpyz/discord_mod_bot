'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const db = require('../db');
const { isWhitelisted, executePunishment } = require('../utils/antinukeManager');
const { fastBan } = require('../utils/fastBanEngine');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        if (!ban || !ban.guild || !ban.user) return;

        const guild = ban.guild;
        const targetUser = ban.user;

        try {
            const anConfig = await db.getAntiNukeConfig(guild.id).catch(() => null);
            if (!anConfig || !anConfig.is_enabled || anConfig.anti_unban === false) return;

            // Audit Log'dan banı kimin kaldırdığını bul
            const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove }).catch(() => null);
            const entry = auditLogs?.entries?.first();

            if (!entry || !entry.executor) return;
            const executor = entry.executor;

            // Whitelist kontrolü
            if (await isWhitelisted(guild, executor.id)) return;

            // 1. Ultra Hızlı Re-Ban
            await fastBan(guild.id, targetUser.id, '[Anti-Nuke: Anti-Unban] İzinsiz ban kaldırma tespit edildi -> Otomatik Re-Ban uygulandı.');

            // 2. Saldırgan Yetkiliyi Cezalandır
            await executePunishment(guild, executor.id, 'İzinsiz Ban Kaldırma (Anti-Unban)', `Kullanıcının (<@${targetUser.id}>) banını izinsiz kaldırdı. Otomatik Re-Ban uygulandı.`, anConfig);

        } catch (err) {
            console.error('[Anti-Unban Error]:', err);
        }
    }
};
