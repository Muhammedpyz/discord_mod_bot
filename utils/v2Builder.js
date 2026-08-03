const { MessageFlags } = require('discord.js');

const DEFAULT_BANNER_URL = "https://cdn.discordapp.com/attachments/1529916823150133459/1530497564665708655/F75E13D7-AC38-4B77-B9AB-DEAFCA8990E4.jpg?ex=6a65ca6e&is=6a6478ee&hm=b71a066c1e619da7ff83e82a460262845c3f50bdba638193104b5cb267729c71&";

const MONO_EMOJIS = {
    web: "1530917521174302840",
    instagram: "1530917541839503371",
    youtube: "1530917528929439835",
    kickgg: "1532084300663750817"
};

/**
 * Builds Discord Components V2 payload with top banner (Type 12 MediaGallery)
 */
function createV2Container({ title, description, fields = [], actionRows = [], bannerUrl = DEFAULT_BANNER_URL, showBrand = true, footer = 'turklion.net' }) {
    const containerComponents = [];

    // 1. Üst Banner Görseli (İptal edildi, kullanıcı her yerden kaldırılmasını istedi)

    // 2. Ana Başlık & Açıklama
    let textContent = `## ${title}\n${description}`;
    
    if (fields.length > 0) {
        textContent += '\n\n';
        for (const field of fields) {
            textContent += `**${field.name}**\n${field.value}\n\n`;
        }
    }

    containerComponents.push({
        type: 10, // TextDisplay
        content: textContent.trim()
    });

    // 3. Özel Eylemler / Kontrol Butonları
    for (const row of actionRows) {
        if (row.toJSON) {
            containerComponents.push(row.toJSON());
        } else {
            containerComponents.push(row);
        }
    }

    // 4. Sosyal Medya Marka Bölümleri (Sadece showBrand: true olduğunda gösterilir)
    if (showBrand) {
        containerComponents.push({
            type: 14 // Separator
        });

        const brandSections = [
            {
                type: 9, // Section
                components: [
                    {
                        type: 10,
                        content: "-# **Web sitemiz & sunucu bilgisi**"
                    }
                ],
                accessory: {
                    type: 2,
                    style: 5,
                    label: "turklion.net",
                    emoji: { id: MONO_EMOJIS.web },
                    url: "https://turklion.net"
                }
            },
            {
                type: 9,
                components: [
                    {
                        type: 10,
                        content: "-# **Etkinlikler & özel cekilisler**"
                    }
                ],
                accessory: {
                    type: 2,
                    style: 5,
                    label: "Instagram",
                    emoji: { id: MONO_EMOJIS.instagram },
                    url: "https://instagram.com/turklion"
                }
            },
            {
                type: 9,
                components: [
                    {
                        type: 10,
                        content: "-# **Tanitim & özel videolar**"
                    }
                ],
                accessory: {
                    type: 2,
                    style: 5,
                    label: "YouTube",
                    emoji: { id: MONO_EMOJIS.youtube },
                    url: "https://youtube.com/@turklion"
                }
            },
            {
                type: 9,
                components: [
                    {
                        type: 10,
                        content: "-# **Canli yayinlar & etkinlikler**"
                    }
                ],
                accessory: {
                    type: 2,
                    style: 5,
                    label: "Kick",
                    emoji: { id: MONO_EMOJIS.kickgg },
                    url: "https://kick.com/turklion"
                }
            }
        ];

        for (const section of brandSections) {
            containerComponents.push(section);
        }
    }

    if (footer) {
        containerComponents.push({
            type: 14 // Separator
        });
        containerComponents.push({
            type: 10,
            content: `-# ${footer}`
        });
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [
            {
                type: 17,
                components: containerComponents
            }
        ]
    };
}

module.exports = { createV2Container, DEFAULT_BANNER_URL };
