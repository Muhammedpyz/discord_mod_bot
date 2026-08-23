'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('not')
        .setDescription('Moderatör kullanıcı notları sistemi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Bir kullanıcıya moderatör notu ekler')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Not eklenecek kullanıcı').setRequired(true))
                .addStringOption(option => option.setName('not').setDescription('Eklenecek not içeriği').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listele')
                .setDescription('Kullanıcının geçmiş tüm notlarını listeler')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Notları listelenecek kullanıcı').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Belirli bir ID numaralı notu siler')
                .addIntegerOption(option => option.setName('id').setDescription('Silinecek notun IDsi').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('temizle')
                .setDescription('Bir kullanıcının tüm moderatör notlarını sıfırlar (Yönetici)')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Tüm notları silinecek kullanıcı').setRequired(true))
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let conn;
        try {
            conn = await pool.getConnection();

            // 1. NOT EKLE
            if (subCmd === 'ekle') {
                const targetUser = interaction.options.getUser('kullanıcı');
                const noteText = interaction.options.getString('not');

                const res = await conn.query(
                    'INSERT INTO mod_notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)',
                    [interaction.guild.id, targetUser.id, interaction.user.id, noteText]
                );

                const payload = createContainerMessage(
                    'Moderatör Notu Eklendi',
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> <@${targetUser.id}> kullanıcısına not kaydedildi.\n\n> • **Not ID:** \`#${res.insertId}\`\n> • **İçerik:** ${noteText}`,
                    COLORS.SUCCESS || '#57F287'
                );
                payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Moderatör Notu Eklendi',
                    `**Hedef Kullanıcı:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\n**Yetkili:** <@${interaction.user.id}>\n**Not:** ${noteText}`,
                    COLORS.PRIMARY || '#5865F2'
                );
                await sendLog(interaction.guild, logPayload, 'mod').catch(() => {});
            } 

            // 2. NOT LİSTELE
            else if (subCmd === 'listele') {
                const targetUser = interaction.options.getUser('kullanıcı');
                const rows = await conn.query(
                    'SELECT id, moderator_id, note, created_at FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC',
                    [interaction.guild.id, targetUser.id]
                );

                if (rows.length === 0) {
                    const payload = createContainerMessage(
                        'Not Bulunamadı',
                        `<@${targetUser.id}> kullanıcısı için kaydedilmiş hiçbir moderatör notu bulunmuyor.`,
                        COLORS.PRIMARY || '#5865F2'
                    );
                    payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return interaction.editReply(payload);
                }

                let page = 0;
                const itemsPerPage = 5;
                const totalPages = Math.ceil(rows.length / itemsPerPage);

                const generatePayload = (pageNum) => {
                    const start = pageNum * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageRows = rows.slice(start, end);

                    const lines = pageRows.map(r => {
                        const timeSec = Math.floor(new Date(r.created_at).getTime() / 1000);
                        const timeTag = isNaN(timeSec) ? '' : `<t:${timeSec}:f> (<t:${timeSec}:R>)`;
                        return [
                            `**[#${r.id}] Ekleyen:** <@${r.moderator_id}> • ${timeTag}`,
                            `> ${r.note}`
                        ].join('\n');
                    });

                    const actionRows = [];
                    if (totalPages > 1) {
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('Önceki')
                                .setEmoji(MONO_EMOJIS.chevron_left || '1530918962890670161')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageNum === 0),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Sonraki')
                                .setEmoji(MONO_EMOJIS.chevron_right || '1530918964593557554')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageNum === totalPages - 1)
                        );
                        actionRows.push(row);
                    }

                    const container = createContainerMessage(
                        `Kullanıcı Notları (${rows.length} Not | Sayfa ${pageNum + 1}/${totalPages})`,
                        `<@${targetUser.id}> kullanıcısına ait kayıtlar:\n\n${lines.join('\n\n')}`,
                        COLORS.PRIMARY || '#5865F2',
                        actionRows
                    );
                    container.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return container;
                };

                const msg = await interaction.editReply(generatePayload(page));

                if (totalPages > 1) {
                    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
                    collector.on('collect', async i => {
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({ content: 'Bu butonları sadece komutu kullanan yetkili kullanabilir.', flags: MessageFlags.Ephemeral });
                        }
                        if (i.customId === 'prev_page') {
                            page--;
                        } else if (i.customId === 'next_page') {
                            page++;
                        }
                        await i.update(generatePayload(page));
                    });
                    collector.on('end', () => {
                        msg.edit({ components: [] }).catch(() => {});
                    });
                }
            }

            // 3. TEKİL NOT SİL
            else if (subCmd === 'sil') {
                const noteId = interaction.options.getInteger('id');
                const rows = await conn.query('SELECT moderator_id, note, user_id FROM mod_notes WHERE id = ? AND guild_id = ?', [noteId, interaction.guild.id]);

                if (rows.length === 0) {
                    const payload = createContainerMessage(
                        'Hata',
                        `Belirtilen ID'ye (\`#${noteId}\`) sahip bir moderatör notu bulunamadı.`,
                        COLORS.ERROR || '#ED4245'
                    );
                    payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return interaction.editReply(payload);
                }

                const note = rows[0];
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                if (note.moderator_id !== interaction.user.id && !isAdmin) {
                    const payload = createContainerMessage(
                        'Yetkisiz İşlem',
                        'Sadece kendi eklediğiniz notları silebilirsiniz. (Yöneticiler tüm notları silebilir)',
                        COLORS.ERROR || '#ED4245'
                    );
                    payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return interaction.editReply(payload);
                }

                await conn.query('DELETE FROM mod_notes WHERE id = ?', [noteId]);

                const payload = createContainerMessage(
                    'Not Silindi',
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> \`#${noteId}\` ID'li moderatör notu başarıyla silindi.`,
                    COLORS.SUCCESS || '#57F287'
                );
                payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Moderatör Notu Silindi',
                    `**Silen Yetkili:** <@${interaction.user.id}>\n**Not Sahibi Üye:** <@${note.user_id}>\n**Silinen Not ID:** \`#${noteId}\``,
                    COLORS.WARNING || '#FEE75C'
                );
                await sendLog(interaction.guild, logPayload, 'mod').catch(() => {});
            }

            // 4. TÜM NOTLARI TEMİZLE (ADMIN ONLY)
            else if (subCmd === 'temizle') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    const noPerm = createContainerMessage(
                        'Yetkisiz İşlem',
                        'Tüm notları temizlemek için **Yönetici** yetkisine sahip olmalısınız.',
                        COLORS.ERROR || '#ED4245'
                    );
                    noPerm.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return await interaction.editReply(noPerm);
                }

                const targetUser = interaction.options.getUser('kullanıcı');
                const delRes = await conn.query('DELETE FROM mod_notes WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
                const count = delRes.affectedRows || 0;

                const payload = createContainerMessage(
                    'Notlar Temizlendi',
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> <@${targetUser.id}> kullanıcısına ait toplam **${count}** moderatör notu kalıcı olarak silindi.`,
                    COLORS.SUCCESS || '#57F287'
                );
                payload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Kullanıcı Notları Sıfırlandı',
                    `**Temizleyen Yönetici:** <@${interaction.user.id}>\n**Kullanıcı:** <@${targetUser.id}>\n**Silinen Not Sayısı:** \`${count} Adet\``,
                    COLORS.WARNING || '#FEE75C'
                );
                await sendLog(interaction.guild, logPayload, 'mod').catch(() => {});
            }

        } catch (error) {
            console.error('[Not Command Error]:', error);
            const errPayload = createContainerMessage(
                'Hata',
                'İşlem sırasında bir hata oluştu.',
                COLORS.ERROR || '#ED4245'
            );
            errPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.editReply(errPayload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
