const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Kanal icerisinde silinen son mesaji goruntuler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
    async execute(interaction, client) {
        try {
            const snipe = client.snipes.get(interaction.channel.id);

            if (!snipe) {
                return interaction.reply({ content: 'Sistem kayitlarina gore bu kanalda yakin zamanda silinmis bir mesaj bulunmamaktadir.', flags: MessageFlags.Ephemeral });
            }

            const payload = createContainerMessage(
                `Silinen Mesaj Kaydi: ${snipe.author.tag}`,
                (snipe.content || '*[Sadece Medya Icerigi Veya Bos Mesaj]*') + `\n\n*Silinme Zamani: <t:${Math.floor(snipe.timestamp / 1000)}:R>*` + (snipe.image ? `\n[Medya Dosyasi](${snipe.image})` : ''),
                '#2F3136'
            );

            await interaction.reply(payload);
        } catch (error) {
            console.error('Snipe hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Islem gerceklestirilirken bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Islem gerceklestirilirken bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
