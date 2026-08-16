const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('Sunucu koruma kalkanını ve Anti-Nuke sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Anti-Nuke kalkanını açar, kapatır veya ceza türünü ayarlar.')
                .addStringOption(opt =>
                    opt.setName('durum')
                        .setDescription('Kalkan durumu')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Aktif Et', value: 'on' },
                            { name: 'Devre Dışı Bırak', value: 'off' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('ceza_turu')
                        .setDescription('Saldırgana uygulanacak yaptırım')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Yönetici Rollerini Al (Önerilen)', value: 'strip_roles' },
                            { name: 'Sunucudan At (Kick)', value: 'kick' },
                            { name: 'Sunucudan Yasakla (Ban)', value: 'ban' }
                        )
                )
                .addChannelOption(opt =>
                    opt.setName('log_kanali')
                        .setDescription('Kalkan bildirimlerinin gönderileceği kanal')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('whitelist')
                .setDescription('Güvenilir kullanıcı veya rolleri Anti-Nuke korumasından muaf tutar.')
                .addStringOption(opt =>
                    opt.setName('islem')
                        .setDescription('Yapılacak işlem')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Ekle', value: 'add' },
                            { name: 'Kaldır', value: 'remove' },
                            { name: 'Listele', value: 'list' }
                        )
                )
                .addUserOption(opt =>
                    opt.setName('kullanici')
                        .setDescription('Güvenli listeye eklenecek/çıkarılacak kullanıcı')
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('Güvenli listeye eklenecek/çıkarılacak rol')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('limits')
                .setDescription('Seri eylem eşik limitlerini özelleştirir.')
                .addIntegerOption(opt => opt.setName('kanal_sil_limit').setDescription('10 saniyede silinebilecek maksimum kanal (Varsayılan: 3)').setMinValue(1).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('kanal_ac_limit').setDescription('10 saniyede açılabilecek maksimum kanal (Varsayılan: 3)').setMinValue(1).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('rol_sil_limit').setDescription('10 saniyede silinebilecek maksimum rol (Varsayılan: 3)').setMinValue(1).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('rol_ac_limit').setDescription('10 saniyede açılabilecek maksimum rol (Varsayılan: 3)').setMinValue(1).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('ban_limit').setDescription('10 saniyede yasaklanabilecek maksimum üye (Varsayılan: 4)').setMinValue(1).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('kick_limit').setDescription('10 saniyede atılabilecek maksimum üye (Varsayılan: 4)').setMinValue(1).setMaxValue(20))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Anti-Nuke kalkanının mevcut durumunu, limitlerini ve güvenli listesini gösterir.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'setup') {
            const durum = interaction.options.getString('durum') === 'on';
            const ceza = interaction.options.getString('ceza_turu');
            const logChannel = interaction.options.getChannel('log_kanali');

            const current = await db.getAntiNukeConfig(guildId) || {};
            await db.setAntiNukeConfig(guildId, {
                ...current,
                is_enabled: durum,
                punishment: ceza || current.punishment || 'strip_roles',
                log_channel_id: logChannel ? logChannel.id : current.log_channel_id
            });

            const cezaTr = {
                'strip_roles': 'Yönetici Rollerini Al',
                'kick': 'Sunucudan At (Kick)',
                'ban': 'Sunucudan Yasakla (Ban)'
            }[ceza || current.punishment || 'strip_roles'];

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Anti-Nuke Kalkanı Güncellendi`;
            const desc = `Sunucu koruma kalkanı başarıyla yapılandırıldı.`;
            const fields = [
                { name: 'Kalkan Durumu', value: durum ? `<:mono:${MONO_EMOJIS.active || '1530917454174355557'}> Aktif` : `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Devre Dışı`, inline: true },
                { name: 'Yaptırım Türü', value: `\`${cezaTr}\``, inline: true },
                { name: 'Log Kanalı', value: logChannel ? `<#${logChannel.id}>` : (current.log_channel_id ? `<#${current.log_channel_id}>` : '`Ayarlanmadı`'), inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, durum ? '#57F287' : '#ED4245', [], fields, false));
        }

        if (sub === 'whitelist') {
            const islem = interaction.options.getString('islem');
            const user = interaction.options.getUser('kullanici');
            const role = interaction.options.getRole('rol');

            if (islem === 'list') {
                const list = await db.getAntiNukeWhitelist(guildId);
                const userList = list.filter(w => w.target_type === 'user').map(w => `<@${w.target_id}> (\`${w.target_id}\`)`).join('\n') || '*Ekli kullanıcı yok.*';
                const roleList = list.filter(w => w.target_type === 'role').map(w => `<@&${w.target_id}> (\`${w.target_id}\`)`).join('\n') || '*Ekli rol yok.*';

                const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Anti-Nuke Güvenli Listesi (Whitelist)`;
                const desc = `Korumadan muaf tutulan yetkili ve roller:`;
                const fields = [
                    { name: 'Güvenilir Kullanıcılar', value: userList, inline: false },
                    { name: 'Güvenilir Roller', value: roleList, inline: false }
                ];
                return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
            }

            if (!user && !role) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Eksik Parametre`,
                    'Lütfen eklemek veya kaldırmak için bir **kullanıcı** veya **rol** belirtin.',
                    '#ED4245', [], [], false
                ));
            }

            const targetId = user ? user.id : role.id;
            const targetType = user ? 'user' : 'role';
            const targetMention = user ? `<@${user.id}>` : `<@&${role.id}>`;

            if (islem === 'add') {
                await db.addAntiNukeWhitelist(guildId, targetId, targetType, interaction.user.id);
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Güvenli Listeye Eklendi`,
                    `${targetMention} başarıyla Anti-Nuke koruma kalkanından muaf tutuldu.`,
                    '#57F287', [], [], false
                ));
            } else if (islem === 'remove') {
                await db.removeAntiNukeWhitelist(guildId, targetId);
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Güvenli Listeden Çıkarıldı`,
                    `${targetMention} Anti-Nuke güvenli listesinden kaldırıldı.`,
                    '#57F287', [], [], false
                ));
            }
        }

        if (sub === 'limits') {
            const current = await db.getAntiNukeConfig(guildId) || {};
            const chDel = interaction.options.getInteger('kanal_sil_limit');
            const chCr = interaction.options.getInteger('kanal_ac_limit');
            const rDel = interaction.options.getInteger('rol_sil_limit');
            const rCr = interaction.options.getInteger('rol_ac_limit');
            const bLim = interaction.options.getInteger('ban_limit');
            const kLim = interaction.options.getInteger('kick_limit');

            const updatedData = {
                ...current,
                channel_delete_limit: chDel ?? current.channel_delete_limit ?? 3,
                channel_create_limit: chCr ?? current.channel_create_limit ?? 3,
                role_delete_limit: rDel ?? current.role_delete_limit ?? 3,
                role_create_limit: rCr ?? current.role_create_limit ?? 3,
                ban_limit: bLim ?? current.ban_limit ?? 4,
                kick_limit: kLim ?? current.kick_limit ?? 4
            };

            await db.setAntiNukeConfig(guildId, updatedData);

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Eşik Limitleri Güncellendi`;
            const desc = `Anti-Nuke kalkanının 10 saniyelik seri işlem limitleri ayarlandı.`;
            const fields = [
                { name: 'Kanal Silme / Açma', value: `\`${updatedData.channel_delete_limit} / ${updatedData.channel_create_limit}\``, inline: true },
                { name: 'Rol Silme / Açma', value: `\`${updatedData.role_delete_limit} / ${updatedData.role_create_limit}\``, inline: true },
                { name: 'Ban / Kick Limiti', value: `\`${updatedData.ban_limit} / ${updatedData.kick_limit}\``, inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#57F287', [], fields, false));
        }

        if (sub === 'status') {
            const config = await db.getAntiNukeConfig(guildId) || {};
            const whitelist = await db.getAntiNukeWhitelist(guildId) || [];

            const isEnabled = config.is_enabled;
            const cezaTr = {
                'strip_roles': 'Yönetici Rollerini Al',
                'kick': 'Sunucudan At (Kick)',
                'ban': 'Sunucudan Yasakla (Ban)'
            }[config.punishment || 'strip_roles'];

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Anti-Nuke Kalkan Durumu`;
            const desc = `Sunucunun genel güvenlik ve baskın koruma durumu aşağıda listelenmiştir.`;
            const fields = [
                { name: 'Kalkan Durumu', value: isEnabled ? `<:mono:${MONO_EMOJIS.active || '1530917454174355557'}> Aktif` : `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Devre Dışı`, inline: true },
                { name: 'Yaptırım Şekli', value: `\`${cezaTr}\``, inline: true },
                { name: 'Log Kanalı', value: config.log_channel_id ? `<#${config.log_channel_id}>` : '`Ayarlanmadı`', inline: true },
                { name: 'Kanal Limitleri (10s)', value: `Sil: \`${config.channel_delete_limit || 3}\` | Aç: \`${config.channel_create_limit || 3}\``, inline: true },
                { name: 'Rol Limitleri (10s)', value: `Sil: \`${config.role_delete_limit || 3}\` | Aç: \`${config.role_create_limit || 3}\``, inline: true },
                { name: 'Ceza Limitleri (10s)', value: `Ban: \`${config.ban_limit || 4}\` | Kick: \`${config.kick_limit || 4}\``, inline: true },
                { name: 'Bot & Webhook Koruması', value: `<:mono:${MONO_EMOJIS.active || '1530917454174355557'}> Tam Koruma (İzinsiz bot/webhook otomatik engellenir)`, inline: false },
                { name: 'Güvenli Liste Boyutu', value: `\`${whitelist.length}\` adet muaf kullanıcı / rol`, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, isEnabled ? '#57F287' : '#95A5A6', [], fields, false));
        }
    }
};
