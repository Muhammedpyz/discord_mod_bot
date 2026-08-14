const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTicket, closeTicketChannel } = require('../../utils/ticketManager');
const { createV2Message, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Sistem üzerinden destek talebi oluşturma ve yönetme işlevleri sağlar.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('aç')
                .setDescription('Yeni bir destek talebi baslatir.')
                .addStringOption(option => 
                    option.setName('kategori')
                        .setDescription('Destek talebinizin siniflandirilmasi (kategori)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Hesap İşlemleri', value: 'Hesap İşlemleri' },
                            { name: 'Ceza Itiraz', value: 'Ceza Itiraz' },
                            { name: 'Sunucu Sorunlari', value: 'Sunucu Sorunlari' },
                            { name: 'Diger', value: 'Diger' }
                        ))
                .addStringOption(option => 
                    option.setName('sebep')
                        .setDescription('Talebinize iliskin detaylar nelerdir?')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Mevcut destek talebini sonlandirir ve transcript kaydeder.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Kanal icerisine TurkLion Destek Talebi Paneli mesajini gonderir.')
        ),

    async execute(interaction) {
        try { await interaction.deferReply(); } catch(e) { return; }
        try {
            const subCmd = interaction.options.getSubcommand();

            if (subCmd === 'aç') {
                const reason = interaction.options.getString('sebep');
                const category = interaction.options.getString('kategori');
                await createTicket(interaction, reason, category);
            }
            else if (subCmd === 'kapat') {
                if (!interaction.channel.name.startsWith('destek-')) {
                    return await interaction.editReply({ content: 'Bu komut yalnızca aktif bir destek kanalında çalıştırılabilir.' }).catch(() => {});
                }
                await closeTicketChannel(interaction);
            }
            else if (subCmd === 'panel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return await interaction.editReply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.' }).catch(() => {});
                }

                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_cat_hesap').setLabel('Hesap İşlemleri').setEmoji(MONO_EMOJIS.user_cog).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cat_ceza').setLabel('Ceza İtiraz').setEmoji(MONO_EMOJIS.hammer).setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_cat_sunucu').setLabel('Sunucu Sorunları').setEmoji(MONO_EMOJIS.server).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cat_genel').setLabel('Genel Destek').setEmoji(MONO_EMOJIS.ticket).setStyle(ButtonStyle.Success)
                );

                const panelPayload = createV2Message({
                    title: 'TurkLion Network - Destek Paneli',
                    description: 'Aşağıdaki butonlara tıklayarak sorun yaşadığınız konuyla ilgili destek talebi (ticket) oluşturabilirsiniz.\n\nYetkili ekibimiz en kısa sürede talebinize dönüş yapacaktır.',
                    color: COLORS.BRAND,
                    actionRows: [btnRow]
                });

                await interaction.channel.send(panelPayload);
                await interaction.editReply({ content: 'Destek paneli başarıyla bu kanala gönderildi.' }).catch(() => {});
            }
        } catch (error) {
            console.error('Ticket hatası:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
