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

function buildShipBar(percentage) {
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

function getShipComment(rate) {
    if (rate >= 90) return '💍 **Evlilik Yakın!** Ruh ikizlerinizi buldunuz, nikah salonu tutulmalı!';
    if (rate >= 75) return '💖 **Mükemmel Uyum!** Aranızdaki çekim göz kamaştırıyor.';
    if (rate >= 50) return '🌸 **Tatlı Bir Başlangıç:** Biraz daha vakit geçirirseniz harika bir aşk doğabilir.';
    if (rate >= 30) return '🤝 **Kanka Bölgesi (Friendzone):** Arkadaş kalmanız her iki taraf için de daha hayırlı.';
    if (rate >= 10) return '⚡ **Zoraki Çift:** Aranızda pek kimya yok gibi görünüyor.';
    return '💔 **İmkansız Aşk:** Yan yana gelseniz üçüncü dünya savaşı çıkar!';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('İki kullanıcı arasındaki aşk ve uyum yüzdesini hesaplar.')
        .addUserOption(opt =>
            opt.setName('kullanici1')
                .setDescription('İlk kullanıcı')
                .setRequired(true)
        )
        .addUserOption(opt =>
            opt.setName('kullanici2')
                .setDescription('İkinci kullanıcı (Boş bırakılırsa siz olursunuz)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const user1 = interaction.options.getUser('kullanici1');
        const user2 = interaction.options.getUser('kullanici2') || interaction.user;

        // Tutarlı rastgelelik (Aynı iki kişi her sorgulandığında aynı sonucu verir)
        const combinedId = [user1.id, user2.id].sort().join('');
        let hash = 0;
        for (let i = 0; i < combinedId.length; i++) {
            hash = (hash << 5) - hash + combinedId.charCodeAt(i);
            hash |= 0;
        }
        const rate = Math.abs(hash) % 101;

        const progressBar = buildShipBar(rate);
        const comment = getShipComment(rate);

        const title = `<:mono:${MONO_EMOJIS.heart || '1538517512340119664'}> Aşk Uyumu (Ship): ${user1.username} & ${user2.username}`;
        const desc = `<@${user1.id}> ile <@${user2.id}> arasındaki aşk testi sonuçlandı!\n\n**Uyum Seviyesi:** \`%${rate}\`\n${progressBar}\n\n${comment}`;

        return interaction.editReply(createContainerMessage(title, desc, rate >= 50 ? '#EB459E' : '#5865F2', [], [], false));
    }
};
