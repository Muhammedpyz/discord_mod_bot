const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder } = require('discord.js');
const { pool, clearFilteredWordsCache, updateAutoModConfigCache } = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Sunucudaki özel yasaklı kelime filtresini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ekle')
                .setDescription('Yasaklı listesine yeni bir kelime ekler.')
                .addStringOption(option => option.setName('kelime').setDescription('Yasaklanacak kelime').setRequired(true))
                .addStringOption(option => 
                    option.setName('tur')
                        .setDescription('Kelime nasıl eşleşecek?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Tam Eşleşme (Sadece tek başına geçince)', value: 'exact' },
                            { name: 'İçerme (Cümle içinde herhangi bir yerde geçince)', value: 'includes' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sil')
                .setDescription('Yasaklı listesinden bir kelimeyi çıkarır.')
                .addStringOption(option => option.setName('kelime').setDescription('Çıkarılacak kelime').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Yasaklı kelimeler listesini gösterir.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const subCmd = interaction.options.getSubcommand();
        let conn;

        try {
            conn = await pool.getConnection();

            if (subCmd === 'ekle') {
                const word = interaction.options.getString('kelime').toLowerCase().trim();
                const matchType = interaction.options.getString('tur');
                
                await conn.query(`
                    INSERT INTO filtered_words (guild_id, word, match_type, action)
                    VALUES (?, ?, ?, 'delete')
                    ON DUPLICATE KEY UPDATE match_type = ?
                `, [interaction.guild.id, word, matchType, matchType]);

                // Kelime eklenince AutoMod üzerinde özel kelime filtresi otomatik aktif edilir
                await conn.query(`
                    INSERT INTO automod_config (guild_id, custom_words_enabled)
                    VALUES (?, 1)
                    ON DUPLICATE KEY UPDATE custom_words_enabled = 1
                `, [interaction.guild.id]);

                clearFilteredWordsCache(interaction.guild.id);
                const updatedCfg = await conn.query('SELECT * FROM automod_config WHERE guild_id = ?', [interaction.guild.id]);
                if (updatedCfg.length > 0) updateAutoModConfigCache(interaction.guild.id, updatedCfg[0]);

                const payload = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Yasaklı Kelime Eklendi`,
                    `**"${word}"** ifadesi (${matchType === 'exact' ? 'Tam Eşleşme' : 'Cümle İçi İçerme'}) başarıyla karalisteye eklendi.\n\n` +
                    `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **AutoMod Koruması:** Özel kelime denetimi **otomatik olarak aktif** edildi.`,
                    '#2B2D31'
                );
                return await interaction.editReply(payload);
            }

            if (subCmd === 'sil') {
                const word = interaction.options.getString('kelime').toLowerCase().trim();
                const result = await conn.query('DELETE FROM filtered_words WHERE guild_id = ? AND word = ?', [interaction.guild.id, word]);
                
                clearFilteredWordsCache(interaction.guild.id);

                // Kalan kelime kontrolü
                const remaining = await conn.query('SELECT COUNT(*) as c FROM filtered_words WHERE guild_id = ?', [interaction.guild.id]);
                const remainingCount = Number(remaining[0]?.c || 0);
                if (remainingCount === 0) {
                    await conn.query('UPDATE automod_config SET custom_words_enabled = 0 WHERE guild_id = ?', [interaction.guild.id]);
                }

                if (result.affectedRows > 0) {
                    const payload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.check || '1530917534885478600'}> Kelime Kaldırıldı`,
                        `**"${word}"** ifadesi karalistedeki kelimeler arasından çıkarıldı.\nKalan yasaklı kelime sayısı: **${remainingCount}**`,
                        '#2B2D31'
                    );
                    return await interaction.editReply(payload);
                } else {
                    const payload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Kelime Bulunamadı`,
                        `Belirtilen **"${word}"** ifadesi sunucu karalistesinde mevcut değil.`,
                        '#2B2D31'
                    );
                    return await interaction.editReply(payload);
                }
            }

            if (subCmd === 'liste') {
                const rows = await conn.query('SELECT word, match_type FROM filtered_words WHERE guild_id = ? ORDER BY id ASC', [interaction.guild.id]);
                if (!rows || rows.length === 0) {
                    const payload = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.message_square || '1537768184851996702'}> Yasaklı Kelime Listesi`,
                        `Bu sunucuda tanımlanmış herhangi bir özel yasaklı kelime bulunmuyor.\n\n` +
                        `*Not: Botun yerleşik küfür koruması arka planda bağımsız olarak çalışmaya devam etmektedir.*`,
                        '#2B2D31'
                    );
                    return await interaction.editReply(payload);
                }
                
                const wordList = rows.map((r, i) => `**${i + 1}.** \`${r.word}\` (${r.match_type === 'exact' ? 'Tam Eşleşme' : 'İçerme'})`).join('\n');
                
                if (wordList.length > 3800) {
                    const buffer = Buffer.from(rows.map(r => r.word).join('\n'), 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: 'yasakli-kelimeler.txt' });
                    
                    return await interaction.editReply({ 
                        content: 'Karaliste limiti aştığı için dosya olarak iletildi.', 
                        files: [attachment]
                    });
                }
                
                const payload = createContainerMessage(
                    `<:mono:${MONO_EMOJIS.message_square || '1537768184851996702'}> Yasaklı Kelimeler (${rows.length})`,
                    wordList + `\n\n- # Toplam ${rows.length} adet özel engellenmiş kelime aktif korumada.`,
                    '#2B2D31'
                );
                    
                return await interaction.editReply(payload);
            }

        } catch (error) {
            console.error('Filter hatası:', error);
            await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' }).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
