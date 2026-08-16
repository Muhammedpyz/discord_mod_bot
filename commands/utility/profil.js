const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kullanıcının sosyal profil kartını, evlilik durumunu ve biyografisini gösterir.')
        .addSubcommand(sub =>
            sub.setName('goruntule')
                .setDescription('Bir kullanıcının profil kartını inceler.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Profili görüntülenecek kullanıcı').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('biyografi')
                .setDescription('Kendi profil biyografinizi ayarlar.')
                .addStringOption(opt => opt.setName('metin').setDescription('Profilinizde görünecek biyografi metni').setMaxLength(250).setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();

        if (sub === 'biyografi') {
            const bioText = interaction.options.getString('metin');
            await db.setUserBio(interaction.user.id, bioText);

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.success || '1530917482435579974'}> Biyografi Güncellendi!`,
                `Yeni profil biyografiniz başarıyla kaydedildi:\n\n> *"${bioText}"*`,
                '#57F287', [], [], false
            ));
        }

        if (sub === 'goruntule') {
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            const profile = await db.getUserProfile(targetUser.id) || {};
            
            // İtibar ve ceza puanları
            let repPoints = 0;
            try {
                const repRows = await db.pool.query('SELECT COUNT(*) as cnt FROM reputation WHERE user_id = ? AND guild_id = ?', [targetUser.id, interaction.guild.id]);
                repPoints = repRows[0]?.cnt || 0;
            } catch (e) {}

            let warnCount = 0;
            try {
                const warnRows = await db.pool.query('SELECT COUNT(*) as cnt FROM warnings WHERE user_id = ? AND guild_id = ?', [targetUser.id, interaction.guild.id]);
                warnCount = warnRows[0]?.cnt || 0;
            } catch (e) {}

            const joinedEpoch = targetMember?.joinedTimestamp ? Math.floor(targetMember.joinedTimestamp / 1000) : null;
            const createdEpoch = Math.floor(targetUser.createdTimestamp / 1000);

            let marriageText = '`Bekar`';
            if (profile.partner_id) {
                const marriedEpoch = profile.married_at ? Math.floor(new Date(profile.married_at).getTime() / 1000) : null;
                marriageText = `💍 <@${profile.partner_id}> ile evli ${marriedEpoch ? `(<t:${marriedEpoch}:R>)` : ''}`;
            }

            const title = `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Profil Kartı: ${targetUser.username}`;
            const desc = profile.bio ? `> *"${profile.bio}"*` : `> *Henüz bir biyografi belirlenmemiş. \`/profil biyografi\` ile ekleyebilirsiniz.*`;

            const fields = [
                { name: 'Evlilik Durumu', value: marriageText, inline: true },
                { name: 'İtibar Puanı (+REP)', value: `\`+${repPoints}\` puan`, inline: true },
                { name: 'Uyarı Sayısı', value: `\`${warnCount}\` uyarı`, inline: true },
                { name: 'Sunucuya Katılma', value: joinedEpoch ? `<t:${joinedEpoch}:D> (<t:${joinedEpoch}:R>)` : '`Bilinmiyor`', inline: true },
                { name: 'Hesap Oluşturma', value: `<t:${createdEpoch}:D> (<t:${createdEpoch}:R>)`, inline: true }
            ];

            return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], fields, false));
        }
    }
};
