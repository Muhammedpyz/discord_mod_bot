const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ozel-komut')
        .setDescription('Sunucuya özel metin/yanıt komutları oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('ekle')
                .setDescription('Yeni bir özel komut ekler.')
                .addStringOption(opt => opt.setName('tetikleyici').setDescription('Komut kelimesi (örn: !kurallar, sa)').setRequired(true))
                .addStringOption(opt => opt.setName('yanit').setDescription('Botun vereceği cevap ({user}, {server}, {membercount} destekler)').setRequired(true))
                .addStringOption(opt => opt.setName('tur').setDescription('Yanıt türü').setRequired(false).addChoices(
                    { name: 'Düz Metin', value: 'plain' },
                    { name: 'Kart (V2 Container)', value: 'embed' }
                ))
                .addStringOption(opt => opt.setName('buton-yazi').setDescription('Kart modunda link butonu yazısı (isteğe bağlı)').setRequired(false))
                .addStringOption(opt => opt.setName('buton-link').setDescription('Kart modunda link butonu URL (isteğe bağlı)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Mevcut bir özel komutu siler.')
                .addStringOption(opt => opt.setName('tetikleyici').setDescription('Silinecek komut kelimesi').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Sunucudaki özel komutları listeler.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();

        let conn;
        try {
            conn = await db.pool.getConnection();

            if (sub === 'ekle') {
                const trigger = interaction.options.getString('tetikleyici').toLowerCase();
                const response = interaction.options.getString('yanit');
                const type = interaction.options.getString('tur') || 'plain';
                const btnLabel = interaction.options.getString('buton-yazi') || null;
                let btnUrl = interaction.options.getString('buton-link') || null;
                if (btnUrl && !/^https?:\/\//i.test(btnUrl)) btnUrl = null;

                await conn.query(
                    'INSERT INTO custom_commands (guild_id, trigger_word, response_text, reply_type, created_by, button_label, button_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [interaction.guild.id, trigger, response, type, interaction.user.id, btnLabel, btnUrl]
                );
                require('../../utils/customCommandHandler').clearCommandCache(interaction.guild.id);

                await interaction.editReply(createContainerMessage('Özel Komut Eklendi', `<:mono:${MONO_EMOJIS.check}> Chate **${trigger}** yazıldığında bot şu yanıtı verecek:\n\n\`${response.slice(0, 500)}\`${btnUrl ? `\n\n-# Buton: ${btnLabel || 'Bağlantı'}` : ''}`, '#57F287'));
            }
            else if (sub === 'sil') {
                const trigger = interaction.options.getString('tetikleyici').toLowerCase();
                const res = await conn.query('DELETE FROM custom_commands WHERE guild_id = ? AND trigger_word = ?', [interaction.guild.id, trigger]);
                require('../../utils/customCommandHandler').clearCommandCache(interaction.guild.id);

                if (res.affectedRows > 0) {
                    await interaction.editReply(createContainerMessage('Silindi', `**${trigger}** komutu silindi.`, '#57F287', [], [], false, true));
                } else {
                    await interaction.editReply(createContainerMessage('Hata', 'Böyle bir komut bulunamadı.', '#ED4245', [], [], false, true));
                }
            }
            else if (sub === 'liste') {
                const cmds = await conn.query('SELECT trigger_word, reply_type FROM custom_commands WHERE guild_id = ?', [interaction.guild.id]);
                if (cmds.length === 0) return interaction.editReply(createContainerMessage('Bilgi', 'Hiç özel komutun yok.', '#3498DB'));

                let list = '';
                cmds.forEach(c => {
                    list += `• **${c.trigger_word}** (${c.reply_type === 'embed' ? 'kart' : 'düz metin'})\n`;
                });

                await interaction.editReply(createContainerMessage('Özel Komutlar', list, '#5865F2'));
            }
        } catch (e) {
            console.error('Custom cmd err:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'Bir sorun oluştu.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
