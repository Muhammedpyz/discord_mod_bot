const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Sunucudaki kullanıcı, rol, bot ve emojileri filtreleyerek listeler.')
        .addSubcommand(sub =>
            sub.setName('admins')
                .setDescription('Sunucudaki tüm Yöneticileri (Administrator) listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('mods')
                .setDescription('Sunucudaki Moderatör yetkisine sahip yetkilileri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('bots')
                .setDescription('Sunucudaki tüm botları listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('boosters')
                .setDescription('Sunucuya takviye (Boost) basan üyeleri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('roles')
                .setDescription('Sunucudaki tüm rolleri ve üye sayılarını listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('inrole')
                .setDescription('Belirli bir role sahip tüm üyeleri listeler.')
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('Listelenecek rol')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('invoice')
                .setDescription('Ses kanallarında bulunan tüm üyeleri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('early')
                .setDescription('Sunucuya ilk katılan en kıdemli üyeleri listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('emojis')
                .setDescription('Sunucuya özel yüklenmiş emojileri listeler.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        await guild.members.fetch();

        if (sub === 'admins') {
            const admins = guild.members.cache.filter(m => !m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
            const list = admins.map(m => `• <@${m.id}> (\`${m.id}\`)`).join('\n') || '*Yönetici bulunamadı.*';

            const title = `<:mono:${MONO_EMOJIS.owner || '1537768132062486558'}> Sunucu Yöneticileri (${admins.size})`;
            const desc = `Yönetici (Administrator) yetkisine sahip kullanıcılar:`;
            const fields = [{ name: 'Yöneticiler', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#ED4245', [], fields, false));
        }

        if (sub === 'mods') {
            const mods = guild.members.cache.filter(m => !m.user.bot && (
                m.permissions.has(PermissionFlagsBits.BanMembers) ||
                m.permissions.has(PermissionFlagsBits.KickMembers) ||
                m.permissions.has(PermissionFlagsBits.ManageMessages)
            ));
            const list = mods.map(m => `• <@${m.id}> (\`${m.id}\`)`).join('\n') || '*Moderatör bulunamadı.*';

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Moderatör Kadrosu (${mods.size})`;
            const desc = `Moderasyon yetkisine sahip yetkili üyeler:`;
            const fields = [{ name: 'Moderatörler', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'bots') {
            const bots = guild.members.cache.filter(m => m.user.bot);
            const list = bots.map(m => `• <@${m.id}> (\`${m.user.tag}\`)`).join('\n') || '*Bot bulunamadı.*';

            const title = `<:mono:${MONO_EMOJIS.bot || '1530917505374228551'}> Sunucu Botları (${bots.size})`;
            const desc = `Sunucuda bulunan aktif botlar:`;
            const fields = [{ name: 'Botlar', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'boosters') {
            const boosters = guild.members.cache.filter(m => m.premiumSince);
            const list = boosters.map(m => `• <@${m.id}> ➔ Takviye: <t:${Math.floor(m.premiumSinceTimestamp / 1000)}:R>`).join('\n') || '*Sunucuya takviye basan üye yok.*';

            const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Sunucu Takviyeleri (${boosters.size} Booster | Seviye ${guild.premiumTier})`;
            const desc = `Sunucumuza takviye basan destekçi üyeler:`;
            const fields = [{ name: 'Booster Listesi', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#F47B67', [], fields, false));
        }

        if (sub === 'roles') {
            const roles = Array.from(guild.roles.cache.values())
                .filter(r => r.name !== '@everyone')
                .sort((a, b) => b.position - a.position);

            const list = roles.slice(0, 30).map(r => `• <@&${r.id}> ➔ \`${r.members.size}\` üye`).join('\n') + (roles.length > 30 ? `\n*...ve ${roles.length - 30} rol daha*` : '');

            const title = `<:mono:${MONO_EMOJIS.roles || '1537768133501128827'}> Sunucu Rolleri (${roles.length})`;
            const desc = `Rol hiyerarşisi ve rol başına üye sayıları:`;
            const fields = [{ name: 'Roller', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'inrole') {
            const role = interaction.options.getRole('rol');
            const members = Array.from(role.members.values());

            const list = members.length > 0
                ? members.slice(0, 35).map(m => `• <@${m.id}> (\`${m.id}\`)`).join('\n') + (members.length > 35 ? `\n*...ve ${members.length - 35} kişi daha*` : '')
                : '*Bu role sahip üye bulunmuyor.*';

            const title = `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Roldeki Üyeler: ${role.name} (${members.length})`;
            const desc = `<@&${role.id}> rolüne sahip olan kullanıcılar:`;
            const fields = [{ name: 'Üye Listesi', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'invoice') {
            const voiceMembers = guild.members.cache.filter(m => m.voice.channel);
            const list = voiceMembers.size > 0
                ? Array.from(voiceMembers.values()).slice(0, 30).map(m => `• <@${m.id}> ➔ <#${m.voice.channelId}>`).join('\n') + (voiceMembers.size > 30 ? `\n*...ve ${voiceMembers.size - 30} kişi daha*` : '')
                : '*Şu an ses kanallarında kimse yok.*';

            const title = `<:mono:${MONO_EMOJIS.voice || '1530917498763804822'}> Sesteki Üyeler (${voiceMembers.size})`;
            const desc = `Ses kanallarında aktif olan kullanıcılar:`;
            const fields = [{ name: 'Sestekiler', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#57F287', [], fields, false));
        }

        if (sub === 'early') {
            const sorted = Array.from(guild.members.cache.values())
                .filter(m => !m.user.bot && m.joinedTimestamp)
                .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
                .slice(0, 20);

            const list = sorted.map((m, idx) => `**${idx + 1}.** <@${m.id}> ➔ <t:${Math.floor(m.joinedTimestamp / 1000)}:D>`).join('\n');

            const title = `<:mono:${MONO_EMOJIS.timer || '1537767794551296061'}> İlk Katılan Kadim Üyeler (Top 20)`;
            const desc = `Sunucuya en erken katılmış olan ilk 20 üye:`;
            const fields = [{ name: 'Kadim Üyeler', value: list, inline: false }];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }

        if (sub === 'emojis') {
            const emojis = Array.from(guild.emojis.cache.values());
            if (emojis.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Emoji Yok`,
                    'Sunucuya yüklenmiş herhangi bir özel emoji bulunmuyor.',
                    '#5865F2', [], [], false
                ));
            }

            const staticEmojis = emojis.filter(e => !e.animated);
            const animatedEmojis = emojis.filter(e => e.animated);

            const title = `<:mono:${MONO_EMOJIS.disc || '1537767765103083541'}> Sunucu Emojileri (${emojis.length})`;
            const desc = `Sunucuya yüklenmiş olan özel emojiler:`;
            const fields = [
                { name: `Statik Emojiler (${staticEmojis.length})`, value: staticEmojis.map(e => `${e}`).slice(0, 40).join(' ') || '*Yok*', inline: false },
                { name: `Hareketli / GIF Emojiler (${animatedEmojis.length})`, value: animatedEmojis.map(e => `${e}`).slice(0, 40).join(' ') || '*Yok*', inline: false }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }
    }
};
