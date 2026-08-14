const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('not')
        .setDescription('Moderatör notu sistemi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Bir kullanıcıya not ekler')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Not eklenecek kullanıcı').setRequired(true))
                .addStringOption(option => option.setName('not').setDescription('Eklenecek not').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listele')
                .setDescription('Kullanıcının notlarını listeler')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Notları listelenecek kullanıcı').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Bir notu siler')
                .addIntegerOption(option => option.setName('id').setDescription('Silinecek notun IDsi').setRequired(true))
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let conn;
        try {
            conn = await pool.getConnection();

            if (subCmd === 'ekle') {
                const targetUser = interaction.options.getUser('kullanıcı');
                const noteText = interaction.options.getString('not');

                await conn.query(
                    'INSERT INTO mod_notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)',
                    [interaction.guild.id, targetUser.id, interaction.user.id, noteText]
                );

                const payload = createContainerMessage(
                    'Not Eklendi',
                    `<@${targetUser.id}> kullanıcısına not eklendi.\n**Not:** ${noteText}`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

                const logPayload = createContainerMessage(
                    'Moderatör Notu Eklendi',
                    '',
                    '#2B2D31',
                    [],
                    [
                        { name: 'Kullanıcı', value: `<@${targetUser.id}> (${targetUser.tag || targetUser.username})`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Not', value: noteText, inline: false }
                    ]
                );
                if (typeof sendLog === 'function') {
                    await sendLog(interaction.guild, logPayload).catch(() => {});
                }
            } 
            else if (subCmd === 'listele') {
                const targetUser = interaction.options.getUser('kullanıcı');
                const rows = await conn.query(
                    'SELECT id, moderator_id, note, created_at FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY id DESC',
                    [interaction.guild.id, targetUser.id]
                );

                if (rows.length === 0) {
                    const payload = createContainerMessage(
                        'Notlar',
                        `<@${targetUser.id}> kullanıcısı için hiçbir not bulunamadı.`,
                        '#2B2D31'
                    );
                    return interaction.editReply(payload);
                }

                let page = 0;
                const itemsPerPage = 5;
                const totalPages = Math.ceil(rows.length / itemsPerPage);

                const generatePayload = (pageNum) => {
                    const start = pageNum * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageRows = rows.slice(start, end);

                    const fields = pageRows.map(r => ({
                        name: `ID: ${r.id} | Ekleyen: <@${r.moderator_id}>`,
                        value: `**Not:** ${r.note}\n**Tarih:** <t:${Math.floor(r.created_at.getTime() / 1000)}:f>`
                    }));

                    const actionRows = [];
                    if (totalPages > 1) {
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('Önceki')
                                .setEmoji(MONO_EMOJIS.chevron_left)
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageNum === 0),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Sonraki')
                                .setEmoji(MONO_EMOJIS.chevron_right)
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(pageNum === totalPages - 1)
                        );
                        actionRows.push(row);
                    }

                    return createContainerMessage(
                        'Kullanıcı Notları',
                        `<@${targetUser.id}> kullanıcısına ait notlar (Sayfa ${pageNum + 1}/${totalPages})`,
                        '#2B2D31',
                        actionRows,
                        fields
                    );
                };

                const msg = await interaction.editReply(generatePayload(page));

                if (totalPages > 1) {
                    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
                    collector.on('collect', async i => {
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({ content: 'Bu butonları sadece komutu kullanan kişi kullanabilir.', flags: MessageFlags.Ephemeral });
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
            else if (subCmd === 'sil') {
                const noteId = interaction.options.getInteger('id');
                const rows = await conn.query('SELECT moderator_id FROM mod_notes WHERE id = ? AND guild_id = ?', [noteId, interaction.guild.id]);

                if (rows.length === 0) {
                    const payload = createContainerMessage(
                        'Hata',
                        `Belirtilen ID'ye (${noteId}) sahip bir not bulunamadı.`,
                        '#2B2D31'
                    );
                    return interaction.editReply(payload);
                }

                const note = rows[0];
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                if (note.moderator_id !== interaction.user.id && !isAdmin) {
                    const payload = createContainerMessage(
                        'Yetkisiz İşlem',
                        'Sadece kendi eklediğiniz notları veya yöneticiyseniz diğer notları silebilirsiniz.',
                        '#2B2D31'
                    );
                    return interaction.editReply(payload);
                }

                await conn.query('DELETE FROM mod_notes WHERE id = ?', [noteId]);

                const payload = createContainerMessage(
                    'Not Silindi',
                    `ID'si ${noteId} olan not başarıyla silindi.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            }
        } catch (error) {
            console.error('Not komutu hatası:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
