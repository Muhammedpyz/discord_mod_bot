const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { pool, updateConfigCache } = require('../db');
const config = require('../config.json');
const { createContainerMessage, buildModBResponse, buildModAPanel } = require('../utils/uiBuilder');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.guildId && !(process.env.ALLOWED_GUILDS ? process.env.ALLOWED_GUILDS.split(',') : []).includes(interaction.guildId)) {
            const payload = buildModBResponse({
                title: 'Yetki Hatası',
                textLines: [`Bu komutu kullanmak için bu sunucuda yetkili olmanız gerekmektedir.\n\nEğer siz de böyle bir bota sahip olmak isterseniz sahibim **muhammedpyz_** ile iletişime geçebilirsiniz.`],
                color: COLORS.ERROR
            });
            if (interaction.isRepliable()) await interaction.reply(payload).catch(()=>{});
            return;
        }

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Komut hatası: ${interaction.commandName}`, error);
                let title = 'Hata';
                let desc = 'Bu komutu çalıştırırken bir hata oluştu.';
                if (error.message && error.message.includes('Missing Permissions')) {
                    title = 'Yetki Hatası';
                    desc = 'Botun bu işlemi gerçekleştirmek için yeterli yetkisi bulunmuyor.';
                }
                const payload = buildModBResponse({ title, textLines: [desc], color: COLORS.ERROR });
                if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
                else await interaction.reply(payload).catch(() => {});
            }
            return;
        }

        // --- STATELESS ROUTING ---
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isModalSubmit()) return;

        // Geçiş dönemi için (henüz tam namespace'e geçmemiş eskiler için fallback)
        let namespace, action, targetId;
        if (interaction.customId.includes(':')) {
            const parts = interaction.customId.split(':');
            namespace = parts[0];
            action = parts[1];
            targetId = parts.slice(2).join(':');
        } else {
            namespace = 'legacy';
            action = interaction.customId;
        }

        // TICKET NAMESPACE
        if (namespace === 'ticket' || action.startsWith('ticket_')) {
            const { createTicket, checkTicketLimits, closeTicketChannel } = require('../utils/ticketManager');
            
            if (action === 'create' || action === 'ticket_create_btn') {
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                if (!isAdmin) {
                    const { ticketsToday, cooldownRemaining } = await checkTicketLimits(interaction.guild.id, interaction.user.id);
                    if (ticketsToday >= 3) return interaction.reply({ content: 'Günlük ticket açma sınırınıza ulaştınız (Maksimum 3). Lütfen yarın tekrar deneyin.', ephemeral: true });
                    if (cooldownRemaining > 0) {
                        const minutes = Math.ceil(cooldownRemaining / (60 * 1000));
                        return interaction.reply({ content: `Yeni bir destek talebi açmadan önce **${minutes} dakika** daha beklemelisiniz.`, ephemeral: true });
                    }
                }
                const modal = new ModalBuilder().setCustomId('ticket:modal:submit').setTitle('Destek Talebi (Ticket)');
                const categoryInput = new TextInputBuilder().setCustomId('ticket_category_text').setLabel('Kategori (Örn: Hesap, Ceza, Sunucu)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Hesabım / Ceza / Sunucu Şikayeti vb.');
                const reasonInput = new TextInputBuilder().setCustomId('ticket_reason').setLabel('Talebinizin detayını yazın:').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Lütfen sorununuzu detaylı bir şekilde açıklayın...');
                modal.addComponents(new ActionRowBuilder().addComponents(categoryInput), new ActionRowBuilder().addComponents(reasonInput));
                return interaction.showModal(modal);
            }
            if (action === 'modal' || action.startsWith('ticket_modal')) {
                let categoryLabel = 'Genel Destek';
                try { categoryLabel = interaction.fields.getTextInputValue('ticket_category_text'); } catch(e){}
                const reason = interaction.fields.getTextInputValue('ticket_reason');
                return createTicket(interaction, reason, categoryLabel);
            }
            if (action === 'close' || action === 'ticket_close_btn') {
                return closeTicketChannel(interaction);
            }
        }

        // MOD NAMESPACE
        if (namespace === 'mod') {
            if (action === 'mute') {
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    await member.timeout(10 * 60 * 1000, 'Buton üzerinden hızlı mute');
                    await interaction.reply({ content: `<@${targetId}> kullanıcısı susturuldu.`, ephemeral: true });
                } catch (error) {
                    await interaction.reply({ content: `İşlem başarısız: Kullanıcı bulunamadı veya yetkim yetersiz.`, ephemeral: true });
                }
            } else if (action === 'ban') {
                try {
                    const member = await interaction.guild.members.fetch(targetId);
                    let conn;
                    try {
                        conn = await pool.getConnection();
                        const rows = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                        if (rows.length > 0 && rows[0].banned_role_id) {
                            await member.roles.add(rows[0].banned_role_id);
                            await interaction.reply({ content: `<@${targetId}> kullanıcısı yasaklandı.`, ephemeral: true });
                        } else {
                            await interaction.reply({ content: `Yasaklı rolü ayarlanmamış.`, ephemeral: true });
                        }
                    } finally { if (conn) conn.release(); }
                } catch (error) {
                    await interaction.reply({ content: `İşlem başarısız: Kullanıcı bulunamadı veya yetkim yetersiz.`, ephemeral: true });
                }
            } else if (action === 'ignore') {
                await interaction.message.delete().catch(() => {});
            }
        }

        // SORGU NAMESPACE
        if (namespace === 'sorgu') {
            const { handleSorguSelect, handleExport } = require('../utils/sorguHelpers');
            if (action === 'select') {
                return handleSorguSelect(interaction, interaction.values[0], targetId);
            }
            if (action.startsWith('export_')) {
                const exportType = action.replace('export_', '');
                return handleExport(interaction, exportType, targetId);
            }
            if (action === 'transcript_picker') {
                const rawTicketId = interaction.values[0].replace('sorgu:transcript:', '');
                const ticketId = parseInt(rawTicketId, 10);
                if (!ticketId || isNaN(ticketId)) return interaction.reply({ content: 'Geçersiz ticket numarası.', ephemeral: true });
                let conn;
                try {
                    conn = await pool.getConnection();
                    const rows = await conn.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
                    if (rows.length === 0) return interaction.reply({ content: 'Transcript bulunamadı.', ephemeral: true });
                    const ticket = rows[0];
                    const { generateDiscordTranscriptHtml, generateDiscordTranscriptText } = require('../utils/discordHtmlExporter');
                    const dbMsgs = await conn.query('SELECT * FROM ticket_messages WHERE channel_id = ? OR ticket_owner_id = ? ORDER BY created_at ASC', [ticket.channel_id, ticket.owner_id]);
                    const htmlContent = await generateDiscordTranscriptHtml({ guild: interaction.guild, channel: { name: `destek-${ticket.owner_tag || 'kullanici'}` }, messages: dbMsgs || [], ticketData: ticket });
                    const textContent = generateDiscordTranscriptText({ guild: interaction.guild, channel: { name: `destek-${ticket.owner_tag || 'kullanici'}` }, messages: dbMsgs || [], ticketData: ticket });
                    const channelSlug = ticket.owner_tag ? `destek-${ticket.owner_tag}` : 'destek';
                    const files = [
                        new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `ticket-#${ticket.id}-${channelSlug}.html` }),
                        new AttachmentBuilder(Buffer.from(textContent, 'utf-8'), { name: `ticket-#${ticket.id}-${channelSlug}.txt` })
                    ];
                    const msg = `**Ticket #${ticket.id}** ait HTML & Metin transcript dökümü aşağıdadır:`;
                    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, files, ephemeral: true });
                    else await interaction.reply({ content: msg, files, ephemeral: true });
                } catch (err) {
                    const msg = 'Transcript alınırken sistemsel bir hata oluştu.';
                    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true }).catch(()=>{});
                    else await interaction.reply({ content: msg, ephemeral: true }).catch(()=>{});
                } finally { if (conn) conn.release(); }
            }
        }

        // YARDIM / SETTINGS (Legacy fallback until settings is rewritten)
        if (action === 'help_category_select') {
            const val = interaction.values[0];
            const { helpEmbedHome, createHelpComponents } = require('../commands/moderation/yardim');
            if (val === 'help_home') return interaction.update(helpEmbedHome(interaction.guild, interaction.user, [createHelpComponents('home')]));
            
            const getCmd = (name) => {
                const cmd = interaction.client.application.commands.cache.find(c => c.name === name);
                return cmd ? `</${name}:${cmd.id}>` : `\`/${name}\``;
            };

            const getHelpPayload = (title, lines, fields, selected) => {
                const { buildModAPanel } = require('../utils/uiBuilder');
                return buildModAPanel({ 
                    title, 
                    description: lines.join('\n\n') + '\n\n' + fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n'), 
                    navRow: createHelpComponents(selected),
                    showSocials: false 
                });
            };
            
            if (val === 'help_moderation') return interaction.update(getHelpPayload('Moderasyon Komutları', ['Sunucudaki yetkililerin kullanabileceği gelişmiş ceza ve düzen komutları:'], [{ name: 'Ceza Komutları', value: `${getCmd('ban')}, ${getCmd('unban')}, ${getCmd('kick')}, ${getCmd('mute')}, ${getCmd('unmute')}, ${getCmd('sesmute')}` }, { name: 'Uyarı & Sicil Komutları', value: `${getCmd('sorgu')}, ${getCmd('warn')}, ${getCmd('warnings')}, ${getCmd('resetwarns')}` }, { name: 'Kanal Yönetim', value: `${getCmd('clear')}, ${getCmd('lockdown')}, ${getCmd('slowmode')}` }], 'moderation'));
            if (val === 'help_system') return interaction.update(getHelpPayload('Sistem & Yapılandırma', ['Botun yapılandırma, filtre ve takip komutları:'], [{ name: getCmd('ayarlar'), value: 'Gelişmiş arayüz.' }, { name: getCmd('kara-liste'), value: 'Yasaklı kelime filtresi.' }, { name: getCmd('snipe'), value: 'Silinen mesajı geri getirir.' }, { name: getCmd('ticket'), value: 'Destek sistemini yapılandırır/yönetir.' }], 'system'));
            if (val === 'help_security') return interaction.update(getHelpPayload('Otomatik Güvenlik', ['Botun sunucunuzda 7/24 arka planda otomatik çalıştırdığı zırhlar (Ayarlar menüsünden yönetilir):'], [{ name: 'Anti-Spam & Mass Mention', value: 'Spam yapanları susturur.' }, { name: 'Anti-Link & Reklam', value: 'İzinsiz linkleri siler.' }, { name: 'Anti-Küfür & Zalgo', value: 'Yasaklı kelimeleri siler.' }, { name: 'Caps Lock Filtresi', value: '%65 büyük harf engeli.' }, { name: 'Anti-Raid & Mass-Ban', value: 'Saldırıları durdurur.' }], 'security'));
        }

        if (action.startsWith('toggle_')) {
            if (!interaction.member.permissions.has('Administrator') && !require('../../utils/systemNode').checkSystemNode(interaction.user.id)) return interaction.reply({ content: 'Yönetici izniniz yok.', ephemeral: true });
            try { await interaction.deferUpdate(); } catch (e) { return; }
            let conn;
            try {
                conn = await pool.getConnection();
                let field = '';
                if (action === 'toggle_anti_spam') field = 'anti_spam_enabled';
                if (action === 'toggle_anti_link') field = 'anti_link_enabled';
                if (action === 'toggle_anti_swear') field = 'anti_swear_enabled';
                if (action === 'toggle_caps') field = 'caps_filter_enabled';
                if (action === 'toggle_anti_raid') field = 'anti_raid_enabled';
                
                if (field) {
                    const rows = await conn.query(`SELECT ${field} FROM guild_config WHERE guild_id = ?`, [interaction.guild.id]);
                    let newValue = true;
                    if (rows.length > 0) { newValue = !rows[0][field]; await conn.query(`UPDATE guild_config SET ${field} = ? WHERE guild_id = ?`, [newValue, interaction.guild.id]); } 
                    else { newValue = false; await conn.query(`INSERT INTO guild_config (guild_id, ${field}) VALUES (?, ?)`, [interaction.guild.id, newValue]); }
                    updateConfigCache(interaction.guild.id, field, newValue);
                    const { getSettingsPage } = require('../commands/moderation/settings');
                    const pageData = await getSettingsPage(interaction.guild.id, 'page_filters');
                    if (pageData) await interaction.editReply(pageData);
                    await interaction.followUp({ content: `Ayar güncellendi: ${field} = ${newValue ? 'Açık' : 'Kapalı'}`, ephemeral: true });
                }
            } finally { if (conn) conn.release(); }
        }

        if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || action === 'settings_menu') {
            const { handleSettingsSelect } = require('../commands/moderation/settings');
            if (handleSettingsSelect) {
                return handleSettingsSelect(interaction);
            }
        }
    }
};
