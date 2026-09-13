const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yapiskan')
        .setDescription('Kanalın en altına yapışan mesaj oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Bu kanala yapışkan mesaj ekler.')
                .addStringOption(opt => opt.setName('icerik').setDescription('Mesaj içeriği').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kaldir')
                .setDescription('Bu kanaldaki yapışkan mesajı kaldırır.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();

        let conn;
        try {
            conn = await db.pool.getConnection();

            if (sub === 'ayarla') {
                const content = interaction.options.getString('icerik');

                await conn.query(
                    "INSERT INTO sticky_messages (channel_id, guild_id, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content=?, message_id=NULL",
                    [interaction.channel.id, interaction.guild.id, content, content]
                );

                const msg = createContainerMessage('Başarılı', `<:mono:${MONO_EMOJIS.pin || '1531752490691854528'}> Bu kanala yapışkan mesaj başarıyla eklendi.`, '#57F287');
                await interaction.editReply(msg);
                
                // İlk mesajı atalım
                const stickyPayload = createContainerMessage(
                    'Onemli Bilgi', 
                    `<:mono:${MONO_EMOJIS.pin || '1531752490691854528'}> ${content}`, 
                    '#FEE75C'
                );
                const sentMsg = await interaction.channel.send({ ...stickyPayload, flags: MessageFlags.IsComponentsV2 });
                await conn.query("UPDATE sticky_messages SET message_id = ? WHERE channel_id = ?", [sentMsg.id, interaction.channel.id]);
            } 
            else if (sub === 'kaldir') {
                const [res] = await conn.query("DELETE FROM sticky_messages WHERE channel_id = ?", [interaction.channel.id]);
                if (res.affectedRows > 0) {
                    await interaction.editReply(createContainerMessage('Başarılı', 'Yapışkan mesaj kaldırıldı.', '#ED4245', [], [], false, true));
                } else {
                    await interaction.editReply(createContainerMessage('Hata', 'Bu kanalda yapışkan mesaj yok.', '#ED4245', [], [], false, true));
                }
            }
        } catch (e) {
            console.error('Sticky cmd err:', e);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    }
};
