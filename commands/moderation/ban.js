const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../../utils/uiBuilder'); // Fixed to uiBuilder if COLORS is exported there, wait, prompt says utils/uiBuilder.js has COLORS.
const { createContainerMessage, createV2Message, EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');
const { validateModTarget } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Kullaniciyi sunucudan yasaklar.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Yasaklanacak kullanici')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Yasaklama sebebi')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('Silinecek mesaj gecmisi (Gun)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Belirtilmedi';
            const deleteDays = interaction.options.getInteger('delete_messages') || 0;

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            const check = validateModTarget(interaction, targetUser, targetMember);
            if (!check.valid) {
                return interaction.reply({ content: check.reason, flags: MessageFlags.Ephemeral });
            }

            try {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Yasaga Itiraz Et')
                        .setURL('https://forms.gle/ornek-itiraz-formu-linki') 
                        .setStyle(ButtonStyle.Link)
                );

                const dmPayload = createContainerMessage(
                    'Sunucudan Yasaklandiniz', 
                    `**${interaction.guild.name}** sunucusunda yasaklandiniz.\n**Sebep:** ${reason}\n\nEger bu yasagin haksiz oldugunu dusunuyorsaniz asagidaki butona tiklayarak itiraz formunu doldurabilirsiniz.`,
                    '#FF0000',
                    [row]
                );

                await targetUser.send(dmPayload);
            } catch (dmError) {
                console.log('Kullaniciya DM gonderilemedi.');
            }

            let conn;
            try {
                conn = await pool.getConnection();
                const [configRows] = await conn.query('SELECT banned_role_id FROM guild_config WHERE guild_id = ?', [interaction.guild.id]);
                
                if (configRows.length === 0 || !configRows[0].banned_role_id) {
                    return interaction.reply({ content: 'Sunucu icin "Banlisin" rolu ayarlanmamis. Lutfen ayarlari kontrol edin.', flags: MessageFlags.Ephemeral });
                }

                const bannedRoleId = configRows[0].banned_role_id;
                
                if (!targetMember) {
                    return interaction.reply({ content: 'Kullanici sunucuda bulunamadi. Rol bani atilabilmesi icin kullanicinin sunucuda olmasi gerekir.', flags: MessageFlags.Ephemeral });
                }

                const rolesToKeep = targetMember.roles.cache
                    .filter(r => !r.editable || r.id === interaction.guild.id)
                    .map(r => r.id);
                
                if (!rolesToKeep.includes(bannedRoleId)) {
                    rolesToKeep.push(bannedRoleId);
                }
                
                await targetMember.roles.set(rolesToKeep, `Moderator: ${interaction.user.tag} | Sebep: ${reason}`);

                const payload = createContainerMessage(
                    `${EMOJIS.ban} Kullanici Yasaklandi`,
                    `<@${targetUser.id}> adli kullaniciya yasakli rolu verildi ve diger rolleri alindi.\n**Sebep:** ${reason}`,
                    '#FF0000'
                );
                
                await interaction.reply(payload);

                const logPayload = createContainerMessage(
                    'Kullanici Yasaklandi',
                    '',
                    '#FF0000',
                    [],
                    [
                        { name: 'Yasaklanan Uye', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Sebep', value: reason, inline: false }
                    ]
                );
                
                await sendLog(interaction.guild, logPayload);
            } finally {
                if (conn) conn.release();
            }
        } catch (error) {
            console.error('Ban hatasi:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Islem sirasinda bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Islem sirasinda bir hata olustu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
