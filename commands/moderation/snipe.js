const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Kanal icerisinde silinen son mesaji goruntuler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
    async execute(interaction, client) {
        try { await interaction.deferReply(); } catch(e) { return; }
        try {
            const snipe = client.snipes.get(interaction.channel.id);

            if (!snipe) {
                return await interaction.editReply({ content: 'Sistem kayitlarina gore bu kanalda yakin zamanda silinmis bir mesaj bulunmamaktadır.' }).catch(() => {});
            }

            const payload = createContainerMessage(
                `Silinen Mesaj Kaydi: ${snipe.author.tag}`,
                (snipe.content || '*[Sadece Medya Icerigi Veya Bos Mesaj]*') + `\n\n*Silinme Zamani: <t:${Math.floor(snipe.timestamp / 1000)}:R>*` + (snipe.image ? `\n[Medya Dosyasi](${snipe.image})` : ''),
                '#2B2D31'
            );

            await interaction.editReply(payload).catch(() => {});
        } catch (error) {
            console.error('Snipe hatası:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
