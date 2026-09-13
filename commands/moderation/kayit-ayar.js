const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kayıt-ayar')
        .setDescription('Kayıt sistemi rollerini ve log kanalını ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addRoleOption(o => o.setName('kayitsiz').setDescription('Kayıtsız rolü').setRequired(false))
        .addRoleOption(o => o.setName('erkek').setDescription('Erkek rolü').setRequired(false))
        .addRoleOption(o => o.setName('kiz').setDescription('Kız rolü').setRequired(false))
        .addRoleOption(o => o.setName('yetkili').setDescription('Kayıt yetkilisi rolü').setRequired(false))
        .addChannelOption(o => o.setName('log').setDescription('Kayıt log kanalı').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const get = (n) => interaction.options.getRole(n)?.id || null;
        const log = interaction.options.getChannel('log')?.id || null;
        await db.pool.query(
            `INSERT INTO kayit_config (guild_id, kayitsiz_role_id, erkek_role_id, kiz_role_id, yetkili_role_id, log_channel_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE kayitsiz_role_id=COALESCE(VALUES(kayitsiz_role_id),kayitsiz_role_id),
             erkek_role_id=COALESCE(VALUES(erkek_role_id),erkek_role_id),
             kiz_role_id=COALESCE(VALUES(kiz_role_id),kiz_role_id),
             yetkili_role_id=COALESCE(VALUES(yetkili_role_id),yetkili_role_id),
             log_channel_id=COALESCE(VALUES(log_channel_id),log_channel_id)`,
            [interaction.guild.id, get('kayitsiz'), get('erkek'), get('kiz'), get('yetkili'), log]
        ).catch(async () => {
            // COALESCE'li upsert desteklenmezse sade upsert
            await db.pool.query(
                'INSERT INTO kayit_config (guild_id, kayitsiz_role_id, erkek_role_id, kiz_role_id, yetkili_role_id, log_channel_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE kayitsiz_role_id=VALUES(kayitsiz_role_id), erkek_role_id=VALUES(erkek_role_id), kiz_role_id=VALUES(kiz_role_id), yetkili_role_id=VALUES(yetkili_role_id), log_channel_id=VALUES(log_channel_id)',
                [interaction.guild.id, get('kayitsiz'), get('erkek'), get('kiz'), get('yetkili'), log]
            );
        });
        await interaction.editReply(createContainerMessage('Kayıt Ayarlandı', `<:mono:${MONO_EMOJIS.check}> Kayıt yapılandırması güncellendi.`, '#57F287', [], [], false, true));
    }
};
