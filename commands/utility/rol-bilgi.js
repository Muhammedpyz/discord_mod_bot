const { 
    SlashCommandBuilder, 
    MessageFlags, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { createContainerMessage, MONO_EMOJIS, COLORS } = require('../../utils/uiBuilder');

function buildRoleInfoPayload(category = 'all') {
    let title = 'Nyx Rol & Yetki Bilgilendirme Sistemi';
    let description = '';

    if (category === 'all') {
        description = `Sunucumuzdaki roller **3 ana kategoride** toplanmıştır. Detayları incelemek için aşağıdaki menüyü kullanabilirsiniz:\n\n` +
            `### <:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> 1. Yönetim & Yetkili Ekibi\n` +
            `> Yönetici, Moderatör, Discord Moderatör, Asistan, Mimar ve Medya Sorumlusu kadrolarının görev ve yetkileri.\n\n` +
            `### <:mono:${MONO_EMOJIS.star || '1530917515227725834'}> 2. Sunucu & Özel Statü Rolleri\n` +
            `> The Türklions, Server Booster, YouTuber, TikToker, Yayıncı ve VIP (LVIP+, LVIP, VIP) ayrıcalıkları.\n\n` +
            `### <:mono:${MONO_EMOJIS.award || '1537767883608957048'}> 3. Seviye & Kilit Açılan İzin Rolleri\n` +
            `> 0'dan 50. seviyeye kadar açılan tüm izinler (Tepki ekleme, yayın açma, nick değiştirme, müzik botu, resim yükleme, GIF, harici emoji, slowmode muafiyeti vb.).\n\n` +
            `*Aşağıdaki menüden incelemek istediğiniz kategoriyi seçiniz:*`;
    } else if (category === 'staff') {
        description = `### <:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Yönetim & Yetkili Ekibi\n\n` +
            `> <@&1441769996664442962> - **Yönetici ›** Tüm sunucu, bot ve kanal yetkilerine sahiptir. Ban, kick, sistem ayarları ve yetkili yönetimini sağlar.\n> \n` +
            `> <@&1441770091959025735> - **Moderatör ›** Sohbeti temizleme (\`/purge\`), kural ihlallerinde susturma (\`/mute\`), uyarma (\`/warn\`), kanalları kilitleme (\`/lockdown\`) ve ban yetkisine sahiptir.\n> \n` +
            `> <@&1441770145985859698> - **Discord Moderatör ›** Sohbet ve ses odalarını denetler. Süreli susturma (\`/mute\`, \`/vmute\`), uyarma (\`/warn\`), kullanıcıları sesten atma ve taşıma yetkisi vardır.\n> \n` +
            `> <@&1441771252653097020> - **Asistan ›** Destek taleplerini (Ticket) yanıtlar, üyelere rehberlik eder ve kural ihlallerinde uyarı/susturma (\`/warn\`, \`/mute\`) uygular.\n> \n` +
            `> <@&1515272198460412016> - **Mimar ›** Sunucu haritalarını, arena tasarımlarını ve etkinlik yapılarını inşa eden yapı ekibidir.\n> \n` +
            `> <@&1530998354027483378> - **Medya Sorumlusu ›** Sosyal medya, duyuru, video ve içerik üreticilerini denetleme yetkisine sahiptir.`;
    } else if (category === 'vip') {
        description = `### <:mono:${MONO_EMOJIS.star || '1530917515227725834'}> Sunucu & Özel Statü Rolleri\n\n` +
            `> <@&1525245624566415522> - **The Türklions. ›** Sunucumuza değer katan özel dostlarımıza verilir. Özel sohbet odalarına erişim ve öncelikli destek sağlar.\n> \n` +
            `> <@&1529580311439216862> - **Server Booster ›** Sunucuya takviye basanlara otomatik verilir. Özel ses odası açma (\`/ozel-oda\`), çekilişlerde 2x kazanma şansı, harici emoji/çıkartma ve özel takviyeci rengi sağlar.\n> \n` +
            `> <@&1540701265950937098> - **YouTuber ›** Onaylı YouTube üreticilerine verilir. Video paylaşım kanalını kullanma ve yayın bildirim pingi atma hakkı sağlar.\n> \n` +
            `> <@&1540701268018733056> - **TikToker ›** Shorts ve TikTok videoları üretenlere verilir. İçeriklerini özel kanalda paylaşma hakkı sağlar.\n> \n` +
            `> <@&1540701270589964329> - **Yayıncı ›** Canlı yayın açanlara verilir. Yayın duyuru kanalını kullanma ve özel yayıncı odalarına erişim sağlar.\n> \n` +
            `> <@&1441770177502122106> - **LVIP+ ›** En üst VIP ayrıcalıkları, tüm VIP kanallarına erişim, sesli kanallarda en yüksek ses kalitesi (384kbps) ve özel çekiliş hakkı sağlar.\n> \n` +
            `> <@&1441770342585598032> - **LVIP ›** VIP sohbet odası, öncelikli destek ve özel renk ayrıcalığı sağlar.\n> \n` +
            `> <@&1441770392166465577> - **VIP ›** Başlangıç VIP ayrıcalıkları ve özel sohbet odası erişimi sağlar.`;
    } else if (category === 'levels') {
        description = `### <:mono:${MONO_EMOJIS.award || '1537767883608957048'}> İşlevsel Seviye Rolleri & Açılan Yetkiler\n\n` +
            `> <@&1540701273387696229> - **50 Level (Netherite Üye) ›** Çekilişlerde 3x şans, tüm yetkili başvurularında doğrudan mülakat önceliği ve özel efsanevi sohbet rengi.\n> \n` +
            `> <@&1540701276830965951> - **40 Level (Zümrüt Üye) ›** Alt Başlık (Thread) açabilme yetkisi, VIP sohbet kanalını görüntüleyebilme ve çekilişlerde 2x şans.\n> \n` +
            `> <@&1540701279167315998> - **30 Level (Elmas Üye) ›** Metin kanallarında Yavaş Mod (Slowmode) engelinden muafiyet ve özel çekilişlere katılım hakkı.\n> \n` +
            `> <@&1540701281482571921> - **20 Level (Lapis Üye) ›** Harici Sunucu Emojilerini (External Emojis) kullanabilme ve özel geçici ses odası (\`/ozel-oda\`) açabilme yetkisi.\n> \n` +
            `> <@&1540701283957080125> - **15 Level (Kızıltaş Üye) ›** Sohbette GIF atabilme ve Gömülü Bağlantı (Embed Links) paylaşabilme yetkisi.\n> \n` +
            `> <@&1540701286553358386> - **10 Level (Altın Üye) ›** Sohbete Fotoğraf / Resim / Dosya yükleme (Attach Files) ve Harici Çıkartma kullanma izni.\n> \n` +
            `> <@&1540701288478543962> - **5 Level (Demir Üye) ›** Müzik botu komutlarını (\`/play\`, \`/skip\`, \`/queue\`, \`/lyrics\`) kullanabilme yetkisi.\n> \n` +
            `> <@&1540701293226500116> - **3 Level (Bakır Üye) ›** Sunucu içi kendi kullanıcı adını (Nickname) değiştirebilme ve \`/afk\` komutunu kullanabilme yetkisi.\n> \n` +
            `> <@&1540701296062103642> - **1 Level (Kömür Üye) ›** Mesajlara Tepki Ekleme (Add Reactions) ve ses odalarında Yayın Açma / Ekran Paylaşma (Stream) izni.\n> \n` +
            `> <@&1441770414396412006> - **0 Level (Oyuncu) ›** Sunucuya katılan herkese otomatik verilir. Temel metin kanallarında yazma ve ses odalarına girme hakkı sağlar.`;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rolbilgi_select')
        .setPlaceholder('Kategori Seçin...')
        .addOptions([
            {
                label: 'Genel Bakış (Ana Menü)',
                value: 'all',
                description: 'Rol kategorileri genel özeti',
                default: category === 'all',
                emoji: { id: MONO_EMOJIS.crown || '1530917482813194260' }
            },
            {
                label: 'Yönetim & Yetkili Ekibi',
                value: 'staff',
                description: 'Yönetici, Moderatör, Asistan ve Mimar rolleri',
                default: category === 'staff',
                emoji: { id: MONO_EMOJIS.shield || '1530917506867400775' }
            },
            {
                label: 'Özel Statü & Destekçi / VIP Rolleri',
                value: 'vip',
                description: 'Server Booster, VIP kademeleri ve Yayıncı rolleri',
                default: category === 'vip',
                emoji: { id: MONO_EMOJIS.star || '1530917515227725834' }
            },
            {
                label: 'Seviye & Kilit Açılan İzin Rolleri',
                value: 'levels',
                description: 'Minecraft temalı 0-50 seviye kilit açma rolleri',
                default: category === 'levels',
                emoji: { id: MONO_EMOJIS.award || '1537767883608957048' }
            }
        ]);

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rolbilgi_refresh:${category}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh_ccw || '1537768046989410375')
    );

    const actionRows = [
        new ActionRowBuilder().addComponents(selectMenu),
        rowButtons
    ];

    const payload = createContainerMessage(title, description, COLORS.PRIMARY || '#5865F2', actionRows, [], false, false);
    return payload;
}

