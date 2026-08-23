'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('itibar')
        .setDescription('Sunucu üyeleri arası itibar ve güvenilirlik puanlama sistemi')
        .addSubcommand(subcmd => 
            subcmd.setName('ver')
                .setDescription('Bir kullanıcıya +1 itibar puanı verin (24 saatte bir kullanılabilir)')
                .addUserOption(opt => opt.setName('kullanici').setDescription('İtibar verilecek üye').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('goruntule')
                .setDescription('Bir kullanıcının mevcut itibar puanını görüntüleyin')
                .addUserOption(opt => opt.setName('kullanici').setDescription('İtibarına bakılacak üye').setRequired(false))
        )
        .addSubcommand(subcmd =>
            subcmd.setName('top')
                .setDescription('Sunucunun en yüksek itibarına sahip ilk 10 üyesini listeler (Liderlik Tablosu)')
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;

            // 1. İTİBAR VER (GIVE REP)
            if (subcommand === 'ver') {
                if (targetUser.id === interaction.user.id) {
                    const payload = createContainerMessage(
                        'İşlem Başarısız',
                        'Kendinize itibar puanı veremezsiniz.',
                        COLORS.ERROR || '#ED4245'
                    );
                    payload.flags = MessageFlags.IsComponentsV2;
                    return await interaction.editReply(payload);
                }

                if (targetUser.bot) {
                    const payload = createContainerMessage(
                        'İşlem Başarısız',
                        'Botlara itibar puanı veremezsiniz.',
                        COLORS.ERROR || '#ED4245'
                    );
                    payload.flags = MessageFlags.IsComponentsV2;
                    return await interaction.editReply(payload);
                }

                const [cooldownRes] = await conn.query('SELECT last_given FROM rep_cooldown WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
                if (cooldownRes) {
                    const lastGiven = new Date(cooldownRes.last_given).getTime();
                    const now = Date.now();
                    const diffHours = (now - lastGiven) / (1000 * 60 * 60);
                    if (diffHours < 24) {
                        const remaining = Math.ceil(24 - diffHours);
                        const payload = createContainerMessage(
                            'Bekleme Süresi Devam Ediyor',
                            `Tekrar birine itibar puanı verebilmek için **${remaining} saat** beklemelisiniz.\n*(İtibar verme hakkı her 24 saatte bir yenilenir)*`,
                            COLORS.WARNING || '#FEE75C'
                        );
                        payload.flags = MessageFlags.IsComponentsV2;
                        return await interaction.editReply(payload);
                    }
                }

                await conn.query('INSERT INTO reputation (guild_id, user_id, given_by) VALUES (?, ?, ?)', [interaction.guild.id, targetUser.id, interaction.user.id]);
                await conn.query('INSERT INTO rep_cooldown (guild_id, user_id, last_given) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE last_given = CURRENT_TIMESTAMP', [interaction.guild.id, interaction.user.id]);

                // Yeni Toplam İtibar Sayısını Al
                const rows = await conn.query('SELECT COUNT(*) as repCount FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
                const newCount = Number(rows[0]?.repCount || 0);

                const payload = createContainerMessage(
                    'İtibar Puanı Verildi',
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> <@${interaction.user.id}> tarafından <@${targetUser.id}> kullanıcısına **+1 İtibar** verildi!\n\n> • **Yeni Toplam İtibar:** \`${newCount} Puan\``,
                    COLORS.SUCCESS || '#57F287'
                );
                payload.flags = MessageFlags.IsComponentsV2;
                await interaction.editReply(payload);

                // Denetim Logu Gönder
                const logPayload = createContainerMessage(
                    'İtibar Puanı Eklendi',
                    `**Veren Üye:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n**Alan Üye:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n**Yeni Toplam Puan:** \`${newCount}\``,
                    COLORS.SUCCESS || '#57F287'
                );
                await sendLog(interaction.guild, logPayload, 'system').catch(() => {});
            } 
            
            // 2. İTİBAR GÖRÜNTÜLE (VIEW REP)
            else if (subcommand === 'goruntule') {
                const rows = await conn.query('SELECT COUNT(*) as repCount FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
                const count = Number(rows[0]?.repCount || 0);

                const desc = [
                    `**Kullanıcı:** <@${targetUser.id}> (\`${targetUser.username}\`)`,
                    `**Toplam İtibar:** \`${count} Puan\``,
                    ``,
                    `*İtibar puanları diğer üyelerin size duyduğu güveni temsil eder. Birine itibar vermek için:* \`/itibar ver kullanici:@uye\``
                ].join('\n');

                const payload = createContainerMessage(
                    `${targetUser.displayName || targetUser.username} - İtibar Profili`,
                    desc,
                    COLORS.PRIMARY || '#5865F2'
                );
                payload.flags = MessageFlags.IsComponentsV2;
                await interaction.editReply(payload);
            }

            // 3. İTİBAR LİDERLİK TABLOSU (TOP REPUTATION)
            else if (subcommand === 'top') {
                const topRows = await conn.query(`
                    SELECT user_id, COUNT(*) as repCount 
                    FROM reputation 
                    WHERE guild_id = ? 
                    GROUP BY user_id 
                    ORDER BY repCount DESC 
                    LIMIT 10
                `, [interaction.guild.id]);

                if (!topRows || topRows.length === 0) {
                    const emptyPayload = createContainerMessage(
                        'İtibar Liderlik Tablosu',
                        'Bu sunucuda henüz itibar puanı almış bir üye bulunmuyor.',
                        COLORS.PRIMARY || '#5865F2'
                    );
                    emptyPayload.flags = MessageFlags.IsComponentsV2;
                    return await interaction.editReply(emptyPayload);
                }

                const rankBadges = [
                    `<:mono:${MONO_EMOJIS.trophy || '1537767825937010708'}>`,
                    `<:mono:${MONO_EMOJIS.medal || '1537767798472704032'}>`,
                    `<:mono:${MONO_EMOJIS.award || '1537767883608957048'}>`
                ];

                const lines = topRows.map((row, idx) => {
                    const badge = rankBadges[idx] || `**[#${idx + 1}]**`;
                    return `${badge} <@${row.user_id}> — **${row.repCount} Puan**`;
                });

                const desc = [
                    `Sunucunun en yüksek güvenilirlik ve itibar puanına sahip ilk **${topRows.length}** üyesi:`,
                    ``,
                    lines.join('\n'),
                    ``,
                    `*Bir üyeye güveniyorsanız veya yardımı dokunduysa \`/itibar ver\` ile puan kazandırabilirsiniz.*`
                ].join('\n');

                const payload = createContainerMessage(
                    `${interaction.guild.name} - İtibar Sıralaması`,
                    desc,
                    COLORS.PRIMARY || '#5865F2'
                );
                payload.flags = MessageFlags.IsComponentsV2;
                await interaction.editReply(payload);
            }

        } catch (error) {
            console.error('[Itibar Error]:', error);
            const errPayload = createContainerMessage(
                'Hata',
                'İşlem sırasında bir hata oluştu.',
                COLORS.ERROR || '#ED4245'
            );
            errPayload.flags = MessageFlags.IsComponentsV2;
            await interaction.editReply(errPayload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
