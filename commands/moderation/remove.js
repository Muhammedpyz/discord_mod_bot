const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { pool } = require('../../db');
const { createV2Message, COLORS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Kullanıcının aktif ceza veya uyarı kayıtlarını pasife alır.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('İşlem yapılacak kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { return; }
        
        try {
            const targetUser = interaction.options.getUser('kullanıcı');
            
            // Veritabanından tüm aktif cezaları çekelim
            const warns = await pool.query('SELECT id, reason, created_at, moderator_id, "warn" as type FROM warnings WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUser.id]);
            const mutes = await pool.query('SELECT id, reason, created_at, moderator_id, action_type as type FROM mutes WHERE guild_id = ? AND user_id = ? AND is_active = TRUE', [interaction.guild.id, targetUser.id]);
            
            const allRecords = [...warns, ...mutes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 25);

            if (allRecords.length === 0) {
                return interaction.editReply({ content: `✅ **${targetUser.username}** kullanıcısının şu an aktif hiçbir cezası/uyarısı bulunmamaktadır.` });
            }

            let listText = `**${targetUser.username}** kullanıcısının aktif cezaları:\n\n`;

            const options = allRecords.map((w, index) => {
                let typeName = w.type === 'warn' ? 'Uyarı' : (w.type === 'text_mute' ? 'Metin Susturma' : (w.type === 'voice_mute' ? 'Ses Susturma' : 'Ban'));
                let labelStr = `${typeName} #${w.id} - ${w.reason || 'Belirtilmemiş'}`;
                if (labelStr.length > 100) labelStr = labelStr.substring(0, 97) + '...';
                
                const date = new Date(w.created_at).toLocaleDateString('tr-TR');
                
                listText += `\`#${w.id}\` **${typeName}** • Yetkili: <@${w.moderator_id || 'Bilinmiyor'}>\n└ Sebep: ${w.reason || 'Belirtilmemiş'} (${date})\n\n`;

                return {
                    label: labelStr,
                    description: `Tarih: ${date} | Yetkili: ${w.moderator_id || 'Sistem'}`,
                    value: `remove_${w.type}_${w.id}`
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`sorgu:remove_menu:${targetUser.id}`)
                .setPlaceholder('Silmek (pasife almak) istediğiniz kaydı seçin')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const payload = createV2Message({
                title: 'Ceza / Uyarı Kaldırma (Pasife Alma)',
                description: `${listText}Aşağıdaki menüden silmek (pasife almak) istediğiniz kaydı seçiniz.`,
                color: COLORS.DARK,
                actionRows: [row]
            });

            await interaction.editReply(payload);

        } catch (error) {
            console.error('Remove komutu hatası:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' });
        }
    }
};
