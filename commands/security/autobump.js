const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autobump')
        .setDescription('Disboard /bump süresi dolduğunda otomatik hatırlatma gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Bump hatırlatma sistemini kurar.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Hatırlatma mesajının gönderileceği kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('etiket_rol')
                        .setDescription('Bump zamanı geldiğinde etiketlenecek rol')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Bump hatırlatıcıyı devre dışı bırakır.')
        )
        .addSubcommand(sub =>
            sub.setName('durum')
                .setDescription('Bump hatırlatma sisteminin durumunu ve son bump zamanını gösterir.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'ayarla') {
            const channel = interaction.options.getChannel('kanal');
            const role = interaction.options.getRole('etiket_rol');

            await db.setAutoBumpConfig(guildId, channel.id, role ? role.id : null, true);

            const title = `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Auto-Bump Sistemi Kuruldu`;
            const desc = `Disboard ile sunucu patlatıldığında (bump yapıldığında), 2 saatlik bekleme süresi biter bitmez bot bu kanala otomatik bildirim atacaktır.`;
            const fields = [
                { name: 'Bildirim Kanalı', value: `<#${channel.id}>`, inline: true },
                { name: 'Etiketlenecek Rol', value: role ? `<@&${role.id}>` : '`Rol Belirtilmedi`', inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#57F287', [], fields, false));
        }

        if (sub === 'kapat') {
            const current = await db.getAutoBumpConfig(guildId);
            if (!current || !current.is_enabled) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Zaten Kapalı`,
                    'Auto-Bump sistemi bu sunucuda zaten aktif değil.',
                    '#ED4245', [], [], false
                ));
            }

            await db.setAutoBumpConfig(guildId, current.channel_id, current.ping_role_id, false);

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Sistem Kapatıldı`,
                'Auto-Bump hatırlatma sistemi devre dışı bırakıldı.',
                '#ED4245', [], [], false
            ));
        }

        if (sub === 'durum') {
            const config = await db.getAutoBumpConfig(guildId);
            if (!config) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Ayar Bulunamadı`,
                    'Bu sunucuda henüz Auto-Bump kurulmamış. `/autobump ayarla` ile kurabilirsiniz.',
                    '#5865F2', [], [], false
                ));
            }

            let nextBumpText = '`Bilinmiyor / Henüz bump yapılmadı`';
            if (config.last_bump_time > 0) {
                const nextBumpEpoch = Math.floor((config.last_bump_time + (2 * 60 * 60 * 1000)) / 1000);
                nextBumpText = `<t:${nextBumpEpoch}:R> (<t:${nextBumpEpoch}:F>)`;
            }

            const title = `<:mono:${MONO_EMOJIS.timer || '1537767794551296061'}> Auto-Bump Durumu`;
            const desc = `Disboard sunucu patlatma hatırlatıcısı:`;
            const fields = [
                { name: 'Sistem Durumu', value: config.is_enabled ? `<:mono:${MONO_EMOJIS.active || '1530917454174355557'}> Aktif` : `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Devre Dışı`, inline: true },
                { name: 'Bildirim Kanalı', value: `<#${config.channel_id}>`, inline: true },
                { name: 'Etiket Rolü', value: config.ping_role_id ? `<@&${config.ping_role_id}>` : '`Yok`', inline: true },
                { name: 'Sıradaki Bump Zamanı', value: nextBumpText, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, config.is_enabled ? '#57F287' : '#95A5A6', [], fields, false));
        }
    }
};
