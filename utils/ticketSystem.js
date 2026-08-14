const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('./uiBuilder');
const { pool } = require('../db');

async function getTicketSetup(guildId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM tickets_setup WHERE guild_id = ?', [guildId]);
        if (rows.length > 0) {
            let setup = rows[0];
            try { setup.support_roles = typeof setup.support_roles === 'string' ? JSON.parse(setup.support_roles) : (setup.support_roles || []); } catch(e) { setup.support_roles = []; }
            try { setup.ticket_types = typeof setup.ticket_types === 'string' ? JSON.parse(setup.ticket_types) : (setup.ticket_types || []); } catch(e) { setup.ticket_types = []; }
            try { setup.panel_sections = typeof setup.panel_sections === 'string' ? JSON.parse(setup.panel_sections) : (setup.panel_sections || []); } catch(e) { setup.panel_sections = []; }
            return setup;
        }
        return {
            guild_id: guildId,
            room_type: 'channel',
            category_id: null,
            support_roles: [],
            log_channel_id: null,
            ticket_types: [],
            published_panel_id: null,
            panel_channel_id: null,
            panel_sections: [],
            close_behavior: 'delete'
        };
    } catch(err) {
        console.error(err);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

async function saveTicketSetup(setup) {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO tickets_setup 
            (guild_id, room_type, category_id, support_roles, log_channel_id, ticket_types, published_panel_id, panel_channel_id, panel_sections, close_behavior)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            room_type=VALUES(room_type), category_id=VALUES(category_id), support_roles=VALUES(support_roles), log_channel_id=VALUES(log_channel_id), ticket_types=VALUES(ticket_types), published_panel_id=VALUES(published_panel_id), panel_channel_id=VALUES(panel_channel_id), panel_sections=VALUES(panel_sections), close_behavior=VALUES(close_behavior)
        `, [
            setup.guild_id,
            setup.room_type,
            setup.category_id,
            JSON.stringify(setup.support_roles || []),
            setup.log_channel_id,
            JSON.stringify(setup.ticket_types || []),
            setup.published_panel_id,
            setup.panel_channel_id,
            JSON.stringify(setup.panel_sections || []),
            setup.close_behavior
        ]);
    } catch(err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
    }
}

async function renderTicketDashboard(guildId) {
    const setup = await getTicketSetup(guildId);
    if (!setup) return null;

    let desc = `${EMOJIS.settings} **Bilet Sistemi Ayarları**\n\n`;
    desc += `**Oda Türü:** ${setup.room_type === 'channel' ? 'Kanal' : 'Alt Başlık (Thread)'}\n`;
    desc += `**Kategori:** ${setup.category_id ? \`<#\${setup.category_id}>\` : 'Ayarlanmadı'}\n`;
    desc += `**Destek Rolleri:** ${setup.support_roles.length > 0 ? setup.support_roles.map(r => \`<@&\${r}>\`).join(', ') : 'Ayarlanmadı'}\n`;
    desc += `**Log Kanalı:** ${setup.log_channel_id ? \`<#\${setup.log_channel_id}>\` : 'Ayarlanmadı'}\n`;
    desc += `**Bilet Türleri:** ${setup.ticket_types.length > 0 ? setup.ticket_types.map(t => t.name).join(', ') : 'Eklenmedi'}\n`;
    desc += `**Kapatma Davranışı:** ${setup.close_behavior === 'delete' ? 'Kanalı Sil' : 'Arşivle'}\n`;
    desc += `**Panel Kanalı:** ${setup.panel_channel_id ? \`<#\${setup.panel_channel_id}>\` : 'Ayarlanmadı'}\n`;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_setup_main').setLabel('Kurulum').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_setup_types').setLabel('Türler').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_setup_behavior').setLabel('Davranış').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_setup_panel').setLabel('Panel Gönder').setStyle(ButtonStyle.Success)
    );

    return createContainerMessage(
        `${EMOJIS.ticket} Bilet Yönetim Paneli`,
        desc,
        '#2B2D31',
        [row]
    );
}

