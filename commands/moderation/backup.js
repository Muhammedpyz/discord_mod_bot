'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { createBackup, listBackups, restoreBackup } = require('../../utils/backupManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Sunucu yapılandırma yedekleme ve geri yükleme sistemi')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('al')
               .setDescription('Sunucu kanallarını, rollerini ve izinlerini JSON olarak yedekler.')
        )
        .addSubcommand(sub =>
            sub.setName('liste')
               .setDescription('Bu sunucuya ait mevcut yedek dosyalarını listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('yukle')
               .setDescription('Daha önce alınmış bir yedeği sunucuya geri yükler.')
               .addStringOption(opt =>
                   opt.setName('id')
                      .setDescription('Geri yüklenecek yedeğin ID numarası (örn: 1787401234567)')
                      .setRequired(true)
               )
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const subCmd = interaction.options.getSubcommand(false) || 'al';

        // 1. YEDEK AL (CREATE BACKUP)
        if (subCmd === 'al') {
            try {
                const result = await createBackup(interaction.guild);
                const desc = [
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Sunucu başarıyla yedeklendi!**`,
                    ``,
                    `> • **Yedek ID:** \`${result.backupId}\``,
                    `> • **Kategoriler:** \`${result.backupData.categories.length} Adet\``,
                    `> • **Kanallar:** \`${result.backupData.channels.text.length + result.backupData.channels.voice.length} Adet\``,
                    `> • **Roller:** \`${result.backupData.roles.length} Adet\``,
                    `> • **Üye Kayıtları:** \`${result.backupData.members.length} Kişi\``,
                    ``,
                    `*İhtiyaç anında bu yedeği geri yüklemek için:* \`/backup yukle id:${result.backupId}\``
                ].join('\n');

                const replyMsg = createContainerMessage(
                    'Sunucu Yedeği Alındı',
                    desc,
                    COLORS.SUCCESS || '#57F287'
                );
                replyMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(replyMsg);
            } catch (error) {
                console.error('[Backup Error]:', error);
                const errorMsg = createContainerMessage(
                    'Yedekleme Başarısız',
                    `Yedekleme oluşturulurken bir hata meydana geldi:\n\`${error.message}\``,
                    COLORS.ERROR || '#ED4245'
                );
                errorMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(errorMsg);
            }
        }

        // 2. YEDEKLERİ LİSTELE (LIST BACKUPS)
        else if (subCmd === 'liste') {
            try {
                const backups = listBackups(interaction.guild.id);
                if (backups.length === 0) {
                    const emptyMsg = createContainerMessage(
                        'Mevcut Yedek Bulunamadı',
                        'Bu sunucu için henüz kaydedilmiş bir yedek dosyası bulunmuyor.\n`/backup al` komutuyla yeni bir yedek oluşturabilirsiniz.',
                        COLORS.PRIMARY || '#5865F2'
                    );
                    emptyMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                    return await interaction.editReply(emptyMsg);
                }

                const lines = backups.slice(0, 10).map((b, idx) => {
                    const timeSec = Math.floor(b.timestamp / 1000);
                    const timeTag = isNaN(timeSec) ? '' : `<t:${timeSec}:f> (<t:${timeSec}:R>)`;
                    return [
                        `**[${idx + 1}] Yedek ID:** \`${b.backupId}\``,
                        `> • **Tarih:** ${timeTag}`,
                        `> • **İçerik:** \`${b.categoriesCount} Kategori\` | \`${b.channelsCount} Kanal\` | \`${b.rolesCount} Rol\``,
                        `> • **Yükleme Komutu:** \`/backup yukle id:${b.backupId}\``
                    ].join('\n');
                });

                const listPayload = createContainerMessage(
                    `Sunucu Yedekleri (${backups.length} Adet)`,
                    lines.join('\n\n'),
                    COLORS.PRIMARY || '#5865F2'
                );
                listPayload.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(listPayload);
            } catch (error) {
                console.error('[Backup List Error]:', error);
                const errorMsg = createContainerMessage(
                    'Hata',
                    `Yedekler listelenirken bir hata oluştu:\n\`${error.message}\``,
                    COLORS.ERROR || '#ED4245'
                );
                errorMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(errorMsg);
            }
        }

        // 3. YEDEKTEN GERİ YÜKLE (RESTORE BACKUP)
        else if (subCmd === 'yukle') {
            const backupId = interaction.options.getString('id').trim();
            try {
                const progressMsg = createContainerMessage(
                    'Yedek Geri Yükleniyor...',
                    `\`${backupId}\` ID'li yedek dosyası okunuyor ve sunucu yapısı yeniden oluşturuluyor. Lütfen bekleyin...`,
                    COLORS.WARNING || '#FEE75C'
                );
                progressMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(progressMsg);

                const result = await restoreBackup(interaction.guild, backupId);

                const successMsg = createContainerMessage(
                    'Yedek Başarıyla Geri Yüklendi',
                    [
                        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> **Geri yükleme işlemi tamamlandı!**`,
                        ``,
                        `> • **Oluşturulan Yeni Roller:** \`${result.rolesRestored} Adet\``,
                        `> • **Oluşturulan Yeni Kategoriler:** \`${result.categoriesRestored} Adet\``,
                        `> • **Oluşturulan Yeni Kanallar:** \`${result.channelsRestored} Adet\``,
                        ``,
                        `*Tüm kanal izinleri ve hiyerarşi başarıyla eşitlendi.*`
                    ].join('\n'),
                    COLORS.SUCCESS || '#57F287'
                );
                successMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(successMsg);
            } catch (error) {
                console.error('[Backup Restore Error]:', error);
                const errorMsg = createContainerMessage(
                    'Geri Yükleme Başarısız',
                    `Yedek geri yüklenirken hata oluştu:\n\`${error.message}\``,
                    COLORS.ERROR || '#ED4245'
                );
                errorMsg.flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
                await interaction.editReply(errorMsg);
            }
        }
    }
};
