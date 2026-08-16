const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vanity-rol')
        .setDescription('Özel durumuna sunucu linki/yazısı koyan üyelere otomatik rol verir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Özel durum takip sistemini ve verilecek rolü ayarlar.')
                .addStringOption(opt =>
                    opt.setName('durum_yazisi')
                        .setDescription('Üyenin durumunda aranacak metin (Örn: .gg/turklion veya discord.gg/sunucu)')
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('verilecek_rol')
                        .setDescription('Durumunda yazı bulunan üyeye verilecek rol')
                        .setRequired(true)
                )
                .addChannelOption(opt =>
                    opt.setName('log_kanali')
                        .setDescription('Rol verilme/alınma loglarının gönderileceği kanal')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Özel durum rol sistemini devre dışı bırakır.')
        )
        .addSubcommand(sub =>
            sub.setName('durum')
                .setDescription('Mevcut özel durum rol ayarlarını gösterir.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'ayarla') {
            const vanityText = interaction.options.getString('durum_yazisi');
            const role = interaction.options.getRole('verilecek_rol');
            const logChannel = interaction.options.getChannel('log_kanali');

            // Botun rol yetkisi kontrolü
            const botMember = interaction.guild.members.me;
            if (role.position >= botMember.roles.highest.position) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Yetki Yetersiz`,
                    `Belirtilen <@&${role.id}> rolü benim en yüksek rolümden üstte veya eşit! Rolü bana verebilmem için rol sırasını bot rolümün altına çekmelisiniz.`,
                    '#ED4245', [], [], false
                ));
            }

            await db.setVanityConfig(guildId, vanityText, role.id, logChannel ? logChannel.id : null, true);

            const title = `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Özel Durum Rolü Aktif Edildi`;
            const desc = `Üyeler Discord özel durumlarına (Custom Status) belirlenen metni eklediklerinde otomatik olarak ödül rolünü alacaklardır.`;
            const fields = [
                { name: 'Aranan Durum Metni', value: `\`${vanityText}\``, inline: true },
                { name: 'Verilecek Rol', value: `<@&${role.id}>`, inline: true },
                { name: 'Log Kanalı', value: logChannel ? `<#${logChannel.id}>` : '`Ayarlanmadı`', inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#57F287', [], fields, false));
        }

        if (sub === 'kapat') {
            const current = await db.getVanityConfig(guildId);
            if (!current || !current.is_enabled) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Sistem Zaten Kapalı`,
                    'Özel durum rol sistemi bu sunucuda zaten aktif değil.',
                    '#ED4245', [], [], false
                ));
            }

            await db.setVanityConfig(guildId, current.vanity_string, current.role_id, current.log_channel_id, false);

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Sistem Kapatıldı`,
                'Özel durum rol sistemi başarıyla devre dışı bırakıldı.',
                '#ED4245', [], [], false
            ));
        }

        if (sub === 'durum') {
            const config = await db.getVanityConfig(guildId);
            if (!config) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Ayar Bulunamadı`,
                    'Bu sunucuda henüz bir özel durum rolü yapılandırılmamış. `/vanity-rol ayarla` ile kurabilirsiniz.',
                    '#5865F2', [], [], false
                ));
            }

            const title = `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Özel Durum Rol Durumu`;
            const desc = `Sunucunun özel durum ödül sistemi yapılandırması:`;
            const fields = [
                { name: 'Sistem Durumu', value: config.is_enabled ? `<:mono:${MONO_EMOJIS.active || '1530917454174355557'}> Aktif` : `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Devre Dışı`, inline: true },
                { name: 'Aranan Metin', value: `\`${config.vanity_string}\``, inline: true },
                { name: 'Ödül Rolü', value: `<@&${config.role_id}>`, inline: true },
                { name: 'Log Kanalı', value: config.log_channel_id ? `<#${config.log_channel_id}>` : '`Ayarlanmadı`', inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, config.is_enabled ? '#57F287' : '#95A5A6', [], fields, false));
        }
    }
};
