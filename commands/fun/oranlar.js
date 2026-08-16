const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const APP_EMOJIS = {
    bar_l_filled: '1538524468710866944',
    bar_l_empty: '1538524459127017492',
    bar_m_filled: '1538524484041183313',
    bar_m_empty: '1538524476289843322',
    bar_r_filled: '1538524509349609492',
    bar_r_empty: '1538524497785651321'
};

function buildRateBar(percentage) {
    const totalSegments = 7;
    const filledCount = Math.round((percentage / 100) * totalSegments);

    const leftPiece = filledCount >= 1 
        ? `<:bar_l_filled:${APP_EMOJIS.bar_l_filled}>` 
        : `<:bar_l_empty:${APP_EMOJIS.bar_l_empty}>`;

    let midPieces = '';
    for (let i = 2; i <= 6; i++) {
        if (filledCount >= i) {
            midPieces += `<:bar_m_filled:${APP_EMOJIS.bar_m_filled}>`;
        } else {
            midPieces += `<:bar_m_empty:${APP_EMOJIS.bar_m_empty}>`;
        }
    }

    const rightPiece = filledCount >= 7 
        ? `<:bar_r_filled:${APP_EMOJIS.bar_r_filled}>` 
        : `<:bar_r_empty:${APP_EMOJIS.bar_r_empty}>`;

    return `${leftPiece}${midPieces}${rightPiece}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oran')
        .setDescription('Kullanıcı için mizahi oran ve yüzde testleri yapar.')
        .addSubcommand(sub =>
            sub.setName('simp')
                .setDescription('Simp oranını ölçer.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Ölçülecek kullanıcı').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('gay')
                .setDescription('Gay / LGBT oranını ölçer.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Ölçülecek kullanıcı').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('aptallik')
                .setDescription('Aptallık / Şapşallık oranını ölçer.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Ölçülecek kullanıcı').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('sans')
                .setDescription('Bugünkü genel şans oranını ölçer.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Ölçülecek kullanıcı').setRequired(false))
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('kullanici') || interaction.user;

        // Rastgele yüzde (0-100)
        const rate = Math.floor(Math.random() * 101);
        const bar = buildRateBar(rate);

        const subTitles = {
            'simp': 'Simplik Seviyesi',
            'gay': 'Geylik Oranı',
            'aptallik': 'Şapşallık / Aptallık Seviyesi',
            'sans': 'Günün Şans Oranı'
        };

        const subComments = {
            'simp': rate > 75 ? '👑 **Kral Simp:** Karşı cins için böbreğini bile verir!' : (rate > 40 ? '🌸 **Normal:** Arada bir simplik yapıyor.' : '🗿 **Sigma:** Asla taviz vermez!'),
            'gay': rate > 50 ? '🌈 **Gökkuşağı Parlıyor!**' : '🕶️ **Düz Çizgi:** Standart mod.',
            'aptallik': rate > 75 ? '🧠 **Beyin 404 Not Found:** Şarjı bitmiş gibi duruyor.' : '💡 **Dahi:** IQ seviyesi yüksek.',
            'sans': rate > 75 ? '🍀 **Piyango Al:** Bugün her şey senin lehine!' : '⚡ **Dikkatli Ol:** Başına saksı düşebilir.'
        };

        const title = `<:mono:${MONO_EMOJIS.disc || '1537767765103083541'}> ${subTitles[sub]}: ${target.username}`;
        const desc = `<@${target.id}> için yapılan test sonucu:\n\n**Oran:** \`%${rate}\`\n${bar}\n\n${subComments[sub]}`;

        return interaction.editReply(createContainerMessage(title, desc, '#5865F2', [], [], false));
    }
};
