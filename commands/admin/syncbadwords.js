const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../../db');
const { COLORS } = require('../../utils/embeds');
const { createContainerMessage } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syncbadwords')
        .setDescription('Github üzerinden Türkçe küfür karalistesini veritabanına otomatik ekler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // İşlem uzun sürebileceği için deferReply kullanıyoruz
        await interaction.deferReply();

        try {
            // Github'dan güncel listeyi çek
            const response = await fetch('https://raw.githubusercontent.com/ooguz/turkce-kufur-karaliste/master/karaliste.txt');
            if (!response.ok) {
                return interaction.editReply({ content: 'Github listesine ulaşılamadı!' });
            }

            const text = await response.text();
            
            // Satır satır ayır ve boşlukları/boş satırları temizle
            const words = text.split('\n')
                .map(w => w.trim())
                .filter(w => w.length > 0);

            let conn;
            try {
                conn = await pool.getConnection();

                // 1. Sunucudaki mevcut kelimeleri al (Aynı kelimeyi 2 kez eklememek için)
                const existingRows = await conn.query('SELECT word FROM filtered_words WHERE guild_id = ?', [interaction.guild.id]);
                const existingWords = new Set(existingRows.map(row => row.word.toLowerCase()));

                // 2. Yeni eklenecek kelimeleri filtrele
                const newWords = words.filter(word => !existingWords.has(word.toLowerCase()));

                if (newWords.length === 0) {
                    return interaction.editReply({ content: 'Veritabanınız zaten güncel. Eklenecek yeni bir küfür bulunamadı.' });
                }

                // 3. MariaDB'ye Toplu (Batch) Ekleme Hazırlığı
                // (Her kelime için -> [guild_id, word, 'includes', 'warn'] formatında array oluştur)
                const values = newWords.map(word => [interaction.guild.id, word, 'includes', 'warn']);

                // batch insert
                await conn.batch(
                    'INSERT INTO filtered_words (guild_id, word, match_type, action) VALUES (?, ?, ?, ?)',
                    values
                );

                const payload = createContainerMessage(
                    'Karaliste Güncellendi',
                    `Github üzerinden Türkçe Küfür Karalistesi başarıyla çekildi.\n\n**Toplam Eklenen Kelime:** ${newWords.length}`,
                    COLORS.SUCCESS
                );

                await interaction.editReply(payload);

            } catch (dbError) {
                console.error("Veritabanı hatası:", dbError);
                await interaction.editReply({ content: 'Kelimeler veritabanına eklenirken hata oluştu.' });
            } finally {
                if (conn) conn.release();
            }

        } catch (error) {
            console.error('API/Fetch hatası:', error);
            await interaction.editReply({ content: 'Karaliste çekilirken bir hata oluştu.' });
        }
    }
};