async function handleTicketInteraction(interaction) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;

    if (customId === 'ticket_setup_main') {
        const row1 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('ticket_setup_category')
                .setPlaceholder('Bilet Kategorisi Seçin')
                .setChannelTypes(ChannelType.GuildCategory)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('ticket_setup_log')
                .setPlaceholder('Log Kanalı Seçin')
                .setChannelTypes(ChannelType.GuildText)
        );
        const row3 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('ticket_setup_roles')
                .setPlaceholder('Destek Rolleri Seçin')
                .setMinValues(1)
                .setMaxValues(5)
        );
        const row4 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('ticket_setup_panel_channel')
                .setPlaceholder('Panel Kanalı Seçin (Panel buraya gönderilecek)')
                .setChannelTypes(ChannelType.GuildText)
        );
        const row5 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_setup_back').setLabel('Geri Dön').setStyle(ButtonStyle.Danger)
        );

        await interaction.update(createContainerMessage(
            `${EMOJIS.settings} Kurulum Aşaması`,
            `Kategorileri, log kanalını ve destek rollerini aşağıdan seçebilirsiniz.`,
            '#2B2D31',
            [row1, row2, row3, row4, row5]
        ));
    }
    
    else if (customId === 'ticket_setup_back') {
        const msg = await renderTicketDashboard(guildId);
        await interaction.update(msg);
    }

    else if (customId === 'ticket_setup_category') {
        const setup = await getTicketSetup(guildId);
        setup.category_id = interaction.values[0];
        await saveTicketSetup(setup);
        const msg = await renderTicketDashboard(guildId);
        await interaction.update(msg);
    }
    
    else if (customId === 'ticket_setup_log') {
        const setup = await getTicketSetup(guildId);
        setup.log_channel_id = interaction.values[0];
        await saveTicketSetup(setup);
        const msg = await renderTicketDashboard(guildId);
        await interaction.update(msg);
    }

    else if (customId === 'ticket_setup_roles') {
        const setup = await getTicketSetup(guildId);
        setup.support_roles = interaction.values;
        await saveTicketSetup(setup);
        const msg = await renderTicketDashboard(guildId);
        await interaction.update(msg);
    }

    else if (customId === 'ticket_setup_panel_channel') {
        const setup = await getTicketSetup(guildId);
        setup.panel_channel_id = interaction.values[0];
        await saveTicketSetup(setup);
        const msg = await renderTicketDashboard(guildId);
        await interaction.update(msg);
    }

    else if (customId === 'ticket_setup_behavior') {
        const setup = await getTicketSetup(guildId);
        setup.close_behavior = setup.close_behavior === 'delete' ? 'archive' : 'delete';
        await saveTicketSetup(setup);
        const msg = await renderTicketDashboard(guildId);
        await interaction.update(msg);
    }

    else if (customId === 'ticket_setup_types') {
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal_types')
            .setTitle('Bilet Türü Ekle');

        const nameInput = new TextInputBuilder()
            .setCustomId('type_name')
            .setLabel('Tür Adı (Örn: Destek, Şikayet)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50);
            
        const descInput = new TextInputBuilder()
            .setCustomId('type_desc')
            .setLabel('Açıklama')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(descInput));
        await interaction.showModal(modal);
    }

    else if (customId === 'ticket_modal_types') {
        const name = interaction.fields.getTextInputValue('type_name');
        const desc = interaction.fields.getTextInputValue('type_desc');
        const setup = await getTicketSetup(guildId);
        
        setup.ticket_types.push({ name, description: desc || '' });
        await saveTicketSetup(setup);
        
        await interaction.deferUpdate();
        const msg = await renderTicketDashboard(guildId);
        await interaction.editReply(msg);
    }

    else if (customId === 'ticket_setup_panel') {
        const setup = await getTicketSetup(guildId);
        if (!setup.panel_channel_id) {
            return interaction.reply({ content: 'Lütfen önce Kurulum menüsünden Panel Kanalı seçin.', ephemeral: true });
        }
        if (!setup.ticket_types || setup.ticket_types.length === 0) {
            return interaction.reply({ content: 'Lütfen en az bir bilet türü ekleyin.', ephemeral: true });
        }

        const channel = interaction.guild.channels.cache.get(setup.panel_channel_id);
        if (!channel) {
            return interaction.reply({ content: 'Panel kanalı bulunamadı.', ephemeral: true });
        }

        const options = setup.ticket_types.map((t, idx) => ({
            label: t.name,
            description: t.description || 'Bilet oluşturmak için seçin.',
            value: \`create_ticket_\${idx}\`
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_create_menu')
                .setPlaceholder('Bir bilet türü seçin')
                .addOptions(options)
        );

        const payload = createContainerMessage(
            `${EMOJIS.ticket} Destek Sistemi`,
            'Aşağıdaki menüden ilgili departmanı seçerek bir bilet oluşturabilirsiniz.',
            '#2B2D31',
            [row]
        );

        await interaction.deferUpdate();
        const sentMsg = await channel.send(payload);
        
        setup.published_panel_id = sentMsg.id;
        await saveTicketSetup(setup);
        
        const msg = await renderTicketDashboard(guildId);
        await interaction.editReply(msg);
    }
    
    else if (customId === 'ticket_create_menu') {
        await interaction.deferReply({ ephemeral: true });
        const val = interaction.values[0];
        const idx = parseInt(val.replace('create_ticket_', ''));
        const setup = await getTicketSetup(guildId);
        if (!setup || !setup.ticket_types[idx]) {
            return interaction.editReply({ content: 'Hatalı işlem.' });
        }
        await openTicket(interaction, setup, setup.ticket_types[idx]);
    }
    
    else if (customId.startsWith('ticket_close_')) {
        await interaction.deferUpdate();
        const setup = await getTicketSetup(guildId);
        if (setup && setup.close_behavior === 'archive') {
            await interaction.channel.setParent(null); // veya arsiv kategorisi
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: false });
            await interaction.channel.send({ content: 'Bilet arşivlendi.' });
        } else {
            await interaction.channel.delete('Bilet kapatıldı');
        }
    }
}

async function openTicket(interaction, setup, typeData) {
    try {
        const guild = interaction.guild;
        const member = interaction.member;

        const overwrites = [
            {
                id: guild.roles.everyone.id,
                deny: ['ViewChannel']
            },
            {
                id: member.user.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
            {
                id: guild.members.me.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
            }
        ];

        if (setup.support_roles && setup.support_roles.length > 0) {
            for (const rId of setup.support_roles) {
                overwrites.push({
                    id: rId,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                });
            }
        }

        const channel = await guild.channels.create({
            name: \`\${typeData.name.toLowerCase()}-\${member.user.username}\`,
            type: ChannelType.GuildText,
            parent: setup.category_id || null,
            permissionOverwrites: overwrites
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(\`ticket_close_\${channel.id}\`).setLabel('Kapat').setStyle(ButtonStyle.Danger).setEmoji('1261361280800624641') // Close emoji id placeholder or just use EMOJIS from uiBuilder later
        );
        
        // Fix emoji usage based on rules
        row.components[0].setEmoji(undefined); // Remove placeholder if any

        const payload = createContainerMessage(
            `${EMOJIS.ticket} ${typeData.name}`,
            `Hoş geldin <@${member.user.id}>, destek ekibimiz seninle en kısa sürede ilgilenecek.`,
            '#2B2D31',
            [row]
        );

        await channel.send({ content: `<@${member.user.id}>`, ...payload });
        await interaction.editReply({ content: \`Biletin oluşturuldu: <#\${channel.id}>\` });
    } catch(err) {
        console.error(err);
        await interaction.editReply({ content: 'Bilet oluşturulurken hata meydana geldi.' });
    }
}

module.exports = {
    renderTicketDashboard,
    handleTicketInteraction,
    openTicket
};
