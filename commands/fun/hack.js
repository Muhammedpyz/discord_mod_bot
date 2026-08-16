const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hack')
        .setDescription('Seçilen kullanıcıyı mizahi bir animasyonla hackler (Şaka).')
        .addUserOption(opt =>
            opt.setName('kullanici')
                .setDescription('Hacklenecek kullanıcı')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('kullanici');
        const fakeIp = `${Math.floor(Math.random()*200)+10}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
        const fakeEmails = ['tatlicocuk123@gmail.com', 'gamer_kral@hotmail.com', 'gizli_ajan@yandex.com', 'pro_hacker@yahoo.com'];
        const randomEmail = fakeEmails[Math.floor(Math.random() * fakeEmails.length)];

        const title = `<:mono:${MONO_EMOJIS.terminal || '1530917506867400775'}> Terminal: Hedef Saldırı Altında (${target.username})`;
        const lines = [
            `\`[OK]\` Hedef IP Adresi Bulundu: \`${fakeIp}\``,
            `\`[OK]\` E-posta Veritabanı Ele Geçirildi: \`${randomEmail}\``,
            `\`[OK]\` Discord Şifresi Çözüldü: \`*******12345\``,
            `\`[OK]\` Son Google Aramaları İndirildi: *"Anime kızları gerçek mi?"*`,
            `\`[OK]\` Roblox Hesabı Satışa Çıkarıldı (0.005 BTC)`,
            `\`[BİTTİ]\` <@${target.id}> başarıyla hacklendi! Bilgileri Dark Web'e yüklendi.`
        ];

        return interaction.editReply(createContainerMessage(title, lines.join('\n'), '#57F287', [], [], false));
    }
};
