const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Kanal, rol, emoji ve üye katılım istatistiklerini görüntüler.')
        .addSubcommand(sub =>
            sub.setName('channelinfo')
                .setDescription('Bir kanalın detaylı bilgilerini ve ayarlarını gösterir.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('İncelenecek kanal')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('roleinfo')
                .setDescription('Bir rolün renk, hiyerarşi, üye sayısı ve temel bilgilerini gösterir.')
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('İncelenecek rol')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('roleperms')
                .setDescription('Bir rolün sahip olduğu Discord yetki matrisini dökümler.')
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('Yetkileri incelenecek rol')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('emptyroles')
                .setDescription('Sunucuda içinde 0 üye olan boş rolleri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('lastjoins')
                .setDescription('Sunucuya en son katılan son 15 yeni üyeyi listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('joinpos')
                .setDescription('Bir kullanıcının sunucuya tam olarak kaçıncı sırada katıldığını gösterir.')
                .addUserOption(opt =>
                    opt.setName('kullanici')
                        .setDescription('Sırası öğrenilecek kullanıcı')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (sub === 'channelinfo') {
            const channel = interaction.options.getChannel('kanal') || interaction.channel;

            const typeNames = {
                0: 'Metin Kanalı (GuildText)',
                2: 'Ses Kanalı (GuildVoice)',
                4: 'Kategori (GuildCategory)',
                5: 'Duyuru Kanalı (GuildAnnouncement)',
                15: 'Forum Kanalı (GuildForum)',
                13: 'Sahne Kanalı (GuildStageVoice)'
            };

            const typeStr = typeNames[channel.type] || `Tür: ${channel.type}`;
            const createdEpoch = Math.floor(channel.createdTimestamp / 1000);

            const title = `<:mono:${MONO_EMOJIS.text_channel || '1537767793162846208'}> Kanal Bilgisi: #${channel.name}`;
            const desc = `Kanal yapılandırması ve detayları:`;
            const fields = [
                { name: 'Kanal ID', value: `\`${channel.id}\``, inline: true },
                { name: 'Kanal Türü', value: `\`${typeStr}\``, inline: true },
                { name: 'Kategori', value: channel.parent ? channel.parent.name : '`Yok`', inline: true },
                { name: 'Oluşturulma', value: `<t:${createdEpoch}:F> (<t:${createdEpoch}:R>)`, inline: true },
                { name: 'Yavaş Mod (Slowmode)', value: channel.rateLimitPerUser ? `\`${channel.rateLimitPerUser} saniye\`` : '`Kapalı`', inline: true },
                { name: 'NSFW (Yaş Sınırı)', value: channel.nsfw ? '`EVET`' : '`HAYIR`', inline: true }
            ];

            if (channel.topic) {
                fields.push({ name: 'Kanal Konusu', value: `> ${channel.topic}`, inline: false });
            }

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'roleinfo') {
            const role = interaction.options.getRole('rol');
            const createdEpoch = Math.floor(role.createdTimestamp / 1000);

            const title = `<:mono:${MONO_EMOJIS.roles || '1537768133501128827'}> Rol Bilgisi: @${role.name}`;
            const desc = `Rol detayları ve özellikleri:`;
            const fields = [
                { name: 'Rol ID', value: `\`${role.id}\``, inline: true },
                { name: 'Rol Rengi', value: `\`${role.hexColor}\``, inline: true },
                { name: 'Hiyerarşi Sırası', value: `\`${role.position}\` / \`${guild.roles.cache.size}\``, inline: true },
                { name: 'Üye Sayısı', value: `\`${role.members.size}\` üye`, inline: true },
                { name: 'Ayrı Gösterim (Hoist)', value: role.hoist ? '`EVET`' : '`HAYIR`', inline: true },
                { name: 'Etiketlenebilir', value: role.mentionable ? '`EVET`' : '`HAYIR`', inline: true },
                { name: 'Oluşturulma', value: `<t:${createdEpoch}:F> (<t:${createdEpoch}:R>)`, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, role.hexColor === '#000000' ? '#5865F2' : role.hexColor, [], fields, false));
        }

        if (sub === 'roleperms') {
            const role = interaction.options.getRole('rol');
            const perms = role.permissions.toArray();

            const permList = perms.length > 0
                ? perms.map(p => `• \`${p}\``).join('\n')
                : '*Bu rolün herhangi bir özel izin bayrağı bulunmuyor.*';

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Rol Yetki Matrisi: @${role.name}`;
            const desc = `<@&${role.id}> rolünün sahip olduğu aktif Discord izinleri (${perms.length}):`;
            const fields = [{ name: 'Aktif Yetkiler', value: permList, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'emptyroles') {
            await guild.members.fetch();
            const emptyRoles = guild.roles.cache.filter(r => r.name !== '@everyone' && r.members.size === 0);

            if (emptyRoles.size === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Temiz Rol Yapısı`,
                    'Sunucuda içinde 0 üye bulunan herhangi bir boş rol bulunmuyor.',
                    '#57F287', [], [], false
                ));
            }

            const list = Array.from(emptyRoles.values()).slice(0, 35).map(r => `• <@&${r.id}> (\`${r.id}\`)`).join('\n') + (emptyRoles.size > 35 ? `\n*...ve ${emptyRoles.size - 35} rol daha*` : '');

            const title = `<:mono:${MONO_EMOJIS.warn || '1530917488806727761'}> Boş Roller (${emptyRoles.size})`;
            const desc = `Aşağıdaki rollerde hiç üye bulunmuyor (Gereksiz ise silinebilir):`;
            const fields = [{ name: 'Boş Roller', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#FEE75C', [], fields, false));
        }

        if (sub === 'lastjoins') {
            await guild.members.fetch();
            const sorted = Array.from(guild.members.cache.values())
                .filter(m => m.joinedTimestamp)
                .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
                .slice(0, 15);

            const list = sorted.map((m, idx) => `**${idx + 1}.** <@${m.id}> ➔ <t:${Math.floor(m.joinedTimestamp / 1000)}:R> (\`${m.id}\`)`).join('\n');

            const title = `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Son Katılan Üyeler (Son 15)`;
            const desc = `Sunucuya en son katılan yeni kullanıcılar:`;
            const fields = [{ name: 'Yeni Üyeler', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'joinpos') {
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;
            await guild.members.fetch();

            const sorted = Array.from(guild.members.cache.values())
                .filter(m => m.joinedTimestamp)
                .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);

            const index = sorted.findIndex(m => m.id === targetUser.id);
            if (index === -1) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Bulunamadı`,
                    'Kullanıcı sunucu üyeleri arasında bulunamadı.',
                    '#ED4245', [], [], false
                ));
            }

            const position = index + 1;
            const targetMember = sorted[index];
            const joinedEpoch = Math.floor(targetMember.joinedTimestamp / 1000);

            const title = `<:mono:${MONO_EMOJIS.timer || '1537767794551296061'}> Katılım Sırası: ${targetUser.username}`;
            const desc = `<@${targetUser.id}> kullanıcısının sunucuya giriş sırası:`;
            const fields = [
                { name: 'Katılım Sırası (Join Pos)', value: `**#${position}** / \`${guild.memberCount}\``, inline: true },
                { name: 'Katılma Tarihi', value: `<t:${joinedEpoch}:F> (<t:${joinedEpoch}:R>)`, inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#57F287', [], fields, false));
        }
    }
};
