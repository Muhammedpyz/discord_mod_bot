const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { parseFancyDuration, fmtDuration } = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('süreli-ban')
        .setDescription('Üyeyi süreli yasaklar, süre bitince otomatik açılır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName('uye').setDescription('Üye').setRequired(true))
        .addStringOption(o => o.setName('sure').setDescription('Süre (örn: 1g, 12s, 30dk)').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const uye = interaction.options.getUser('uye');
        const sureStr = interaction.options.getString('sure');
        const sebep = interaction.options.getString('sebep') || 'Belirtilmedi';
        const ms = parseFancyDuration(sureStr);
        if (!ms) {
            return interaction.editReply(createContainerMessage('Hata', 'Geçersiz süre! Örn: `1g`, `12s`, `30dk`.', '#ED4245', [], [], false, true));
        }
        try {
            await interaction.guild.members.ban(uye.id, { reason: `Süreli ban (${fmtDuration(ms)}): ${sebep}` }).catch(async () => {
                await interaction.guild.bans.create(uye.id, { reason: `Süreli ban: ${sebep}` });
            });
            await db.pool.query('INSERT INTO tempbans (guild_id, user_id, expires_at, sebep) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at), sebep=VALUES(sebep)', [interaction.guild.id, uye.id, Date.now() + ms, sebep]);
            await interaction.editReply(createContainerMessage('Yasaklandı', `<:mono:${MONO_EMOJIS.check}> <@${uye.id}> **${fmtDuration(ms)}** süreyle yasaklandı.\nSebep: ${sebep}\n\n-# Süre bitince otomatik açılır.`, '#ED4245', [], [], false, true));
        } catch (e) {
            console.error('[SüreliBan]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Yasaklanamadı (rol sırası/yetki kontrol et).', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
