const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban-list')
        .setDescription('Sunucudaki yasaklı kullanıcıları listeler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try { await interaction.deferReply(); } catch(e) { return; }
        let conn;
        try {
            conn = await pool.getConnection();
            const discordBans = await interaction.guild.bans.fetch().catch(() => new Map());
            const dbBans = await conn.query("SELECT * FROM mutes WHERE guild_id = ? AND action_type = 'ban' AND is_active = TRUE", [interaction.guild.id]);

            let banList = [];
            
            discordBans.forEach(ban => {
                banList.push({
                    user: ban.user,
                    reason: ban.reason || 'Sebep belirtilmedi',
                    type: 'discord'
                });
            });

            if (banList.length === 0 && dbBans.length === 0) {
                const emptyPayload = createContainerMessage(
                    `${EMOJIS.ban} Yasaklı Listesi`,
                    'Sunucuda yasaklı kullanıcı bulunmuyor.',
                    '#2B2D31'
                );
                return await interaction.editReply(emptyPayload).catch(() => {});
            }

            const maxPerPage = 10;
            const pages = Math.ceil(banList.length / maxPerPage) || 1;
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * maxPerPage;
                const currentItems = banList.slice(start, start + maxPerPage);
                
                let text = '';
                currentItems.forEach((item, index) => {
                    text += `**${start + index + 1}.** <@${item.user.id}> (${item.user.tag})\nSebep: ${item.reason}\n\n`;
                });

                return createContainerMessage(
                    `${EMOJIS.ban} Yasaklı Listesi (Sayfa ${page + 1}/${pages})`,
                    text || 'Liste boş.',
                    '#2B2D31'
                );
            };

            const getActionRow = (page) => {
                const row = new ActionRowBuilder();
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('Önceki')
                        .setEmoji(MONO_EMOJIS.chevron_left)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Sonraki')
                        .setEmoji(MONO_EMOJIS.chevron_right)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === pages - 1)
                );
                return row;
            };

            let currentPayload = generateEmbed(currentPage);
            if (pages > 1) {
                currentPayload.components = [getActionRow(currentPage)];
            }

            const message = await interaction.editReply(currentPayload).catch(() => null);
            if (!message) return;

            if (pages > 1) {
                const collector = message.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id,
                    componentType: ComponentType.Button,
                    time: 60000
                });

                collector.on('collect', async i => {
                    if (i.customId === 'prev_page') currentPage--;
                    else if (i.customId === 'next_page') currentPage++;

                    let newPayload = generateEmbed(currentPage);
                    newPayload.components = [getActionRow(currentPage)];
                    
                    await i.update(newPayload);
                });

                collector.on('end', () => {
                    interaction.editReply({ components: [] }).catch(() => {});
                });
            }
            
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
