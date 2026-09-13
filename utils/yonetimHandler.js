const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

async function handleYonetimInteractions(interaction) {
    const { customId } = interaction;

    if (customId.startsWith('toplu_onay_')) {
        await interaction.deferUpdate().catch(() => {});
        const [, , islem, rolId] = customId.split('_');
        const rol = interaction.guild.roles.cache.get(rolId);
        if (!rol) {
            return interaction.editReply(createContainerMessage('Hata', 'Rol bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
        }
        try {
            await interaction.editReply(createContainerMessage('İşleniyor', 'Toplu rol işlemi başladı, bitince bu kart güncellenecek...', '#FEE75C', [])).catch(() => {});
            const uyeler = await interaction.guild.members.fetch();
            let ok = 0; let hata = 0;
            for (const m of uyeler.values()) {
                if (m.user.bot) continue;
                try {
                    if (islem === 'ver') {
                        if (!m.roles.cache.has(rolId)) { await m.roles.add(rolId, 'Toplu rol verme'); ok++; }
                    } else {
                        if (m.roles.cache.has(rolId)) { await m.roles.remove(rolId, 'Toplu rol alma'); ok++; }
                    }
                } catch { hata++; }
            }
            await interaction.editReply(createContainerMessage('Tamamlandı', `<:mono:${MONO_EMOJIS.check}> <@&${rolId}> ${islem === 'ver' ? 'verildi' : 'alındı'}.\n**Başarılı:** ${ok} • **Hatalı:** ${hata}`, '#57F287', [])).catch(() => {});
        } catch (e) {
            console.error('[TopluRol]:', e.message);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem yarıda kesildi.', '#ED4245', [], [], false, true)).catch(() => {});
        }
        return;
    }

    if (customId === 'toplu_iptal') {
        await interaction.deferUpdate().catch(() => {});
        await interaction.editReply({ ...createContainerMessage('İptal', 'Toplu rol işlemi iptal edildi.', '#FEE75C'), components: [] }).catch(() => {});
    }
}

module.exports = { handleYonetimInteractions };
