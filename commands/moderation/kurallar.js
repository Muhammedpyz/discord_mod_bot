const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kurallar')
        .setDescription('Kurallar paneli yayınlar (Kabul Et butonlu).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(o => o.setName('kanal').setDescription('Panel kanalı').setRequired(true))
        .addStringOption(o => o.setName('metin').setDescription('Kurallar metni').setRequired(true).setMaxLength(3000))
        .addRoleOption(o => o.setName('rol').setDescription('Kabul edene verilecek rol').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const kanal = interaction.options.getChannel('kanal');
        const metin = interaction.options.getString('metin');
        const rol = interaction.options.getRole('rol');
        try {
            if (!kanal.isTextBased()) {
                return interaction.editReply(createContainerMessage('Hata', 'Metin kanalı seçmelisin.', '#ED4245', [], [], false, true));
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kural_kabul').setLabel('Kabul Ediyorum').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check)
            );
            const payload = createContainerMessage('Sunucu Kuralları', metin, '#5865F2', [row]);
            const msg = await kanal.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
            await db.pool.query('INSERT INTO kurallar_config (guild_id, channel_id, message_id, metin, rol_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=VALUES(message_id), metin=VALUES(metin), rol_id=VALUES(rol_id)', [interaction.guild.id, kanal.id, msg.id, metin, rol ? rol.id : null]);
            await interaction.editReply(createContainerMessage('Yayınlandı', `<:mono:${MONO_EMOJIS.check}> Kurallar <#${kanal.id}> kanalına kuruldu.`, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[Kurallar]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem başarısız.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
