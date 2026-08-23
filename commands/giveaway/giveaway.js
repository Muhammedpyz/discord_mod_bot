const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags, 
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { 
    buildMainPanelPayload, 
    buildGiveawayPayload, 
    parseDuration 
} = require('../../utils/giveawayManager');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Çekiliş yönetim sistemini açar veya doğrudan yeni çekiliş başlatır.')
        .addStringOption(option => 
            option.setName('odul')
                .setDescription('Çekiliş ödülü (Örn: Discord Nitro, VIP Üyelik)')
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('sure')
                .setDescription('Çekiliş süresi (Örn: 1g, 12sa, 30dk, 1d)')
                .setRequired(false)
        )
        .addIntegerOption(option => 
            option.setName('kazanan_sayisi')
                .setDescription('Kazanan kişi sayısı (Varsayılan: 1)')
                .setMinValue(1)
                .setMaxValue(50)
                .setRequired(false)
        )
        .addChannelOption(option => 
            option.setName('kanal')
                .setDescription('Çekilişin yapılacağı kanal (Varsayılan: Bu kanal)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addRoleOption(option => 
            option.setName('zorunlu_rol')
                .setDescription('Katılım için gerekli rol şartı (İsteğe bağlı)')
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('gorsel_url')
                .setDescription('Çekiliş afişi / banner görsel linki (İsteğe bağlı)')
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('aciklama')
                .setDescription('Çekiliş kuralları veya detaylı açıklama')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const odul = interaction.options.getString('odul');
        const sure = interaction.options.getString('sure');
        const kazananSayisi = interaction.options.getInteger('kazanan_sayisi') || 1;
        const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
        const requiredRole = interaction.options.getRole('zorunlu_rol');
        const gorselUrl = interaction.options.getString('gorsel_url');
        const aciklama = interaction.options.getString('aciklama') || '';

        // Hızlı başlatma parametreleri sağlandıysa doğrudan çekilişi başlat
        if (odul && sure) {
            const durationMs = parseDuration(sure);
            if (durationMs < 5000) {
                const errPayload = createContainerMessage(
                    'Geçersiz Süre',
                    'Lütfen geçerli bir süre formatı girin (Örn: `1g`, `12sa`, `30dk`, `1d`).',
                    COLORS.ERROR || '#ED4245'
                );
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            const endsAt = Date.now() + durationMs;
            const settings = await db.getGiveawaySettings(interaction.guild.id);

            const dummyGw = {
                prize: odul,
                description: aciklama,
                winner_count: kazananSayisi,
                required_role_id: requiredRole ? requiredRole.id : null,
                image_url: gorselUrl || null,
                host_id: interaction.user.id,
                ends_at: endsAt,
                status: 'active',
                participants: [],
                message_id: 'temp'
            };

            const payload = buildGiveawayPayload(dummyGw, false, [], settings ? settings.show_parts : true);
            const sentMsg = await targetChannel.send(payload).catch(() => null);

            if (!sentMsg) {
                const errPayload = createContainerMessage(
                    'Gönderim Hatası',
                    `<#${targetChannel.id}> kanalına çekiliş mesajı gönderilemedi. Botun kanal izinlerini kontrol edin.`,
                    COLORS.ERROR || '#ED4245'
                );
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            await db.createGiveaway({
                message_id: sentMsg.id,
                channel_id: targetChannel.id,
                guild_id: interaction.guild.id,
                prize: odul,
                description: aciklama,
                winner_count: kazananSayisi,
                required_role_id: requiredRole ? requiredRole.id : null,
                image_url: gorselUrl || null,
                host_id: interaction.user.id,
                ends_at: endsAt
            });

            const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id }, false, [], settings ? settings.show_parts : true);
            await sentMsg.edit(finalPayload).catch(() => {});

            const successPayload = createContainerMessage(
                'Çekiliş Başarıyla Başlatıldı!',
                `**${odul}** çekilişi <#${targetChannel.id}> kanalında başlatıldı!`,
                COLORS.SUCCESS || '#57F287',
                [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel('Çekilişe Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${targetChannel.id}/${sentMsg.id}`).setEmoji(MONO_EMOJIS.external_link || '1537769989669658644')
                    )
                ]
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // Parametresiz çağrıda ana yönetim panelini aç
        const panelPayload = await buildMainPanelPayload(interaction.guild.id);
        await interaction.editReply(panelPayload);
    }
};