async function handleRoleInfoInteraction(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('rolbilgi_')) return false;

    await interaction.deferUpdate().catch(() => {});

    if (customId === 'rolbilgi_select') {
        const selected = interaction.values[0] || 'all';
        const payload = buildRoleInfoPayload(selected);
        payload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    if (customId.startsWith('rolbilgi_refresh:')) {
        const cat = customId.split(':')[1] || 'all';
        const payload = buildRoleInfoPayload(cat);
        payload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
        await interaction.editReply(payload).catch(() => {});
        return true;
    }

    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol-bilgi')
        .setDescription('Sunucudaki tüm rolleri, sağladığı izinleri ve görevlerini listeler.')
        .addStringOption(option => 
            option.setName('kategori')
                .setDescription('Görüntülemek istediğiniz rol kategorisi')
                .setRequired(false)
                .addChoices(
                    { name: 'Genel Bakış (Ana Menü)', value: 'all' },
                    { name: 'Yönetim & Yetkili Kadrosu', value: 'staff' },
                    { name: 'Özel Statü & VIP / Yayıncı Rolleri', value: 'vip' },
                    { name: 'Seviye & Kilit Açılan İzin Rolleri', value: 'levels' }
                )
        )
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const category = interaction.options.getString('kategori') || 'all';
        const payload = buildRoleInfoPayload(category);
        payload.flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
        await interaction.editReply(payload);
    },

    buildRoleInfoPayload,
    handleRoleInfoInteraction
};
