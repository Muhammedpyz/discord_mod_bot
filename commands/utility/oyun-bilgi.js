const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oyun')
        .setDescription('Minecraft ve Roblox oyuncu profillerini ve skinlerini görüntüler.')
        .addSubcommand(sub =>
            sub.setName('mcskin')
                .setDescription('Minecraft oyuncusunun 3D karakter modelini ve skinini çeker.')
                .addStringOption(opt => opt.setName('oyuncu').setDescription('Minecraft kullanıcı adı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('roblox')
                .setDescription('Roblox kullanıcısının profil bilgilerini ve avatarını çeker.')
                .addStringOption(opt => opt.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();

        if (sub === 'mcskin') {
            const username = interaction.options.getString('oyuncu');

            try {
                // Mojang API ile UUID sorgusu
                const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
                if (!mojangRes.ok) throw new Error('Oyuncu bulunamadı.');
                const mojangData = await mojangRes.json();
                const uuid = mojangData.id;

                const renderUrl = `https://crafatar.com/renders/body/${uuid}?overlay=true`;
                const skinDownloadUrl = `https://crafatar.com/skins/${uuid}`;

                const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Minecraft Karakteri: ${mojangData.name}`;
                const desc = `**UUID:** \`${uuid}\`\n\n` +
                             `[Skin Dosyasını İndir](${skinDownloadUrl}) | [NameMC Profilini Gör](https://namemc.com/profile/${username})`;

                const payload = createContainerMessage(title, desc, '#57F287', [], [], false);
                return interaction.editReply({
                    ...payload,
                    files: [renderUrl]
                });
            } catch (e) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Oyuncu Bulunamadı`,
                    `\`${username}\` adına sahip bir orijinal Minecraft hesabı bulunamadı.`,
                    '#ED4245', [], [], false
                ));
            }
        }

        if (sub === 'roblox') {
            const username = interaction.options.getString('kullanici');

            try {
                // Roblox kullanıcı ID bulma
                const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
                });
                const userData = await userRes.json();

                if (!userData.data || userData.data.length === 0) {
                    return interaction.editReply(createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Kullanıcı Bulunamadı`,
                        `\`${username}\` adına sahip bir Roblox kullanıcısı bulunamadı.`,
                        '#ED4245', [], [], false
                    ));
                }

                const robloxUser = userData.data[0];
                const userId = robloxUser.id;

                // Avatar resmi çekme
                const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
                const avatarData = await avatarRes.json();
                const avatarUrl = avatarData.data[0]?.imageUrl;

                const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Roblox Profili: ${robloxUser.name}`;
                const desc = `**Görünen İsim:** \`${robloxUser.displayName}\`\n` +
                             `**Kullanıcı ID:** \`${userId}\`\n\n` +
                             `[Roblox Profiline Git](https://www.roblox.com/users/${userId}/profile)`;

                const payload = createContainerMessage(title, desc, '#E74C3C', [], [], false);

                if (avatarUrl) {
                    return interaction.editReply({
                        ...payload,
                        files: [avatarUrl]
                    });
                }

                return interaction.editReply(payload);
            } catch (error) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Hata Oluştu`,
                    'Roblox bilgisi çekilemedi: ' + error.message,
                    '#ED4245', [], [], false
                ));
            }
        }
    }
};
