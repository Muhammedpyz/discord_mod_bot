const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { withGuard } = require('../../utils/interactionGuard');
const { createContainerMessage, buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buton-rol')
        .setDescription('Gelişmiş Buton/Menü Rol Sistemi Yönetimi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('olustur')
                .setDescription('Yeni bir rol alma paneli oluşturur.')
        )
        .addSubcommand(sub =>
            sub.setName('secenek-ekle')
                .setDescription('Mevcut bir panele yeni bir rol seçeneği ekler.')
                .addIntegerOption(opt =>
                    opt.setName('panel_id')
                        .setDescription('Seçenek eklenecek panelin ID numarası (Listeden bakabilirsiniz)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Sunucudaki aktif buton rol panellerini listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Bir rol panelini ve tüm seçeneklerini siler.')
                .addIntegerOption(opt =>
                    opt.setName('panel_id')
                        .setDescription('Silinecek panelin ID numarası')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('paket-ekle')
                .setDescription('Tek butonla birden fazla rol veren rol paketi ekler.')
                .addIntegerOption(opt =>
                    opt.setName('secenek_id')
                        .setDescription('Paket eklenecek seçeneğin ID numarası (Listeden öğrenin)')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // Tüm alt komutlar için ortak Guard (ManageRoles kontrolü)
        await withGuard(interaction, { permission: PermissionFlagsBits.ManageRoles }, async () => {
            const subCommand = interaction.options.getSubcommand();

            if (subCommand === 'olustur') {
                // Panel oluşturma modalı
                const modal = new ModalBuilder()
                    .setCustomId('rr_create_panel_modal')
                    .setTitle('Yeni Buton Rol Paneli');

                const titleInput = new TextInputBuilder()
                    .setCustomId('panel_title')
                    .setLabel('Panel Başlığı')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(true);

                const descInput = new TextInputBuilder()
                    .setCustomId('panel_desc')
                    .setLabel('Panel Açıklaması')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(1000)
                    .setRequired(false);

                const modeInput = new TextInputBuilder()
                    .setCustomId('panel_mode')
                    .setLabel('Çoklu Seçim (evet/hayır)')
                    .setPlaceholder('evet = birden fazla rol, hayır = tek rol')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(5)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(modeInput)
                );

                await interaction.showModal(modal);
            } 
            else if (subCommand === 'secenek-ekle') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                const panelId = interaction.options.getInteger('panel_id');
                
                let conn;
                try {
                    conn = await db.pool.getConnection();
                    const panels = await conn.query("SELECT * FROM reaction_role_panels WHERE id = ? AND guild_id = ?", [panelId, interaction.guild.id]);
                    
                    if (panels.length === 0) {
                        return interaction.editReply(createContainerMessage('Hata', `<:mono:${MONO_EMOJIS.cross}> Belirtilen ID'ye sahip bir panel bulunamadı.`, '#ED4245', [], [], false, true));
                    }

                    // Rol seçimi için Discord'un native RoleSelect menüsünü kullanıyoruz
                    const roleSelect = new RoleSelectMenuBuilder()
                        .setCustomId(`rr_add_role_${panelId}`)
                        .setPlaceholder('Panele eklenecek rolü seçin...')
                        .setMaxValues(1);

                    const row = new ActionRowBuilder().addComponents(roleSelect);
                    const msg = createContainerMessage('Seçenek Ekle (Adım 1)', `Lütfen **"${panels[0].title}"** paneline eklemek istediğiniz rolü menüden seçin.`, null, [row], [], false, true);
                    await interaction.editReply(msg);
                    
                } finally {
                    if (conn) conn.release();
                }
            }
            else if (subCommand === 'liste') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                let conn;
                try {
                    conn = await db.pool.getConnection();
                    const panels = await conn.query("SELECT * FROM reaction_role_panels WHERE guild_id = ?", [interaction.guild.id]);
                    
                    if (panels.length === 0) {
                        return interaction.editReply(createContainerMessage('Bilgi', `<:mono:${MONO_EMOJIS.info || '1531752490691854528'}> Bu sunucuda aktif bir panel bulunmuyor.`, '#3498DB', [], [], false, true));
                    }

                    let listText = '';
                    for (const p of panels) {
                        listText += `<:mono:${MONO_EMOJIS.pin}> **ID: ${p.id}** — ${p.title} (Mod: ${p.mode})\n`;
                    }

                    await interaction.editReply(createContainerMessage('Buton Rol Panelleri', listText, null, [], [], false, true));
                } finally {
                    if (conn) conn.release();
                }
            }
            else if (subCommand === 'sil') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                const panelId = interaction.options.getInteger('panel_id');

                let conn;
                try {
                    conn = await db.pool.getConnection();
                    const panels = await conn.query("SELECT * FROM reaction_role_panels WHERE id = ? AND guild_id = ?", [panelId, interaction.guild.id]);

                    if (panels.length === 0) {
                        return interaction.editReply(createContainerMessage('Hata', `<:mono:${MONO_EMOJIS.cross}> Belirtilen ID'ye sahip bir panel bulunamadı.`, '#ED4245', [], [], false, true));
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`rr_delete_${panelId}`)
                            .setLabel('Evet, Sil')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(MONO_EMOJIS.delete || '1531752503237152858'),
                        new ButtonBuilder()
                            .setCustomId('rr_cancel')
                            .setLabel('İptal')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const msg = createContainerMessage('Panel Silme Onayı', `**"${panels[0].title}"** paneli ve tüm seçenekleri kalıcı olarak silinecek. Emin misiniz?`, '#ED4245', [row], [], false, true);
                    await interaction.editReply(msg);
                } finally {
                    if (conn) conn.release();
                }
            }
            else if (subCommand === 'paket-ekle') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                const optionId = interaction.options.getInteger('secenek_id');

                let conn;
                try {
                    conn = await db.pool.getConnection();
                    const opts = await conn.query(
                        "SELECT o.*, p.title FROM reaction_role_options o JOIN reaction_role_panels p ON o.panel_id = p.id WHERE o.id = ? AND p.guild_id = ?",
                        [optionId, interaction.guild.id]
                    );

                    if (opts.length === 0) {
                        return interaction.editReply(createContainerMessage('Hata', `<:mono:${MONO_EMOJIS.cross}> Belirtilen ID'ye sahip bir seçenek bulunamadı.`, '#ED4245', [], [], false, true));
                    }

                    const roleSelect = new RoleSelectMenuBuilder()
                        .setCustomId(`rr_pack_add_${optionId}`)
                        .setPlaceholder('Pakete eklenecek rolleri seçin (birden fazla)...')
                        .setMinValues(1)
                        .setMaxValues(10);

                    const row = new ActionRowBuilder().addComponents(roleSelect);
                    const msg = createContainerMessage('Rol Paketi Ekle (Adım 1)', `**"${opts[0].title}"** panelindeki \`${opts[0].label}\` butonuna eklenecek rolleri seçin.\nBu butona basan kişi seçilen **TÜM** rolleri aynı anda alacaktır.`, null, [row], [], false, true);
                    await interaction.editReply(msg);
                } finally {
                    if (conn) conn.release();
                }
            }
        });
    }
};
