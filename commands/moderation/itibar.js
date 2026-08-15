const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { pool } = require('../../db');

function getMonoEmoji(name) {
    const id = MONO_EMOJIS[name];
    if (!id) return '';
    return `<:mono:${id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('itibar')
        .setDescription('İtibar sistemi')
        .addSubcommand(subcmd => 
            subcmd.setName('ver')
                .setDescription('Bir kullanıcıya itibar puanı ver')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('goruntule')
                .setDescription('Kullanıcının itibar puanını görüntüle')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(false))
        ),

    async execute(interaction) {
        try { await interaction.deferReply(); } catch(e) { return; }
        let conn;
        try {
            conn = await pool.getConnection();
            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;

            const eCrown = getMonoEmoji('crown') || getMonoEmoji('sparkles');
            const eCross = getMonoEmoji('cross') || getMonoEmoji('delete');
            const eCheck = getMonoEmoji('check') || getMonoEmoji('verify');

            if (subcommand === 'ver') {
                if (targetUser.id === interaction.user.id) {
                    const payload = buildModBResponse({
                        title: `${eCross} İşlem Başarısız`,
                        textLines: ['Kendinize itibar puanı veremezsiniz.']
                    });
                    return await interaction.editReply(payload).catch(() => {});
                }
                if (targetUser.bot) {
                    const payload = buildModBResponse({
                        title: `${eCross} İşlem Başarısız`,
                        textLines: ['Botlara itibar puanı veremezsiniz.']
                    });
                    return await interaction.editReply(payload).catch(() => {});
                }

                const [cooldownRes] = await conn.query('SELECT last_given FROM rep_cooldown WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, interaction.user.id]);
                if (cooldownRes) {
                    const lastGiven = new Date(cooldownRes.last_given).getTime();
                    const now = Date.now();
                    const diffHours = (now - lastGiven) / (1000 * 60 * 60);
                    if (diffHours < 24) {
                        const remaining = Math.ceil(24 - diffHours);
                        const payload = buildModBResponse({
                            title: `${eCross} Bekleme Süresi`,
                            textLines: [`Tekrar itibar puanı verebilmek için **${remaining} saat** beklemelisiniz.`]
                        });
                        return await interaction.editReply(payload).catch(() => {});
                    }
                }

                await conn.query('INSERT INTO reputation (guild_id, user_id, given_by) VALUES (?, ?, ?)', [interaction.guild.id, targetUser.id, interaction.user.id]);
                await conn.query('INSERT INTO rep_cooldown (guild_id, user_id, last_given) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE last_given = CURRENT_TIMESTAMP', [interaction.guild.id, interaction.user.id]);

                const payload = buildModBResponse({
                    title: `${eCheck} İtibar Verildi`,
                    textLines: [`<@${targetUser.id}> kullanıcısına başarıyla +1 itibar puanı verdiniz!`],
                    thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 })
                });
                await interaction.editReply(payload).catch(() => {});
            } else if (subcommand === 'goruntule') {
                const rows = await conn.query('SELECT COUNT(*) as repCount FROM reputation WHERE guild_id = ? AND user_id = ?', [interaction.guild.id, targetUser.id]);
                const count = Number(rows[0]?.repCount || 0);

                const payload = buildModBResponse({
                    title: `${eCrown} İtibar Bilgisi`,
                    textLines: [
                        `**Kullanıcı:** <@${targetUser.id}>`,
                        `**Toplam İtibar:** \`${count}\` puan`
                    ],
                    thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 })
                });
                await interaction.editReply(payload).catch(() => {});
            }

        } catch (error) {
            console.error('Error in itibar command:', error);
            const payload = buildModBResponse({
                title: 'Hata',
                textLines: ['İşlem sırasında bir hata oluştu.']
            });
            await interaction.editReply(payload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
