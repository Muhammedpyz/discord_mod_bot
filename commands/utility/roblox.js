const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createV2Container, COLORS, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roblox')
        .setDescription('Roblox oyuncusu hakkında bilgi verir.')
        .addStringOption(opt => 
            opt.setName('kullanici_adi')
               .setDescription('Roblox oyuncusunun adı')
               .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const username = interaction.options.getString('kullanici_adi');
        
        try {
            const response = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
            });
            
            const data = await response.json();
            
            if (!data.data || data.data.length === 0) {
                return await interaction.editReply({
                    content: `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> **${username}** adında bir Roblox oyuncusu bulunamadı.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const user = data.data[0];
            const userId = user.id;
            const displayName = user.displayName;

            // Detaylı profil bilgileri
            const [detailRes, friendsRes, followersRes, avatarRes] = await Promise.all([
                fetch(`https://users.roblox.com/v1/users/${userId}`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
                fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
                fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`)
            ]);

            const detailData = await detailRes.json().catch(() => ({}));
            const friendsData = await friendsRes.json().catch(() => ({}));
            const followersData = await followersRes.json().catch(() => ({}));
            const avatarData = await avatarRes.json().catch(() => ({}));

            const avatarUrl = avatarData.data && avatarData.data.length > 0 ? avatarData.data[0].imageUrl : null;
            const bio = detailData.description ? detailData.description.slice(0, 200) : 'Yok';
            const createdDate = detailData.created ? `<t:${Math.floor(new Date(detailData.created).getTime() / 1000)}:D>` : 'Bilinmiyor';
            const friendsCount = friendsData.count ?? 0;
            const followersCount = followersData.count ?? 0;
            const bannedStatus = detailData.isBanned ? `<:mono:${MONO_EMOJIS.cross}> Evet` : `<:mono:${MONO_EMOJIS.check}> Hayır`;

            const profileBtn = new ButtonBuilder()
                .setLabel('Profiline Git')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setEmoji(MONO_EMOJIS.website);

            const row = new ActionRowBuilder().addComponents(profileBtn);

            const payload = createV2Container({
                title: `Roblox Profili: ${displayName}`,
                description: `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> **Kullanıcı Adı:** ${user.name}\n` +
                             `<:mono:${MONO_EMOJIS.crown || '1530918952711094272'}> **Görünen Ad:** ${displayName}\n` +
                             `<:mono:${MONO_EMOJIS.pin || '1530918960764027000'}> **ID:** ${userId}\n` +
                             `<:mono:${MONO_EMOJIS.user_round || '1537768188245180487'}> **Arkadaş:** \`${friendsCount.toLocaleString('tr-TR')}\` | **Takipçi:** \`${followersCount.toLocaleString('tr-TR')}\`\n` +
                             `<:mono:${MONO_EMOJIS.website || '1530917521174302840'}> **Kayıt:** ${createdDate}\n` +
                             `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> **Banlı:** ${bannedStatus}\n\n` +
                             `> *"${bio}"*`,
                color: 0xE3312E,
                thumbnail: avatarUrl || null,
                actionRows: [row]
            });

            await interaction.editReply(payload);
        } catch (error) {
            console.error('Roblox komut hatası:', error?.message || error);
            await interaction.editReply({
                content: `<:mono:${MONO_EMOJIS.cross || '1530917536806469783'}> Roblox API\'sine ulaşılamadı. Lütfen daha sonra tekrar deneyin.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};