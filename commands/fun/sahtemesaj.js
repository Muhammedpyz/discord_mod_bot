const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sahtemesaj')
        .setDescription('Seçilen kullanıcının adına kanalda sahte webhook mesajı yazdırır (Trol).')
        .addUserOption(opt =>
            opt.setName('kullanici')
                .setDescription('Adına mesaj yazılacak kullanıcı')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('mesaj')
                .setDescription('Kullanıcının ağzından yazılacak mesaj')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Kanalda webhook oluşturma yetkisi kontrolü
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
            return interaction.reply({
                ...createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Yetki Yetersiz`,
                    'Bu komutun çalışabilmesi için botun `Webhookları Yönet` yetkisine sahip olması gerekir.',
                    '#ED4245', [], [], false
                ),
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser('kullanici');
        const content = interaction.options.getString('mesaj');
        const channel = interaction.channel;

        try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const displayName = member ? member.displayName : targetUser.username;
            const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 512 });

            const webhook = await channel.createWebhook({
                name: displayName,
                avatar: avatarURL,
                reason: `Sahte Mesaj Komutu: ${interaction.user.tag}`
            });

            await webhook.send({
                content: content,
                username: displayName,
                avatarURL: avatarURL
            });

            // Webhook'u temizle
            await webhook.delete('Temizlik').catch(() => {});

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Mesaj Gönderildi!`,
                `<@${targetUser.id}> adına sahte mesaj başarıyla kanala yazıldı.`,
                '#57F287', [], [], false
            ));
        } catch (error) {
            console.error('Sahtemesaj hatası:', error);
            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                'Mesaj gönderilirken bir hata oluştu: ' + error.message,
                '#ED4245', [], [], false
            ));
        }
    }
};
