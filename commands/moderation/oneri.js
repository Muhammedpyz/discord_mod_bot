'use strict';

const {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder
} = require('discord.js');
const { renderSuggestionAdminMenu, getSuggestionSetup } = require('../../utils/suggestionSystem');
const { createContainerMessage, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oneri')
        .setDescription('Öneri sistemi ve yönetim paneli')
        .addSubcommand(sub =>
            sub
                .setName('panel')
                .setDescription('Öneri sistemi yönetim panelini açar (Yönetici).')
        )
        .addSubcommand(sub =>
            sub
                .setName('yap')
                .setDescription('Sunucu için yeni bir öneri gönderin.')
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();

        // 1. ADMIN PANELİ
        if (subCmd === 'panel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: 'Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısınız.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            try {
                const menu = await renderSuggestionAdminMenu(interaction.guild.id);
                await interaction.editReply(menu);
            } catch (error) {
                console.error('[Oneri Panel Error]:', error);
                await interaction.editReply({ content: 'Panel yüklenirken bir hata oluştu.' }).catch(() => {});
            }
        }

        // 2. ÜYE ÖNERİ GİRİŞİ (MODAL GÖSTER)
        else if (subCmd === 'yap') {
            const setup = await getSuggestionSetup(interaction.guild.id);
            if (!setup || !setup.is_active || !setup.suggestion_channel_id) {
                const notConfigured = createContainerMessage(
                    'Öneri Sistemi Aktif Değil',
                    'Sunucu yönetimi henüz öneri sistemini yapılandırmadı veya öneriler kanalı ayarlanmadı.',
                    COLORS.WARNING || '#FEE75C'
                );
                notConfigured.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                return await interaction.reply(notConfigured);
            }

            // Modal oluştur
            const modal = new ModalBuilder()
                .setCustomId('oneri_modal_user_submit')
                .setTitle('Önerini Paylaş');

            const textInput = new TextInputBuilder()
                .setCustomId('suggestion_text')
                .setLabel('Öneriniz')
                .setPlaceholder('Sunucuda neyi, neden ve nasıl geliştirmek istersiniz?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1500);

            const anonInput = new TextInputBuilder()
                .setCustomId('anonymous_text')
                .setLabel('Anonim Gönderilsin mi? (Evet / Hayır)')
                .setPlaceholder('Anonim kalmak için "Evet" yazın, aksi halde boş bırakın')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(10);

            modal.addComponents(
                new ActionRowBuilder().addComponents(textInput),
                new ActionRowBuilder().addComponents(anonInput)
            );

            await interaction.showModal(modal).catch(err => console.error('[Oneri Modal Error]:', err));
        }
    }
};
