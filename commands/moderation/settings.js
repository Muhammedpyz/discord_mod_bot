const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const { pool } = require('../../db');

async function getSettingsPage(guildId, pageName) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
        
        let config = {
            anti_spam_enabled: 1,
            anti_link_enabled: 1,
            anti_swear_enabled: 1,
            caps_filter_enabled: 1,
            anti_raid_enabled: 1,
            warn1_role_id: null,
            warn2_role_id: null,
            banned_role_id: null,
            text_mute_role_id: null,
            voice_mute_role_id: null,
            welcome_channel_id: null,
            goodbye_channel_id: null,
            autorole_id: null,
            ticket_channel_id: null,
            ticket_role_id: null,
            ticket_category_id: null,
            log_channel_id: null,
            log_voice_channel_id: null,
            log_ticket_channel_id: null,
            log_system_channel_id: null
        };

        if (rows.length > 0) config = rows[0];

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('settings:settings_menu')
                .setPlaceholder('Kategori Seçin')
                .addOptions([
                    { label: 'Giriş', description: 'Ayarlar paneli ana sayfası', value: 'page_home', default: pageName === 'page_home' },
                    { label: 'Filtre ve Korumalar', description: 'Spam, link, küfür ayarları', value: 'page_filters', default: pageName === 'page_filters' },
                    { label: 'Sistem Rolleri', description: 'Otorol, Uyarı ve Ban rolleri', value: 'page_roles', default: pageName === 'page_roles' },
                    { label: 'Mute Rolleri', description: 'Metin ve Ses mute rolleri', value: 'page_mute_roles', default: pageName === 'page_mute_roles' },
                    { label: 'Ticket Sistemi', description: 'Destek talebi ayarları', value: 'page_ticket', default: pageName === 'page_ticket' },
                    { label: 'Kanallar', description: 'Giriş-Çıkış kanalları', value: 'page_channels', default: pageName === 'page_channels' },
                    { label: 'Log Kanalları', description: 'Detaylı log kanalları (Ses, Ticket, vb.)', value: 'page_logs', default: pageName === 'page_logs' },
                    { label: 'Özel Odalar', description: 'Özel oda sistemi ayarları', value: 'page_rooms', default: pageName === 'page_rooms' }
                ])
        );

        let title = '';
        let description = '';
        let fields = [];
        let components = [];

        if (pageName === 'page_home') {
            title = 'Yönetim Paneli';
            description = 'Sunucu ayarları ve güvenlik sistemleri paneline hoş geldiniz.\n\nLütfen yukarıdaki menüyü kullanarak yapılandırmak istediğiniz kategoriyi seçin.\n\n*Yaptığınız değişiklikler anında kaydedilecek ve aktif olacaktır.*';
        }
        else if (pageName === 'page_filters') {
            title = 'Sunucu Ayarları | Filtreler';
            description = 'Aşağıdaki butonları kullanarak otomatik denetim sistemlerini yönetebilirsiniz.';
            fields = [
                { name: 'Anti Spam', value: config.anti_spam_enabled ? 'Açık' : 'Kapalı' },
                { name: 'Anti Link', value: config.anti_link_enabled ? 'Açık' : 'Kapalı' },
                { name: 'Küfür Filtresi', value: config.anti_swear_enabled ? 'Açık' : 'Kapalı' },
                { name: 'Caps Lock Engel', value: config.caps_filter_enabled ? 'Açık' : 'Kapalı' },
                { name: 'Anti Raid', value: config.anti_raid_enabled ? 'Açık' : 'Kapalı' }
            ];

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_anti_spam').setLabel('Anti-Spam').setStyle(config.anti_spam_enabled ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('toggle_anti_link').setLabel('Anti-Link').setStyle(config.anti_link_enabled ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('toggle_anti_swear').setLabel('Anti-Küfür').setStyle(config.anti_swear_enabled ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('toggle_caps').setLabel('Caps Engel').setStyle(config.caps_filter_enabled ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('toggle_anti_raid').setLabel('Anti-Raid').setStyle(config.anti_raid_enabled ? ButtonStyle.Success : ButtonStyle.Danger)
            );
            components.push(buttonRow);
        } 
        else if (pageName === 'page_roles') {
            title = 'Sunucu Ayarları | Sistem Rolleri';
            description = 'Otomatik ceza ve otorol sisteminin kullanacağı rolleri seçin.';
            fields = [
                { name: 'Otorol (Yeni Üye)', value: config.autorole_id ? `<@&${config.autorole_id}>` : 'Ayarlanmadı' },
                { name: '1. Uyarı Rolü', value: config.warn1_role_id ? `<@&${config.warn1_role_id}>` : 'Ayarlanmadı' },
                { name: '2. Uyarı Rolü', value: config.warn2_role_id ? `<@&${config.warn2_role_id}>` : 'Ayarlanmadı' },
                { name: '3. Uyarı (Banlısın)', value: config.banned_role_id ? `<@&${config.banned_role_id}>` : 'Ayarlanmadı' }
            ];

            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder(config.autorole_id ? 'Otorol Ayarlandı' : 'Otorol (Yeni Üye) Seçin')
            ));
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('select_warn1_role').setPlaceholder(config.warn1_role_id ? '1. Uyarı Rolü Ayarlandı' : '1. Uyarı Rolünü Seçin')
            ));
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('select_warn2_role').setPlaceholder(config.warn2_role_id ? '2. Uyarı Rolü Ayarlandı' : '2. Uyarı Rolünü Seçin')
            ));
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('select_banned_role').setPlaceholder(config.banned_role_id ? 'Banlısın Rolü Ayarlandı' : 'Banlısın Rolünü Seçin')
            ));
        }
        else if (pageName === 'page_mute_roles') {
            title = 'Sunucu Ayarları | Mute Rolleri';
            description = 'Susturma cezası verildiğinde kullanıcılara atanacak rolleri belirleyin.';
            fields = [
                { name: 'Metin Mute Rolü', value: config.text_mute_role_id ? `<@&${config.text_mute_role_id}>` : 'Ayarlanmadı' },
                { name: 'Ses Mute Rolü', value: config.voice_mute_role_id ? `<@&${config.voice_mute_role_id}>` : 'Ayarlanmadı' }
            ];

            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('select_text_mute_role').setPlaceholder(config.text_mute_role_id ? 'Metin Mute Rolü Ayarlandı' : 'Metin Mute Rolünü Seçin')
            ));
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('select_voice_mute_role').setPlaceholder(config.voice_mute_role_id ? 'Ses Mute Rolü Ayarlandı' : 'Ses Mute Rolünü Seçin')
            ));
        }
        else if (pageName === 'page_ticket') {
            let displayRoles = 'Ayarlanmadı';
            if (config.ticket_role_id) {
                const roleIds = config.ticket_role_id.split(',');
                displayRoles = roleIds.map(id => `<@&${id}>`).join(', ');
            }

            title = 'Sunucu Ayarları | Destek (Ticket) Sistemi';
            description = 'Kullanıcıların destek talebi açabileceği kanalı ve yetkili rollerini yapılandırın.';
            fields = [
                { name: 'Ticket Kanalı', value: config.ticket_channel_id ? `<#${config.ticket_channel_id}>` : 'Ayarlanmadı' },
                { name: 'Ticket Kategorisi', value: config.ticket_category_id ? `<#${config.ticket_category_id}>` : 'Ayarlanmadı' },
                { name: 'Yetkili Rolleri', value: displayRoles }
            ];

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_ticket_channel')
                    .setPlaceholder(config.ticket_channel_id ? 'Ticket Kanalı Ayarlandı' : 'Ticket Butonu Hangi Kanala Atılsın?')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_ticket_category')
                    .setPlaceholder(config.ticket_category_id ? 'Ticket Kategorisi Ayarlandı' : 'Açılan Biletler Hangi Kategoride Toplansın?')
                    .addChannelTypes(ChannelType.GuildCategory)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_log_ticket_channel')
                    .setPlaceholder(config.log_ticket_channel_id ? 'Ticket Log Kanalı Ayarlandı' : 'Ticket Log Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('settings:auto_setup_ticket').setLabel('Sıfırdan Ticket Sistemi Kur').setStyle(ButtonStyle.Success)
            ));
            
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_ticket_role')
                    .setPlaceholder(config.ticket_role_id ? 'Yetkili Rolleri Ayarlandı' : 'İlgilenecek Yetkili Rol(ler)ini Seçin')
                    .setMinValues(1)
                    .setMaxValues(5)
            ));
        }
        else if (pageName === 'page_channels') {
            title = 'Sunucu Ayarları | Kanallar';
            description = '';
            fields = [
                { name: 'Hoşgeldin Kanalı', value: config.welcome_channel_id ? `<#${config.welcome_channel_id}>` : 'Ayarlanmadı' },
                { name: 'Görüşürüz Kanalı', value: config.goodbye_channel_id ? `<#${config.goodbye_channel_id}>` : 'Ayarlanmadı' }
            ];

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_welcome_channel')
                    .setPlaceholder(config.welcome_channel_id ? 'Hoşgeldin Kanalı Ayarlandı' : 'Hoşgeldin Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_goodbye_channel')
                    .setPlaceholder(config.goodbye_channel_id ? 'Görüşürüz Kanalı Ayarlandı' : 'Görüşürüz Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));
        }
        else if (pageName === 'page_logs') {
            title = 'Sunucu Ayarları | Log Kanalları';
            description = 'Botun tuttuğu kayıtların (logların) gönderileceği kanalları yapılandırın.\n*Belirli bir işlem için özel kanal ayarlanmazsa, sistem otomatik olarak **Genel (Metin) Log Kanalı**na gönderir.*';
            fields = [
                { name: 'Genel (Metin) Log Kanalı', value: config.log_channel_id ? `<#${config.log_channel_id}>` : 'Ayarlanmadı' },
                { name: 'Ses Log Kanalı', value: config.log_voice_channel_id ? `<#${config.log_voice_channel_id}>` : 'Ayarlanmadı' },
                { name: 'Ticket Log Kanalı', value: config.log_ticket_channel_id ? `<#${config.log_ticket_channel_id}>` : 'Ayarlanmadı' },
                { name: 'Sistem Log Kanalı', value: config.log_system_channel_id ? `<#${config.log_system_channel_id}>` : 'Ayarlanmadı' }
            ];

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_log_channel')
                    .setPlaceholder(config.log_channel_id ? 'Genel Log Kanalı Ayarlandı' : 'Genel Log Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_log_voice_channel')
                    .setPlaceholder(config.log_voice_channel_id ? 'Ses Log Kanalı Ayarlandı' : 'Ses Log Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_log_ticket_channel')
                    .setPlaceholder(config.log_ticket_channel_id ? 'Ticket Log Kanalı Ayarlandı' : 'Ticket Log Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_log_system_channel')
                    .setPlaceholder(config.log_system_channel_id ? 'Sistem Log Kanalı Ayarlandı' : 'Sistem Log Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));
        }
        else if (pageName === 'page_rooms') {
            const { getGuildSetup } = require('../../db');
            const setupInfo = await getGuildSetup(guildId);
            
            title = 'Sunucu Ayarları | Özel Odalar';
            description = 'Özel oda sistemini aşağıdan manuel olarak yapılandırabilir veya her şeyi tek tuşla kurması için **Sistemi Otomatik Kur** butonuna tıklayabilirsiniz.\n\n*Eğer hem Sesli hem de Metin oluşturma kanallarını ayarlarsanız, sistem Karma olarak çalışır.*';
            
            let catStr = (setupInfo && setupInfo.active_rooms_category_id) ? `<#${setupInfo.active_rooms_category_id}>` : 'Ayarlanmadı';
            let txtStr = (setupInfo && setupInfo.setup_channel_id) ? `<#${setupInfo.setup_channel_id}>` : 'Ayarlanmadı';
            let vocStr = (setupInfo && setupInfo.setup_voice_channel_id) ? `<#${setupInfo.setup_voice_channel_id}>` : 'Ayarlanmadı';
            let logStr = (setupInfo && setupInfo.log_channel_id) ? `<#${setupInfo.log_channel_id}>` : 'Ayarlanmadı';

            fields = [
                { name: 'Oda Kategorisi', value: catStr },
                { name: 'Oluşturma (Metin)', value: txtStr },
                { name: 'Katıl-Oluştur (Ses)', value: vocStr },
                { name: 'Oda Log Kanalı', value: logStr }
            ];

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_room_category')
                    .setPlaceholder((setupInfo && setupInfo.active_rooms_category_id) ? 'Kategori Ayarlandı' : 'Özel Odalar Kategorisini Seçin')
                    .addChannelTypes(ChannelType.GuildCategory)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_room_text_channel')
                    .setPlaceholder((setupInfo && setupInfo.setup_channel_id) ? 'Metin Kanalı Ayarlandı' : 'Oda Kurulum (Metin) Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_room_voice_channel')
                    .setPlaceholder((setupInfo && setupInfo.setup_voice_channel_id) ? 'Ses Kanalı Ayarlandı' : 'Katıl-Oluştur (Ses) Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildVoice)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_room_log_channel')
                    .setPlaceholder((setupInfo && setupInfo.log_channel_id) ? 'Oda Log Kanalı Ayarlandı' : 'Oda Log Kanalını Seçin')
                    .addChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_private_rooms').setLabel('Sistemi Otomatik Kur (Sıfırdan)').setStyle(ButtonStyle.Success)
            ));
        }

        if (fields.length > 0) {
            description += '\n\n' + fields.map(f => `**${f.name}:** ${f.value}`).join('\n');
        }

        const { buildModAPanel } = require('../../utils/uiBuilder');
        return buildModAPanel({
            title,
            description,
            actionRows: components,
            navRow: menuRow,
            showSocials: pageName === 'page_home'
        });
    } catch (err) {
        console.error(err);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayarlar')
        .setDescription('Sunucu koruma ayarlarını açıp kapatın.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    getSettingsPage,

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const pageData = await getSettingsPage(interaction.guild.id, 'page_home');
        
        if (pageData) {
            await interaction.editReply(pageData);
        } else {
            await interaction.editReply({ content: 'Ayarlar getirilirken hata oluştu.' });
        }
    },

    async handleSettingsSelect(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !require('../../utils/systemNode').checkSystemNode(interaction.user.id)) {
            return interaction.reply({ content: 'Yönetici yetkiniz yok.', ephemeral: true });
        }
        try { await interaction.deferUpdate(); } catch (e) { return; }

        if (interaction.customId === 'settings_menu' || interaction.customId === 'settings:settings_menu') {
            const selectedPage = interaction.values[0];
            const pageData = await getSettingsPage(interaction.guild.id, selectedPage);
            if (pageData) await interaction.editReply(pageData).catch(() => {});
            return;
        }

        let conn;
        try {
            conn = await pool.getConnection();
            const { updateConfigCache } = require('../../db');
            
            if (interaction.isRoleSelectMenu()) {
                const selectedRoleId = interaction.values.join(',');
                let column = '';
                if (interaction.customId.includes('select_autorole')) column = 'autorole_id';
                if (interaction.customId.includes('select_banned_role')) column = 'banned_role_id';
                if (interaction.customId.includes('select_warn1_role')) column = 'warn1_role_id';
                if (interaction.customId.includes('select_warn2_role')) column = 'warn2_role_id';
                if (interaction.customId.includes('select_text_mute_role')) column = 'text_mute_role_id';
                if (interaction.customId.includes('select_voice_mute_role')) column = 'voice_mute_role_id';
                if (interaction.customId.includes('select_ticket_role')) column = 'ticket_role_id';

                if (column) {
                    const rows = await conn.query('SELECT guild_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                    if (rows.length === 0) await conn.query(`INSERT INTO guild_config (guild_id, ${column}) VALUES (?, ?)`, [interaction.guild.id, selectedRoleId]);
                    else await conn.query(`UPDATE guild_config SET ${column} = ? WHERE guild_id = ?`, [selectedRoleId, interaction.guild.id]);
                    updateConfigCache(interaction.guild.id, column, selectedRoleId);

                    const selectMenu = interaction.message.components.flatMap(row => row.components).find(c => c.customId === 'settings_menu' || c.customId === 'settings:settings_menu');
                    const pageName = selectMenu?.options?.find(o => o.default)?.value || 'page_filters';
                    const pageData = await getSettingsPage(interaction.guild.id, pageName);
                    if (pageData) await interaction.editReply(pageData).catch(() => {});
                    
                    const roleMentions = selectedRoleId.split(',').map(id => `<@&${id}>`).join(' ');
                    await interaction.followUp({ content: `Rol başarıyla güncellendi: ${roleMentions}`, ephemeral: true }).catch(() => {});
                }
            } else if (interaction.isChannelSelectMenu()) {
                const selectedChannelId = interaction.values[0];
                let column = '';
                if (interaction.customId === 'select_welcome_channel') column = 'welcome_channel_id';
                if (interaction.customId === 'select_goodbye_channel') column = 'goodbye_channel_id';
                if (interaction.customId === 'select_log_channel') column = 'log_channel_id';
                if (interaction.customId === 'select_log_voice_channel') column = 'log_voice_channel_id';
                if (interaction.customId === 'select_log_ticket_channel') column = 'log_ticket_channel_id';
                if (interaction.customId === 'select_log_system_channel') column = 'log_system_channel_id';
                if (interaction.customId === 'select_ticket_channel') column = 'ticket_channel_id';
                if (interaction.customId === 'select_ticket_category') column = 'ticket_category_id';
                
                if (interaction.customId === 'select_room_log_channel' || interaction.customId === 'select_room_category' || interaction.customId === 'select_room_text_channel' || interaction.customId === 'select_room_voice_channel') {
                    const { updateGuildSetupCache } = require('../../db');
                    const rows = await conn.query('SELECT guild_id FROM guild_setup WHERE guild_id = ?', [interaction.guild.id]);
                    
                    let updateCol = '';
                    if (interaction.customId === 'select_room_log_channel') updateCol = 'log_channel_id';
                    else if (interaction.customId === 'select_room_category') updateCol = 'active_rooms_category_id';
                    else if (interaction.customId === 'select_room_text_channel') updateCol = 'setup_channel_id';
                    else if (interaction.customId === 'select_room_voice_channel') updateCol = 'setup_voice_channel_id';

                    if (rows.length > 0) {
                        await conn.query(`UPDATE guild_setup SET ${updateCol} = ? WHERE guild_id = ?`, [selectedChannelId, interaction.guild.id]);
                    } else {
                        await conn.query(`INSERT INTO guild_setup (guild_id, ${updateCol}) VALUES (?, ?)`, [interaction.guild.id, selectedChannelId]);
                    }
                    const updatedSetup = await conn.query('SELECT * FROM guild_setup WHERE guild_id = ?', [interaction.guild.id]);
                    if (updatedSetup.length > 0) updateGuildSetupCache(interaction.guild.id, updatedSetup[0]);
                    
                    const pageData = await getSettingsPage(interaction.guild.id, 'page_rooms');
                    if (pageData) await interaction.editReply(pageData);
                    await interaction.followUp({ content: `Ayar başarıyla güncellendi: <#${selectedChannelId}>`, ephemeral: true });
                    return;
                }

                if (column) {
                    const rows = await conn.query('SELECT guild_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                    if (rows.length === 0) await conn.query(`INSERT INTO guild_config (guild_id, ${column}) VALUES (?, ?)`, [interaction.guild.id, selectedChannelId]);
                    else await conn.query(`UPDATE guild_config SET ${column} = ? WHERE guild_id = ?`, [selectedChannelId, interaction.guild.id]);
                    updateConfigCache(interaction.guild.id, column, selectedChannelId);

                    if (column === 'ticket_channel_id') {
                        const ticketChannel = interaction.guild.channels.cache.get(selectedChannelId);
                        if (ticketChannel) {
                            const { buildModAPanel } = require('../../utils/uiBuilder');
                            const btnRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('ticket:create:1').setLabel('Bilet Oluştur').setStyle(ButtonStyle.Primary)
                            );
                            const uiPayload = buildModAPanel({
                                title: 'Destek Talebi (Ticket)',
                                description: 'Bir sorununuz mu var veya bir cezaya itiraz mı etmek istiyorsunuz?\nAşağıdaki "Bilet Oluştur" butonuna tıklayarak yetkililerle özel bir kanal üzerinden iletişime geçebilirsiniz.\n\n_Gereksiz bilet açanlar cezalandırılabilir._',
                                actionRows: [btnRow]
                            });
                            await ticketChannel.send(uiPayload).catch(() => {});
                        }
                    }

                    const selectMenu = interaction.message.components.flatMap(row => row.components).find(c => c.customId === 'settings_menu' || c.customId === 'settings:settings_menu');
                    const pageName = selectMenu?.options?.find(o => o.default)?.value || 'page_filters';
                    const pageData = await getSettingsPage(interaction.guild.id, pageName);
                    if (pageData) await interaction.editReply(pageData).catch(() => {});
                    
                    await interaction.followUp({ content: `Kanal başarıyla güncellendi: <#${selectedChannelId}>`, ephemeral: true }).catch(() => {});
                }
            } else if (interaction.isButton()) {
                const action = interaction.customId.replace('settings:', '');
                if (action === 'auto_setup_ticket') {
                    const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    const { buildModBResponse, COLORS } = require('../../utils/uiBuilder');
                    
                    let ticketCat = await interaction.guild.channels.create({
                        name: 'DESTEK TALEPLERI',
                        type: ChannelType.GuildCategory,
                        permissionOverwrites: [{ id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel] }]
                    }).catch(()=>null);
                    
                    if (ticketCat) {
                        let ticketChannel = await interaction.guild.channels.create({
                            name: 'ticket-olustur',
                            type: ChannelType.GuildText,
                            parent: ticketCat.id,
                            permissionOverwrites: [
                                { id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }
                            ]
                        }).catch(()=>null);
                        
                        if (ticketChannel) {
                            const { updateConfigCache } = require('../../db');
                            await conn.query('UPDATE guild_config SET ticket_category_id = ?, ticket_channel_id = ? WHERE guild_id = ?', [ticketCat.id, ticketChannel.id, interaction.guild.id]);
                            updateConfigCache(interaction.guild.id, 'ticket_category_id', ticketCat.id);
                            updateConfigCache(interaction.guild.id, 'ticket_channel_id', ticketChannel.id);
                            
                            const uiPayload = buildModBResponse({
                                title: 'Destek Talebi Sistemi',
                                textLines: [''],
                                fields: [],
                                description: 'Bir sorununuz mu var veya bir cezaya itiraz etmek mi istiyorsunuz?\n\nAşağıdaki butona tıklayarak açılan pencereye sorun başlığınızı ve açıklamanızı yazıp destek ekibimizle anında iletişime geçebilirsiniz.',
                                color: COLORS.INFO
                            });
                            
                            uiPayload.components = [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('ticket:create:1').setLabel('Bilet Oluştur').setStyle(ButtonStyle.Primary)
                                )
                            ];
                            
                            await ticketChannel.send(uiPayload).catch(() => {});
                            
                            const pageData = await getSettingsPage(interaction.guild.id, 'page_ticket');
                            if (pageData) await interaction.editReply(pageData).catch(() => {});
                            
                            await interaction.followUp({ content: `Ticket sistemi başarıyla kuruldu!\nKategori: <#${ticketCat.id}>\nKanal: <#${ticketChannel.id}>`, ephemeral: true }).catch(() => {});
                        }
                    } else {
                        await interaction.followUp({ content: 'Kategori oluşturulurken bir hata meydana geldi. Yetkilerimi kontrol edin.', ephemeral: true }).catch(() => {});
                    }
                }
            }
        } catch (err) {
            console.error("Ayarlar handler hatası:", err);
        } finally {
            if (conn) conn.release();
        }
    }
};
