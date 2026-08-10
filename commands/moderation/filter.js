const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder } = require('discord.js');
const { pool } = require('../../db');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kara-liste')
        .setDescription('Sunucudaki yasaklı kelime filtresini yonetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Yasakli listesine yeni bir kelime ekler.')
                .addStringOption(option => option.setName('kelime').setDescription('Yasaklanacak kelime').setRequired(true))
                .addStringOption(option => 
                    option.setName('tur')
                        .setDescription('Kelime nasil eslesecek?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Tam Eslesme', value: 'exact' },
                            { name: 'Içerme (Cumle icinde)', value: 'includes' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Yasakli listesinden bir kelimeyi cikarir.')
                .addStringOption(option => option.setName('kelime').setDescription('Cikarilacak kelime').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Yasakli kelimeler listesini gösterir.')
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();
        let conn;

        try {
            conn = await pool.getConnection();

            if (subCmd === 'ekle') {
                const word = interaction.options.getString('kelime').toLowerCase();
                const matchType = interaction.options.getString('tur');
                
                await conn.query(`
                    INSERT INTO filtered_words (guild_id, word, match_type, action)
                    VALUES (?, ?, ?, 'delete')
                    ON DUPLICATE KEY UPDATE match_type = ?
                `, [interaction.guild.id, word, matchType, matchType]);
                
                return interaction.reply({ content: `**"${word}"** kelimesi (${matchType === 'exact' ? 'Tam Eslesme' : 'Içerme'}) başarıyla kara listeye eklenmistir.`, flags: MessageFlags.Ephemeral });
            }

            if (subCmd === 'sil') {
                const word = interaction.options.getString('kelime').toLowerCase();
                const result = await conn.query('DELETE FROM filtered_words WHERE guild_id = ? AND word = ?', [interaction.guild.id, word]);
                
                if (result.affectedRows > 0) {
                    return interaction.reply({ content: `**"${word}"** kelimesi kara listeden cikarilmistir.`, flags: MessageFlags.Ephemeral });
                } else {
                    return interaction.reply({ content: `Belirtilen **"${word}"** kelimesi sistem kara listesinde bulunamadı.`, flags: MessageFlags.Ephemeral });
                }
            }

            if (subCmd === 'liste') {
                const rows = await conn.query('SELECT word, match_type FROM filtered_words WHERE guild_id = ?', [interaction.guild.id]);
                if (!rows || rows.length === 0) {
                    return interaction.reply({ content: 'Sistem kara listesi su an bostur.', flags: MessageFlags.Ephemeral });
                }
                
                const wordList = rows.map(r => `* ${r.word} (${r.match_type === 'exact' ? 'Tam Eslesme' : 'Içerme'})`).join('\n');
                
                if (wordList.length > 4000) {
                    const buffer = Buffer.from(wordList, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: 'kara-liste.txt' });
                    
                    return interaction.reply({ 
                        content: 'Kara liste sinir asimina ugradigi için size metin belgesi olarak iletilmistir.', 
                        files: [attachment],
                        flags: MessageFlags.Ephemeral 
                    });
                }
                
                const payload = createContainerMessage(
                    'Sistem Kara Listesi',
                    (wordList || "Liste bos (Sistemsel Hata)") + `\n\n*Toplam ${rows.length} adet engellenmis kelime bulunmaktadir.*`,
                    '#2B2D31'
                );
                    
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

        } catch (error) {
            console.error('Filter hatası:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'İşlem sırasında sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'İşlem sırasında sistemsel bir hata oluştu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        } finally {
            if (conn) conn.release();
        }
    }
};
