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
    buildManageGiveawayPayload,
    buildGiveawayListPayload,
    endGiveaway,
    parseDuration 
} = require('../../utils/giveawayManager');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');
const db = require('../../db');
let eventBus;
try {
    eventBus = require('../../utils/eventBus');
} catch (e) {}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Gelişmiş çekiliş ve hızlı drop yönetim sistemi.')
        .addSubcommand(sub => 
            sub.setName('panel')
                .setDescription('Çekiliş yönetim merkezini ve ayar panelini açar.')
        )
        .addSubcommand(sub => 
            sub.setName('baslat')
                .setDescription('Yeni bir süreli çekiliş başlatır.')
                .addStringOption(opt => opt.setName('odul').setDescription('Çekiliş ödülü (Örn: Discord Nitro)').setRequired(true))
                .addStringOption(opt => opt.setName('sure').setDescription('Çekiliş süresi (Örn: 1g, 12sa, 30dk)').setRequired(true))
                .addIntegerOption(opt => opt.setName('kazanan_sayisi').setDescription('Kazanan kişi sayısı (Varsayılan: 1)').setMinValue(1).setMaxValue(50).setRequired(false))
                .addChannelOption(opt => opt.setName('kanal').setDescription('Yayınlanacak kanal (Varsayılan: Bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
                .addRoleOption(opt => opt.setName('zorunlu_rol').setDescription('Katılım için zorunlu rol').setRequired(false))
                .addStringOption(opt => opt.setName('gorsel_url').setDescription('Banner / görsel linki').setRequired(false))
                .addStringOption(opt => opt.setName('aciklama').setDescription('Çekiliş kuralları ve açıklaması').setRequired(false))
                .addIntegerOption(opt => opt.setName('hesap_yasi').setDescription('En az hesap yaşı (gün)').setMinValue(1).setRequired(false))
                .addIntegerOption(opt => opt.setName('uyelik_suresi').setDescription('En az sunucu üyeliği (gün)').setMinValue(1).setRequired(false))
                .addBooleanOption(opt => opt.setName('boost_sarti').setDescription('Yalnızca sunucu takviyecileri katılabilsin').setRequired(false))
                .addIntegerOption(opt => opt.setName('mesaj_sarti').setDescription('Katılım için en az sunucu mesajı').setMinValue(1).setRequired(false))
                .addIntegerOption(opt => opt.setName('ses_sarti').setDescription('Katılım için en az ses süresi (dakika)').setMinValue(1).setRequired(false))
                .addIntegerOption(opt => opt.setName('davet_sarti').setDescription('Katılım için en az davet sayısı').setMinValue(1).setRequired(false))
        )
        .addSubcommand(sub => 
            sub.setName('drop')
                .setDescription('Hızlı drop çekilişi başlatır (İlk tıklayan anında kazanır!).')
                .addStringOption(opt => opt.setName('odul').setDescription('Drop ödülü (Örn: Steam Cüzdan Kodu)').setRequired(true))
                .addChannelOption(opt => opt.setName('kanal').setDescription('Yayınlanacak kanal (Varsayılan: Bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
                .addRoleOption(opt => opt.setName('zorunlu_rol').setDescription('Katılım için zorunlu rol').setRequired(false))
                .addStringOption(opt => opt.setName('gorsel_url').setDescription('Banner / görsel linki').setRequired(false))
                .addStringOption(opt => opt.setName('aciklama').setDescription('Drop açıklaması').setRequired(false))
                .addIntegerOption(opt => opt.setName('hesap_yasi').setDescription('En az hesap yaşı (gün)').setMinValue(1).setRequired(false))
                .addIntegerOption(opt => opt.setName('uyelik_suresi').setDescription('En az sunucu üyeliği (gün)').setMinValue(1).setRequired(false))
                .addBooleanOption(opt => opt.setName('boost_sarti').setDescription('Yalnızca sunucu takviyecileri katılabilsin').setRequired(false))
                .addIntegerOption(opt => opt.setName('mesaj_sarti').setDescription('Katılım için en az sunucu mesajı').setMinValue(1).setRequired(false))
                .addIntegerOption(opt => opt.setName('ses_sarti').setDescription('Katılım için en az ses süresi (dakika)').setMinValue(1).setRequired(false))
                .addIntegerOption(opt => opt.setName('davet_sarti').setDescription('Katılım için en az davet sayısı').setMinValue(1).setRequired(false))
        )
        .addSubcommand(sub => 
            sub.setName('duraklat')
                .setDescription('Devam eden bir çekilişi geçici olarak dondurur/duraklatır.')
                .addStringOption(opt => opt.setName('mesaj_id').setDescription('Duraklatılacak çekilişin mesaj ID\'si').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('devam')
                .setDescription('Duraklatılmış bir çekilişi kaldığı yerden devam ettirir.')
                .addStringOption(opt => opt.setName('mesaj_id').setDescription('Devam ettirilecek çekilişin mesaj ID\'si').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('duzenle')
                .setDescription('Devam eden bir çekilişin ödülünü, süresini veya kazanan sayısını düzenler.')
                .addStringOption(opt => opt.setName('mesaj_id').setDescription('Düzenlenecek çekilişin mesaj ID\'si').setRequired(true))
                .addStringOption(opt => opt.setName('yeni_odul').setDescription('Yeni ödül adı').setRequired(false))
                .addStringOption(opt => opt.setName('ek_sure').setDescription('Eklenecek ek süre (Örn: 1g, 30dk)').setRequired(false))
                .addIntegerOption(opt => opt.setName('yeni_kazanan_sayisi').setDescription('Yeni kazanan kişi sayısı').setMinValue(1).setMaxValue(50).setRequired(false))
                .addStringOption(opt => opt.setName('yeni_aciklama').setDescription('Yeni açıklama metni').setRequired(false))
        )
        .addSubcommand(sub => 
            sub.setName('bitir')
                .setDescription('Bir çekilişi süresi dolmadan anında sonlandırır.')
                .addStringOption(opt => opt.setName('mesaj_id').setDescription('Sonlandırılacak çekilişin mesaj ID\'si').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('reroll')
                .setDescription('Sona ermiş bir çekiliş için yeni kazanan(lar) belirler.')
                .addStringOption(opt => opt.setName('mesaj_id').setDescription('Çekilişin mesaj ID\'si').setRequired(true))
                .addIntegerOption(opt => opt.setName('kazanan_sayisi').setDescription('Seçilecek yeni kazanan sayısı (Varsayılan: 1)').setMinValue(1).setMaxValue(50).setRequired(false))
        )
        .addSubcommand(sub => 
            sub.setName('iptal')
                .setDescription('Devam eden veya duraklatılmış bir çekilişi iptal eder.')
                .addStringOption(opt => opt.setName('mesaj_id').setDescription('İptal edilecek çekilişin mesaj ID\'si').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('liste')
                .setDescription('Sunucudaki aktif ve duraklatılmış tüm çekilişleri listeler.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand(false) || 'panel';

        // 1. PANEL
        if (subcommand === 'panel') {
            const panelPayload = await buildMainPanelPayload(interaction.guild.id);
            return interaction.editReply(panelPayload);
        }

        // 2. LİSTE
        if (subcommand === 'liste') {
            const listPayload = await buildGiveawayListPayload(interaction.guild.id);
            return interaction.editReply(listPayload);
        }

        // 3. BASLAT (Standart Süreli Çekiliş)
        if (subcommand === 'baslat') {
            const odul = interaction.options.getString('odul');
            const sure = interaction.options.getString('sure');
            const kazananSayisi = interaction.options.getInteger('kazanan_sayisi') || 1;
            const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
            const requiredRole = interaction.options.getRole('zorunlu_rol');
            const gorselUrl = interaction.options.getString('gorsel_url');
            const aciklama = interaction.options.getString('aciklama') || '';
            const minAccAge = interaction.options.getInteger('hesap_yasi');
            const minMember = interaction.options.getInteger('uyelik_suresi');
            const minBoost = interaction.options.getBoolean('boost_sarti') ? 1 : null;
            const minMessages = interaction.options.getInteger('mesaj_sarti');
            const minVoice = interaction.options.getInteger('ses_sarti');
            const minInvites = interaction.options.getInteger('davet_sarti');

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
                exempt_roles: [],
                min_account_age_days: minAccAge,
                min_membership_days: minMember,
                min_boost_tier: minBoost,
                min_messages: minMessages,
                min_voice_minutes: minVoice,
                min_invites: minInvites,
                image_url: gorselUrl || null,
                host_id: interaction.user.id,
                channel_id: targetChannel.id,
                guild_id: interaction.guild.id,
                ends_at: endsAt,
                status: 'active',
                is_drop: false,
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
                exempt_roles: [],
                min_account_age_days: minAccAge,
                min_membership_days: minMember,
                min_boost_tier: minBoost,
                min_messages: minMessages,
                min_voice_minutes: minVoice,
                min_invites: minInvites,
                image_url: gorselUrl || null,
                host_id: interaction.user.id,
                ends_at: endsAt,
                is_drop: 0
            });

            const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id, channel_id: targetChannel.id, guild_id: interaction.guild.id }, false, [], settings ? settings.show_parts : true);
            await sentMsg.edit(finalPayload).catch(() => {});

            if (eventBus) {
                try {
                    eventBus.emitEvent('giveaway_update', {
                        guildId: interaction.guild.id,
                        messageId: sentMsg.id,
                        action: 'created'
                    });
                } catch (e) {}
            }

            const successPayload = createContainerMessage(
                'Çekiliş Başarıyla Başlatıldı!',
                `**${odul}** çekilişi <#${targetChannel.id}> kanalında canlı olarak başlatıldı!`,
                COLORS.SUCCESS || '#57F287',
                [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel('Çekilişe Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${targetChannel.id}/${sentMsg.id}`).setEmoji(MONO_EMOJIS.link || '1542629903134883880')
                    )
                ]
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 4. DROP (Hızlı Drop Çekilişi)
        if (subcommand === 'drop') {
            const odul = interaction.options.getString('odul');
            const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
            const requiredRole = interaction.options.getRole('zorunlu_rol');
            const gorselUrl = interaction.options.getString('gorsel_url');
            const aciklama = interaction.options.getString('aciklama') || '';
            const minAccAge = interaction.options.getInteger('hesap_yasi');
            const minMember = interaction.options.getInteger('uyelik_suresi');
            const minBoost = interaction.options.getBoolean('boost_sarti') ? 1 : null;
            const minMessages = interaction.options.getInteger('mesaj_sarti');
            const minVoice = interaction.options.getInteger('ses_sarti');
            const minInvites = interaction.options.getInteger('davet_sarti');

            const endsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
            const settings = await db.getGiveawaySettings(interaction.guild.id);

            const dummyGw = {
                prize: odul,
                description: aciklama,
                winner_count: 1,
                required_role_id: requiredRole ? requiredRole.id : null,
                exempt_roles: [],
                min_account_age_days: minAccAge,
                min_membership_days: minMember,
                min_boost_tier: minBoost,
                min_messages: minMessages,
                min_voice_minutes: minVoice,
                min_invites: minInvites,
                image_url: gorselUrl || null,
                host_id: interaction.user.id,
                channel_id: targetChannel.id,
                guild_id: interaction.guild.id,
                ends_at: endsAt,
                status: 'active',
                is_drop: true,
                participants: [],
                message_id: 'temp'
            };

            const payload = buildGiveawayPayload(dummyGw, false, [], settings ? settings.show_parts : true);
            const sentMsg = await targetChannel.send(payload).catch(() => null);

            if (!sentMsg) {
                const errPayload = createContainerMessage(
                    'Gönderim Hatası',
                    `<#${targetChannel.id}> kanalına drop mesajı gönderilemedi. Botun kanal izinlerini kontrol edin.`,
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
                winner_count: 1,
                required_role_id: requiredRole ? requiredRole.id : null,
                exempt_roles: [],
                min_account_age_days: minAccAge,
                min_membership_days: minMember,
                min_boost_tier: minBoost,
                min_messages: minMessages,
                min_voice_minutes: minVoice,
                min_invites: minInvites,
                image_url: gorselUrl || null,
                host_id: interaction.user.id,
                ends_at: endsAt,
                is_drop: 1
            });

            const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id, channel_id: targetChannel.id, guild_id: interaction.guild.id }, false, [], settings ? settings.show_parts : true);
            await sentMsg.edit(finalPayload).catch(() => {});

            if (eventBus) {
                try {
                    eventBus.emitEvent('giveaway_update', {
                        guildId: interaction.guild.id,
                        messageId: sentMsg.id,
                        action: 'created'
                    });
                } catch (e) {}
            }

            const successPayload = createContainerMessage(
                'Hızlı Drop Başlatıldı!',
                `**${odul}** dropu <#${targetChannel.id}> kanalında paylaşıldı! Butona ilk tıklayan üye ödülü anında kazanacak.`,
                COLORS.SUCCESS || '#57F287',
                [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel('Dropa Git').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${targetChannel.id}/${sentMsg.id}`).setEmoji(MONO_EMOJIS.zap || '1548248481586618378')
                    )
                ]
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 5. DURAKLAT (Pause)
        if (subcommand === 'duraklat') {
            const messageId = interaction.options.getString('mesaj_id').trim();
            const res = await db.pauseGiveaway(messageId);
            if (res.error) {
                const errPayload = createContainerMessage('İşlem Başarısız', res.error, COLORS.ERROR || '#ED4245');
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            const updatedGw = await db.getGiveaway(messageId);
            if (updatedGw) {
                try {
                    const ch = interaction.guild.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                    }
                } catch (e) {}
            }

            const successPayload = createContainerMessage(
                'Çekiliş Duraklatıldı',
                `\`${messageId}\` ID'li çekiliş başarıyla duraklatıldı. Süre sayacı donduruldu.`,
                COLORS.WARNING || '#FEE75C'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 6. DEVAM (Resume)
        if (subcommand === 'devam') {
            const messageId = interaction.options.getString('mesaj_id').trim();
            const res = await db.resumeGiveaway(messageId);
            if (res.error) {
                const errPayload = createContainerMessage('İşlem Başarısız', res.error, COLORS.ERROR || '#ED4245');
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            const updatedGw = await db.getGiveaway(messageId);
            if (updatedGw) {
                try {
                    const ch = interaction.guild.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                    }
                } catch (e) {}
            }

            const successPayload = createContainerMessage(
                'Çekiliş Devam Ettirildi',
                `\`${messageId}\` ID'li çekiliş başarıyla tekrar başlatıldı ve kalan süre işletilmeye başlandı.`,
                COLORS.SUCCESS || '#57F287'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 7. DÜZENLE (Edit)
        if (subcommand === 'duzenle') {
            const messageId = interaction.options.getString('mesaj_id').trim();
            const yeniOdul = interaction.options.getString('yeni_odul');
            const ekSureStr = interaction.options.getString('ek_sure');
            const yeniKazanan = interaction.options.getInteger('yeni_kazanan_sayisi');
            const yeniAciklama = interaction.options.getString('yeni_aciklama');

            const extraTimeMs = ekSureStr ? parseDuration(ekSureStr) : 0;
            const res = await db.editGiveaway(messageId, {
                prize: yeniOdul || undefined,
                extraTimeMs,
                winnerCount: yeniKazanan || undefined,
                description: yeniAciklama !== null ? yeniAciklama : undefined
            });

            if (res.error) {
                const errPayload = createContainerMessage('Düzenleme Hatası', res.error, COLORS.ERROR || '#ED4245');
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            const updatedGw = await db.getGiveaway(messageId);
            if (updatedGw) {
                try {
                    const ch = interaction.guild.channels.cache.get(updatedGw.channel_id);
                    if (ch) {
                        const m = await ch.messages.fetch(messageId).catch(() => null);
                        if (m) await m.edit(buildGiveawayPayload(updatedGw, false, [], updatedGw.show_parts)).catch(() => {});
                    }
                } catch (e) {}
            }

            const successPayload = createContainerMessage(
                'Çekiliş Güncellendi',
                `\`${messageId}\` ID'li çekilişin bilgileri başarıyla güncellendi ve mesaj yenilendi.`,
                COLORS.SUCCESS || '#57F287'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 8. BİTİR (End)
        if (subcommand === 'bitir') {
            const messageId = interaction.options.getString('mesaj_id').trim();
            const res = await endGiveaway(messageId, interaction.client);
            if (res.error) {
                const errPayload = createContainerMessage('İşlem Başarısız', res.error, COLORS.ERROR || '#ED4245');
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            const successPayload = createContainerMessage(
                'Çekiliş Sonlandırıldı',
                `\`${messageId}\` ID'li çekiliş başarıyla sonlandırıldı ve kazanan(lar) duyuruldu.`,
                COLORS.SUCCESS || '#57F287'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 9. REROLL
        if (subcommand === 'reroll') {
            const messageId = interaction.options.getString('mesaj_id').trim();
            const count = interaction.options.getInteger('kazanan_sayisi') || 1;
            const res = await endGiveaway(messageId, interaction.client, true, count);
            if (res.error) {
                const errPayload = createContainerMessage('İşlem Başarısız', res.error, COLORS.ERROR || '#ED4245');
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            const successPayload = createContainerMessage(
                'Yeniden Çekiliş Yapıldı (Reroll)',
                `\`${messageId}\` ID'li çekiliş için ${res.winners.length} yeni kazanan başarıyla belirlendi ve duyuruldu.`,
                COLORS.SUCCESS || '#57F287'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }

        // 10. İPTAL (Cancel)
        if (subcommand === 'iptal') {
            const messageId = interaction.options.getString('mesaj_id').trim();
            const gw = await db.getGiveaway(messageId);
            if (!gw) {
                const errPayload = createContainerMessage('Bulunamadı', 'Çekiliş bulunamadı.', COLORS.ERROR || '#ED4245');
                errPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
                return interaction.editReply(errPayload);
            }

            await db.cancelGiveaway(messageId);
            const updatedGw = await db.getGiveaway(messageId);
            try {
                const ch = interaction.guild.channels.cache.get(updatedGw.channel_id);
                if (ch) {
                    const m = await ch.messages.fetch(messageId).catch(() => null);
                    if (m) await m.edit(buildGiveawayPayload(updatedGw, true, [])).catch(() => {});
                }
            } catch (e) {}

            const successPayload = createContainerMessage(
                'Çekiliş İptal Edildi',
                `\`${messageId}\` ID'li çekiliş iptal edildi ve mesajı güncellendi.`,
                COLORS.MUTED || '#4F545C'
            );
            successPayload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
            return interaction.editReply(successPayload);
        }
    }
};