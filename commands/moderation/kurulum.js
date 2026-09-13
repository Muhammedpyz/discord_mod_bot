const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { okRows, ozRows, okSecim } = require('../../utils/kurulumHandler');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('oto-kurulum')
            .setDescription('Tek tıkla sunucu kurulumu (log, karşılama, sayaç, doğrulama).')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            okSecim.set(interaction.user.id, { log: true, welcome: true, sayac: false, verify: false, t: Date.now() });
            await interaction.editReply(createContainerMessage('Oto Kurulum', 'Kurulacak sistemleri seç, sonra başlat:\n\n-# Kanallar ve roller otomatik oluşturulur.', '#5865F2', okRows(okSecim.get(interaction.user.id))));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('özelleştir')
            .setDescription('Karşılama/ayrılış mesajlarını özelleştirirsin.')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            await interaction.editReply(createContainerMessage('Özelleştirme', 'Hangi mesajı düzenlemek istiyorsun?\n\n-# Değişkenler: {user} {server} {count}', '#5865F2', ozRows()));
        }
    }
];
