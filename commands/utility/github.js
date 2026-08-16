const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('github')
        .setDescription('GitHub kullanıcı profili veya deposu (repository) hakkında bilgi alır.')
        .addSubcommand(sub =>
            sub.setName('kullanici')
                .setDescription('Bir GitHub kullanıcısının profilini görüntüler.')
                .addStringOption(opt => opt.setName('kullanici_adi').setDescription('GitHub kullanıcı adı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('repo')
                .setDescription('Bir GitHub deposunu görüntüler (Örn: facebook/react).')
                .addStringOption(opt => opt.setName('depo_adi').setDescription('Örn: expressjs/express').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();

        if (sub === 'kullanici') {
            const username = interaction.options.getString('kullanici_adi');

            try {
                const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
                    headers: { 'User-Agent': 'TurklionBot-Discord' }
                });
                if (!res.ok) throw new Error('Kullanıcı bulunamadı.');
                const data = await res.json();

                const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> GitHub Profili: ${data.name || data.login}`;
                const desc = `${data.bio ? `> ${data.bio}\n\n` : ''}[GitHub Profiline Git](${data.html_url})`;

                const fields = [
                    { name: 'Kullanıcı Adı', value: `\`${data.login}\``, inline: true },
                    { name: 'Açık Depolar (Repos)', value: `\`${data.public_repos}\``, inline: true },
                    { name: 'Gistler', value: `\`${data.public_gists}\``, inline: true },
                    { name: 'Takipçiler', value: `\`${data.followers}\``, inline: true },
                    { name: 'Takip Edilen', value: `\`${data.following}\``, inline: true },
                    { name: 'Konum / Şirket', value: `\`${data.location || data.company || 'Belirtilmedi'}\``, inline: true }
                ];

                const payload = createContainerMessage(title, desc, '#24292E', [], fields, false);

                if (data.avatar_url) {
                    return interaction.editReply({
                        ...payload,
                        files: [data.avatar_url]
                    });
                }

                return interaction.editReply(payload);
            } catch (e) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Kullanıcı Bulunamadı`,
                    `\`${username}\` adına sahip bir GitHub hesabı bulunamadı.`,
                    '#ED4245', [], [], false
                ));
            }
        }

        if (sub === 'repo') {
            const repoPath = interaction.options.getString('depo_adi');

            try {
                const res = await fetch(`https://api.github.com/repos/${repoPath}`, {
                    headers: { 'User-Agent': 'TurklionBot-Discord' }
                });
                if (!res.ok) throw new Error('Depo bulunamadı.');
                const data = await res.json();

                const title = `<:mono:${MONO_EMOJIS.star || '1530917515227725834'}> GitHub Deposu: ${data.full_name}`;
                const desc = `${data.description ? `> ${data.description}\n\n` : ''}[Depoya Git](${data.html_url})`;

                const fields = [
                    { name: 'Yıldızlar (Stars)', value: `⭐ \`${data.stargazers_count}\``, inline: true },
                    { name: 'Çatallar (Forks)', value: `🍴 \`${data.forks_count}\``, inline: true },
                    { name: 'Ana Dil', value: `\`${data.language || 'Bilinmiyor'}\``, inline: true },
                    { name: 'Açık Sorunlar (Issues)', value: `\`${data.open_issues_count}\``, inline: true },
                    { name: 'Lisans', value: `\`${data.license ? data.license.spdx_id : 'Yok'}\``, inline: true },
                    { name: 'Varsayılan Dal', value: `\`${data.default_branch}\``, inline: true }
                ];

                const payload = createContainerMessage(title, desc, '#24292E', [], fields, false);
                return interaction.editReply(payload);
            } catch (e) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Depo Bulunamadı`,
                    `\`${repoPath}\` yoluyla eşleşen bir GitHub deposu bulunamadı (Örn: \`facebook/react\`).`,
                    '#ED4245', [], [], false
                ));
            }
        }
    }
};
