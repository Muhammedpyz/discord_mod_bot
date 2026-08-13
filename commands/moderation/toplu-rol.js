const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toplu-rol')
        .setDescription('Belirtilen hedefteki kullanıcılara toplu rol verir veya alır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Toplu rol verir.')
                .addRoleOption(option => option.setName('rol').setDescription('Verilecek rol').setRequired(true))
                .addStringOption(option => 
                    option.setName('hedef')
                        .setDescription('Hedef kitle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Herkes', value: 'herkes' },
                            { name: 'Üyeler (Bot olmayanlar)', value: 'uyeler' },
                            { name: 'Botlar', value: 'botlar' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('al')
                .setDescription('Toplu rol alır.')
                .addRoleOption(option => option.setName('rol').setDescription('Alınacak rol').setRequired(true))
                .addStringOption(option => 
                    option.setName('hedef')
                        .setDescription('Hedef kitle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Herkes', value: 'herkes' },
                            { name: 'Üyeler (Bot olmayanlar)', value: 'uyeler' },
                            { name: 'Botlar', value: 'botlar' }
                        )
                )
        ),

    async execute(interaction) {
        try { await interaction.deferReply(); } catch(e) { return; }
        try {
            const subcommand = interaction.options.getSubcommand();
            const role = interaction.options.getRole('rol');
            const target = interaction.options.getString('hedef');

            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            if (botMember.roles.highest.position <= role.position) {
                return await interaction.editReply({ content: 'Bu rol benim en yüksek rolümden daha üstte veya aynı sırada, işlem yapamam.' }).catch(() => {});
            }
            if (interaction.user.id !== interaction.guild.ownerId) {
                if (interaction.member.roles.highest.position <= role.position) {
                    return await interaction.editReply({ content: 'Bu rol sizin en yüksek rolünüzden daha üstte veya aynı sırada.' }).catch(() => {});
                }
            }

            const members = await interaction.guild.members.fetch();
            let targetMembers = members;
            if (target === 'uyeler') {
                targetMembers = members.filter(m => !m.user.bot);
            } else if (target === 'botlar') {
                targetMembers = members.filter(m => m.user.bot);
            }

            const membersArray = Array.from(targetMembers.values());
            let count = 0;

            await interaction.editReply(createContainerMessage(
                `${EMOJIS.status} İşlem Başladı`,
                `Toplam ${membersArray.length} üye üzerinde işlem yapılıyor. Lütfen bekleyin...`,
                '#2B2D31'
            )).catch(() => {});

            for (const member of membersArray) {
                try {
                    if (subcommand === 'ver' && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                    } else if (subcommand === 'al' && member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                    }
                } catch (e) {
                    // Ignore errors for individual members
                }
                
                count++;
                if (count % 25 === 0) {
                    await interaction.editReply(createContainerMessage(
                        `${EMOJIS.status} İşlem Devam Ediyor`,
                        `Durum: ${count}/${membersArray.length} tamamlandı.`,
                        '#2B2D31'
                    )).catch(() => {});
                }
                
                // Small delay to prevent rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const actionStr = subcommand === 'ver' ? 'verildi' : 'alındı';
            
            const payload = createContainerMessage(
                `${EMOJIS.check} İşlem Tamamlandı`,
                `Başarıyla ${membersArray.length} üyeden rol ${actionStr}.`,
                '#2B2D31'
            );
            await interaction.editReply(payload).catch(() => {});

            const logPayload = createContainerMessage(
                'Toplu Rol İşlemi',
                '',
                '#2B2D31',
                [],
                [
                    { name: 'Rol', value: `${role}`, inline: true },
                    { name: 'Hedef', value: target, inline: true },
                    { name: 'İşlem', value: actionStr, inline: true },
                    { name: 'Etkilenen', value: `${membersArray.length}`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user}`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        }
    }
};
