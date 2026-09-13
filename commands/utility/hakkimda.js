const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hakkımda')
        .setDescription('Profilindeki hakkında yazısını ayarlar.')
        .addStringOption(o => o.setName('yazi').setDescription('Hakkında yazın (boş bırakılırsa silinir)').setRequired(false).setMaxLength(300)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const yazi = interaction.options.getString('yazi');
        try {
            if (!yazi) {
                await db.pool.query('UPDATE user_profiles SET bio = NULL WHERE user_id = ?', [interaction.user.id]);
                return interaction.editReply(createContainerMessage('Silindi', 'Hakkında yazın silindi.', '#57F287', [], [], false, true));
            }
            await db.pool.query('INSERT INTO user_profiles (user_id, bio) VALUES (?, ?) ON DUPLICATE KEY UPDATE bio=VALUES(bio)', [interaction.user.id, yazi]);
            await interaction.editReply(createContainerMessage('Kaydedildi', `<:mono:${MONO_EMOJIS.check}> Hakkında yazın güncellendi:\n\n\`${yazi}\``, '#57F287', [], [], false, true));
        } catch (e) {
            console.error('[Hakkımda]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Kaydedilemedi.', '#ED4245', [], [], false, true)).catch(() => {});
        }
    }
};
