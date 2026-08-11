const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage } = require('../../utils/uiBuilder');
const { createBackup } = require('../../utils/backupManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Create a comprehensive backup of the server configuration.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await createBackup(interaction.guild);
            
            const replyMsg = createContainerMessage(
                'Yedekleme (Backup) Başarılı',
                `Sunucunun tüm ayarları, rolleri ve kanalları başarıyla yedeklendi.\n\nDosya Adı: \`${result.fileName}\``
            );
            
            await interaction.editReply(replyMsg);
        } catch (error) {
            console.error('Backup Error:', error);
            
            const errorMsg = createContainerMessage(
                'Yedekleme Başarısız',
                'Yedekleme oluşturulurken bir hata meydana geldi. Lütfen logları kontrol edin.'
            );
            
            await interaction.editReply(errorMsg);
        }
    }
};
