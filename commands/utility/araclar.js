const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createContainerMessage, buildModBResponse, MONO_EMOJIS } = require('../../utils/uiBuilder');

function safeEval(expr) {
    // Sadece sayı + operatör içeren ifadeler (güvenli mini parser)
    const s = expr.replace(/\s+/g, '').replace(/,/g, '.');
    if (!/^[0-9+\-*/().%^!]+$/.test(s) || s.length > 100) return null;
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${s.replace(/\^/g, '**')})`);
        const v = fn();
        if (typeof v !== 'number' || !isFinite(v)) return null;
        return Math.round(v * 1e10) / 1e10;
    } catch { return null; }
}

module.exports = [
    {
        data: new SlashCommandBuilder().setName('hesapla').setDescription('Matematik işlemi yapar.')
            .addStringOption(o => o.setName('islem').setDescription('Örn: (12+4)*3').setRequired(true).setMaxLength(100)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const islem = interaction.options.getString('islem');
            const v = safeEval(islem);
            if (v === null) {
                return interaction.editReply(createContainerMessage('Hata', 'Geçersiz işlem! Sayı ve + - * / ( ) % ^ kullanabilirsin.', '#ED4245', [], [], false, true));
            }
            await interaction.editReply(createContainerMessage('Hesap Makinesi', `\`${islem}\` = **${v}**`, '#5865F2'));
        }
    },
    {
        data: new SlashCommandBuilder().setName('şifre-üret').setDescription('Güçlü şifre üretir (sana özel).')
            .addIntegerOption(o => o.setName('uzunluk').setDescription('Karakter sayısı (8-32)').setRequired(false).setMinValue(8).setMaxValue(32)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const n = interaction.options.getInteger('uzunluk') || 16;
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
            let out = '';
            const buf = require('crypto').randomBytes(n);
            for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
            await interaction.editReply(createContainerMessage('Şifre Üretici', `Yeni şifren:\n\`${out}\`\n\n-# Kimseyle paylaşma!`, '#57F287'));
        }
    },
    {
        data: new SlashCommandBuilder().setName('emoji-büyüt').setDescription('Özel emojiyi büyük resim olarak gösterir.')
            .addStringOption(o => o.setName('emoji').setDescription('Büyütülecek emoji').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const str = interaction.options.getString('emoji');
            const m = str.match(/<(a)?:(\w+):(\d+)>/);
            if (!m) {
                return interaction.editReply(createContainerMessage('Hata', 'Geçerli bir özel emoji yapıştır.', '#ED4245', [], [], false, true));
            }
            const url = `https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? 'gif' : 'png'}?size=512`;
            const payload = buildModBResponse({ title: `:${m[2]}:`, textLines: ['İşte büyütülmüş hali:'], images: [url] });
            await interaction.editReply(payload);
        }
    },
    {
        data: new SlashCommandBuilder().setName('mc-sunucu').setDescription('Minecraft sunucu durumunu sorgular.')
            .addStringOption(o => o.setName('adres').setDescription('Sunucu adresi (örn: hypixel.net)').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            const adres = interaction.options.getString('adres');
            try {
                const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(adres)}`, { headers: { 'User-Agent': 'NyxBot/1.0' }, signal: AbortSignal.timeout(12000) });
                const d = await res.json();
                if (!d.online) {
                    return interaction.editReply(createContainerMessage('MC Sunucu', `**${adres}** şu an çevrimdışı görünüyor.`, '#ED4245', [], [], false, true));
                }
                const body = `**${d.hostname || adres}**\n\n**Durum:** Çevrimiçi\n**Oyuncular:** ${d.players?.online ?? '?'} / ${d.players?.max ?? '?'}\n**Sürüm:** ${d.version || 'Bilinmiyor'}\n**MOTD:** ${(d.motd?.clean || []).join(' ').slice(0, 200) || '—'}`;
                await interaction.editReply(createContainerMessage('MC Sunucu', body, '#57F287'));
            } catch (e) {
                await interaction.editReply(createContainerMessage('Hata', 'Sorgulanamadı, adresi kontrol et.', '#ED4245', [], [], false, true)).catch(() => {});
            }
        }
    }
];
