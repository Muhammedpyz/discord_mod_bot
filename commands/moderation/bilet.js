const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bilet')
        .setDescription('Destek talebine kullanıcı ekler veya çıkarır.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Bilete bir kullanıcı ekler.')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Eklenecek kullanıcı').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('çıkar')
                .setDescription('Biletten bir kullanıcıyı çıkarır.')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Çıkarılacak kullanıcı').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!interaction.channel.name.startsWith('destek-')) {
            return interaction.reply({ content: 'Bu komut sadece destek talebi (bilet) kanallarında kullanılabilir.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();
        const subCmd = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('kullanıcı');

        try {
            if (subCmd === 'ekle') {
                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                const payload = createContainerMessage(
                    'Kullanıcı Eklendi',
                    `**<@${targetUser.id}>** bu destek talebine dahil edildi.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);

            } else if (subCmd === 'çıkar') {
                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: false,
                    SendMessages: false,
                    ReadMessageHistory: false
                });

                const payload = createContainerMessage(
                    'Kullanıcı Çıkarıldı',
                    `**<@${targetUser.id}>** bu destek talebinden çıkarıldı.`,
                    '#2B2D31'
                );
                await interaction.editReply(payload);
            }
        } catch (error) {
            console.error("Bilet komutu hatası:", error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' });
        }
    }
};
