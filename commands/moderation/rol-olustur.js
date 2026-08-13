const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createContainerMessage, EMOJIS } = require('../../utils/uiBuilder');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol-olustur')
        .setDescription('Yeni bir rol oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option => option.setName('isim').setDescription('Rol ismi').setRequired(true))
        .addStringOption(option => option.setName('renk').setDescription('Rol rengi (Örn: #FF0000)').setRequired(false))
        .addBooleanOption(option => option.setName('ayrilmis').setDescription('Rol kullanıcılardan ayrı gösterilsin mi?').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const name = interaction.options.getString('isim');
            const color = interaction.options.getString('renk');
            const hoist = interaction.options.getBoolean('ayrilmis') || false;

            const role = await interaction.guild.roles.create({
                name: name,
                color: color || undefined,
                hoist: hoist,
                reason: `${interaction.user.tag} tarafından oluşturuldu.`
            });

            const payload = createContainerMessage(
                `${EMOJIS.add} Rol Oluşturuldu`,
                `${role} rolü başarıyla oluşturuldu.`,
                '#2B2D31'
            );
            await interaction.editReply(payload);

            const logPayload = createContainerMessage(
                'Rol Oluşturuldu',
                '',
                '#2B2D31',
                [],
                [
                    { name: 'Rol', value: `${role}`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user}`, inline: true }
                ]
            );
            await sendLog(interaction.guild, logPayload);

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu. Renk kodunu doğru yazdığınızdan emin olun (Örn: #FF0000).' }).catch(() => {});
        }
    }
};
