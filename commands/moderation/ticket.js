const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTicket, closeTicketChannel } = require('../../utils/ticketManager');
const { createV2Message, COLORS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Sistem uzerinden destek talebi olusturma ve yonetme islevleri saglar.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ac')
                .setDescription('Yeni bir destek talebi baslatir.')
                .addStringOption(option => 
                    option.setName('kategori')
                        .setDescription('Destek talebinizin siniflandirilmasi (kategori)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Hesap Islemleri', value: 'Hesap Islemleri' },
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
        try {
            const subCmd = interaction.options.getSubcommand();

            if (subCmd === 'ac') {
                const reason = interaction.options.getString('sebep');
                const category = interaction.options.getString('kategori');
                await createTicket(interaction, reason, category);
            }
            else if (subCmd === 'kapat') {
                if (!interaction.channel.name.startsWith('destek-')) {
                    return interaction.reply({ content: 'Bu komut yalnızca aktif bir destek kanalında çalıştırılabilir.', flags: MessageFlags.Ephemeral });
                }
                await closeTicketChannel(interaction);
            }
            else if (subCmd === 'panel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', flags: MessageFlags.Ephemeral });
                }

                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_cat_hesap').setLabel('Hesap İşlemleri').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_cat_ceza').setLabel('Ceza İtiraz').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_cat_sunucu').setLabel('Sunucu Sorunları').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cat_genel').setLabel('Genel Destek').setStyle(ButtonStyle.Success)
                );

                const panelPayload = createV2Message({
                    title: 'TurkLion Network - Destek Paneli',
                    description: 'Aşağıdaki butonlara tıklayarak sorun yaşadığınız konuyla ilgili destek talebi (ticket) oluşturabilirsiniz.\n\nYetkili ekibimiz en kısa sürede talebinize dönüş yapacaktır.',
                    color: COLORS.BRAND,
                    actionRows: [btnRow]
                });

                await interaction.channel.send(panelPayload);
                await interaction.reply({ content: 'Destek paneli başarıyla bu kanala gönderildi.', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error('Ticket hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Destek talebi islenirken sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Destek talebi islenirken sistemsel bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
