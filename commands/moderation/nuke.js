const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Mevcut kanalı siler ve aynı ayarlarla yeniden oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const channel = interaction.channel;
            
            const btnYes = new ButtonBuilder()
                .setCustomId('nuke_yes')
                .setLabel('Evet')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(MONO_EMOJIS.flame);

            const btnNo = new ButtonBuilder()
                .setCustomId('nuke_no')
                .setLabel('Hayır')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(MONO_EMOJIS.cross);

            const actionRow = new ActionRowBuilder().addComponents(btnYes, btnNo);

            const confirmPayload = createContainerMessage(
                `${EMOJIS.warning} Kanal Sıfırlama Onayı`,
                'Bu işlem geri alınamaz! Mevcut kanaldaki tüm mesajlar kalıcı olarak silinecektir. Emin misiniz?',
                '#2B2D31',
                [actionRow]
            );

            const replyMsg = await interaction.editReply(confirmPayload);

            const filter = i => i.user.id === interaction.user.id;
            const collector = replyMsg.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 15000 });

            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId === 'nuke_yes') {
                    collector.stop('accepted');
                    const position = channel.position;
                    
                    const newChannel = await channel.clone({
                        name: channel.name,
                        topic: channel.topic,
                        position: channel.position,
                        parent: channel.parentId,
                        permissionOverwrites: channel.permissionOverwrites.cache
                    });
                    
                    await newChannel.setPosition(position);
                    await channel.delete();

                    const successPayload = createContainerMessage(
                        `${EMOJIS.delete} Kanal Sıfırlandı`,
                        'Kanal başarıyla sıfırlandı.',
                        '#2B2D31'
                    );
                    await newChannel.send(successPayload);

                    const logPayload = createContainerMessage(
                        'Kanal Sıfırlandı (Nuke)',
                        '',
                        '#2B2D31',
                        [],
                        [
                            { name: 'Kanal', value: `<#${newChannel.id}>`, inline: true },
                            { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true }
                        ]
                    );
                    await sendLog(interaction.guild, logPayload);
                } else {
                    collector.stop('declined');
                    const cancelPayload = createContainerMessage(
                        `${EMOJIS.cross} İşlem İptal Edildi`,
                        'Kanal sıfırlama işlemi iptal edildi.',
                        '#2B2D31'
                    );
                    await interaction.editReply({ ...cancelPayload, components: [] }).catch(() => {});
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    const timeoutPayload = createContainerMessage(
                        `${EMOJIS.cross} Zaman Aşımı`,
                        'Onay süresi doldu.',
                        '#2B2D31'
                    );
                    interaction.editReply({ ...timeoutPayload, components: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
