const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { buildGiveawayPayload, endGiveaway } = require('../../utils/giveawayManager');

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhdwy])$/i);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000,
        'y': 365 * 24 * 60 * 60 * 1000
    };
    return num * (multipliers[unit] || 0);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Sunucuda çekiliş başlatır, yönetir ve sonlandırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('baslat')
                .setDescription('Yeni bir çekiliş başlatır.')
                .addStringOption(opt =>
                    opt.setName('odul')
                        .setDescription('Çekiliş ödülü (Örn: Discord Nitro, 1000 Robux)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('sure')
                        .setDescription('Çekiliş süresi (Örn: 10m, 1h, 1d, 3d, 1w)')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('kazanan_sayisi')
                        .setDescription('Kazanacak kişi sayısı (Varsayılan: 1)')
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Çekilişin yapılacağı kanal (Varsayılan: Bulunulan kanal)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName('sart_rol')
                        .setDescription('Çekilişe katılmak için zorunlu tutulacak rol')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('aciklama')
                        .setDescription('Çekiliş hakkında ek açıklama / şartlar')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('bitir')
                .setDescription('Aktif bir çekilişi anında sonlandırır ve kazananı belirler.')
                .addStringOption(opt =>
                    opt.setName('mesaj_id')
                        .setDescription('Sonlandırılacak çekiliş mesajının IDsi')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('yeniden-sec')
                .setDescription('Biten bir çekiliş için yeni kazanan(lar) belirler (Reroll).')
                .addStringOption(opt =>
                    opt.setName('mesaj_id')
                        .setDescription('Yeniden çekilecek çekiliş mesajının IDsi')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('kazanan_sayisi')
                        .setDescription('Yeniden seçilecek kazanan sayısı (Varsayılan: 1)')
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Sunucudaki aktif ve geçmiş çekilişleri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('duraklat')
                .setDescription('Aktif bir çekilişe katılımı geçici olarak duraklatır.')
                .addStringOption(opt =>
                    opt.setName('mesaj_id')
                        .setDescription('Duraklatılacak çekiliş mesajının IDsi')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('devam')
                .setDescription('Duraklatılmış bir çekilişi yeniden aktif eder.')
                .addStringOption(opt =>
                    opt.setName('mesaj_id')
                        .setDescription('Devam ettirilecek çekiliş mesajının IDsi')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'baslat') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const prize = interaction.options.getString('odul');
            const durationStr = interaction.options.getString('sure');
            const winnerCount = interaction.options.getInteger('kazanan_sayisi') || 1;
            const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
            const requiredRole = interaction.options.getRole('sart_rol');
            const description = interaction.options.getString('aciklama');

            const durationMs = parseDuration(durationStr);
            if (!durationMs || durationMs < 5000) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Geçersiz Süre Biçimi`,
                    'Lütfen geçerli bir süre girin. Örnekler: `10m`, `1h`, `1d`, `3d`, `1w`',
                    '#ED4245', [], [], false
                ));
            }

            const endsAt = Date.now() + durationMs;

            const dummyGw = {
                prize,
                description,
                winner_count: winnerCount,
                required_role_id: requiredRole ? requiredRole.id : null,
                host_id: interaction.user.id,
                ends_at: endsAt,
                status: 'active',
                participants: []
            };

            const payload = buildGiveawayPayload(dummyGw, false);
            const sentMsg = await targetChannel.send(payload).catch(() => null);

            if (!sentMsg) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Mesaj Gönderilemedi`,
                    `<#${targetChannel.id}> kanalına mesaj gönderme yetkim bulunmuyor.`,
                    '#ED4245', [], [], false
                ));
            }

            // DB'ye kaydet
            await db.createGiveaway({
                message_id: sentMsg.id,
                channel_id: targetChannel.id,
                guild_id: guildId,
                prize,
                description,
                winner_count: winnerCount,
                required_role_id: requiredRole ? requiredRole.id : null,
                host_id: interaction.user.id,
                ends_at: endsAt
            });

            // Buton ID'sini gerçek mesaj IDsi ile güncelle
            const finalPayload = buildGiveawayPayload({ ...dummyGw, message_id: sentMsg.id }, false);
            await sentMsg.edit(finalPayload).catch(() => {});

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Başlatıldı!`,
                `**${prize}** çekilişi <#${targetChannel.id}> kanalında başlatıldı.\n\n[Çekiliş Mesajına Git](${sentMsg.url})`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'bitir') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const messageId = interaction.options.getString('mesaj_id').trim();

            const res = await endGiveaway(messageId, interaction.client);
            if (res.error) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> İşlem Başarısız`,
                    res.error,
                    '#ED4245', [], [], false
                ));
            }

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Sonlandırıldı`,
                `Çekiliş başarıyla bitirildi ve kazananlar kanalda anons edildi.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'yeniden-sec') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const messageId = interaction.options.getString('mesaj_id').trim();
            const count = interaction.options.getInteger('kazanan_sayisi');

            const res = await endGiveaway(messageId, interaction.client, true, count);
            if (res.error) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> İşlem Başarısız`,
                    res.error,
                    '#ED4245', [], [], false
                ));
            }

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Yeniden Çekildi (Reroll)`,
                `Yeni kazananlar başarıyla belirlendi ve kanalda duyuruldu.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'liste') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const list = await db.getGuildGiveaways(guildId);

            if (list.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Çekiliş Bulunamadı`,
                    'Sunucuda kayıtlı herhangi bir çekiliş bulunamadı.',
                    '#5865F2', [], [], false
                ));
            }

            const items = list.map(gw => {
                const statusBadge = gw.status === 'active' ? `<:mono:${MONO_EMOJIS.active || '1530917454174355557'}> Aktif` : `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Bitti`;
                const endsEpoch = Math.floor(gw.ends_at / 1000);
                return `• **${gw.prize}** (${statusBadge}) — <#${gw.channel_id}>\n  └ Bitiş: <t:${endsEpoch}:R> | Katılımcı: \`${gw.participants ? gw.participants.length : 0}\` | ID: \`${gw.message_id}\``;
            }).join('\n\n');

            const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Sunucu Çekilişleri`;
            const desc = `Son yapılan ve aktif olan çekilişler:`;
            const fields = [
                { name: 'Çekiliş Listesi', value: items, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'duraklat') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const messageId = interaction.options.getString('mesaj_id').trim();
            const gw = await db.getGiveaway(messageId);

            if (!gw || gw.status !== 'active') {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata`,
                    'Yalnızca aktif çekilişler duraklatılabilir.',
                    '#ED4245', [], [], false
                ));
            }

            await db.updateGiveawayStatus(messageId, 'paused');

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Duraklatıldı`,
                `**${gw.prize}** çekilişi geçici olarak duraklatıldı. Katılımlar donduruldu.`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'devam') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const messageId = interaction.options.getString('mesaj_id').trim();
            const gw = await db.getGiveaway(messageId);

            if (!gw || gw.status !== 'paused') {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata`,
                    'Bu çekiliş duraklatılmış durumda değil.',
                    '#ED4245', [], [], false
                ));
            }

            await db.updateGiveawayStatus(messageId, 'active');

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Çekiliş Devam Ettirildi`,
                `**${gw.prize}** çekilişi yeniden aktif edildi.`,
                '#57F287', [], [], false
            ));
        }
    }
};
