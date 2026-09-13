const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const eco = require('./globalEco');

// Mesaj başına coin kazanımı cooldown takibi (kullanıcı başına 60sn)
const ecoMsgCooldowns = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, last] of ecoMsgCooldowns.entries()) {
        if (now - last > 120000) ecoMsgCooldowns.delete(key);
    }
}, 5 * 60 * 1000);

/** Mesaj yazana küçük coin (global cüzdan, 60sn cooldown). */
async function rewardMessageEconomy(message) {
    if (!message.guild || message.author.bot) return;
    const key = message.author.id;
    const now = Date.now();
    const last = ecoMsgCooldowns.get(key);
    if (last && now - last < 60000) return;
    ecoMsgCooldowns.set(key, now);

    try {
        const reward = 1 + Math.floor(Math.random() * 5); // 1-5 Jeton
        await eco.addBalance(message.author.id, reward);
        await db.pool.query(
            "INSERT INTO economy_transactions (guild_id, to_user, amount, type) VALUES (?, ?, ?, 'message_reward')",
            [message.guild.id, message.author.id, reward]
        ).catch(() => {});
        try { require('./achievements').trackBalance(message.guild.id, message.author.id).catch(() => {}); } catch {}
    } catch (e) {
        console.error('[Eco Msg Reward] Hata:', e.message);
    }
}

async function handleEconomyInteractions(interaction) {
    if (interaction.customId === 'eco_cancel') {
        await interaction.deferUpdate().catch(() => {});
        const payload = createContainerMessage('İptal Edildi', 'İşlem isteğiniz üzerine iptal edildi.', '#ED4245');
        await interaction.editReply({ ...payload, components: [] }).catch(() => {});
        return;
    }

    if (interaction.customId.startsWith('eco_refresh_')) {
        await interaction.deferUpdate().catch(() => {});
        const targetId = interaction.customId.split('_')[2];
        try {
            const w = await eco.getWallet(targetId);
            const balance = Number(w.balance || 0);
            const bank = Number(w.bank_balance || 0);
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const name = member ? member.user.username : 'Kullanıcı';
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`eco_refresh_${targetId}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage(
                `${name} — Global Cüzdan`,
                `**Nakit:** \`${balance.toLocaleString('tr-TR')}\` Jeton\n**Banka:** \`${bank.toLocaleString('tr-TR')}\` Jeton\n**Toplam:** \`${(balance + bank).toLocaleString('tr-TR')}\` Jeton`,
                '#5865F2', [row]
            );
            await interaction.editReply(payload).catch(() => {});
        } catch (e) {
            console.error('[Eco refresh] Hata:', e.message);
        }
        return;
    }

    if (interaction.customId === 'eco_top_refresh') {
        await interaction.deferUpdate().catch(() => {});
        try {
            const top = await eco.getTop(10);
            let list = '';
            for (let i = 0; i < top.length; i++) {
                const u = top[i];
                const total = Number(u.balance) + Number(u.bank_balance);
                list += `\`#${i + 1}\` <@${u.user_id}> — **${total.toLocaleString('tr-TR')} Jeton**\n`;
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('eco_top_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
            );
            const payload = createContainerMessage('Global En Zenginler', list || 'Henüz ekonomi verisi yok.', '#FEE75C', [row]);
            await interaction.editReply(payload).catch(() => {});
        } catch (e) {
            console.error('[Eco top refresh] Hata:', e.message);
        }
        return;
    }

    if (interaction.customId === 'eco_market_select') {
        await interaction.deferUpdate().catch(() => {});
        const itemId = interaction.values[0];

        let conn;
        try {
            conn = await db.pool.getConnection();
            const items = await conn.query('SELECT * FROM economy_shop_items WHERE id = ? AND guild_id = ?', [itemId, interaction.guild.id]);
            if (items.length === 0) {
                return interaction.followUp(createContainerMessage('Hata', 'Ürün bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            const item = items[0];

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`eco_buy_${item.id}`)
                    .setLabel(`Satın Al (${Number(item.price).toLocaleString('tr-TR')} Jeton)`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(MONO_EMOJIS.check),
                new ButtonBuilder()
                    .setCustomId('eco_market_back')
                    .setLabel('Markete Dön')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(MONO_EMOJIS.arrow_left)
            );

            const confirmMsg = createContainerMessage(
                `${item.name}`,
                `${item.description || 'Açıklama yok.'}\n\n**Fiyat:** ${Number(item.price).toLocaleString('tr-TR')} Jeton\n${item.stock !== null ? `**Stok:** ${item.stock}` : '**Stok:** Sınırsız'}\n\n-# Ödeme global cüzdandan.`,
                '#5865F2',
                [row]
            );
            await interaction.editReply(confirmMsg).catch(() => {});
        } catch (e) {
            console.error('Market select error:', e.message);
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    if (interaction.customId === 'eco_market_back') {
        await interaction.deferUpdate().catch(() => {});
        let conn;
        try {
            conn = await db.pool.getConnection();
            const items = await conn.query('SELECT * FROM economy_shop_items WHERE guild_id = ? ORDER BY price ASC', [interaction.guild.id]);
            if (items.length === 0) {
                return interaction.editReply(createContainerMessage('Market Boş', 'Ürün yok.', '#3498DB', [], [], false, true)).catch(() => {});
            }
            const { StringSelectMenuBuilder } = require('discord.js');
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('eco_market_select')
                .setPlaceholder('Satın almak istediğiniz ürünü seçin...')
                .setMinValues(1).setMaxValues(1)
                .addOptions(items.slice(0, 25).map(i => ({
                    label: i.name.substring(0, 100),
                    description: `${i.price} Jeton${i.stock !== null ? ` • Stok: ${i.stock}` : ' • Sınırsız'}`.substring(0, 100),
                    value: String(i.id)
                })));
            let listText = '';
            for (const i of items.slice(0, 10)) {
                listText += `\`#${i.id}\` **${i.name}** — ${Number(i.price).toLocaleString('tr-TR')} Jeton${i.stock !== null ? ` (Stok: ${i.stock})` : ''}\n`;
            }
            const payload = createContainerMessage('Sunucu Marketi', `${listText}\n\n-# Ürün seçince aynı kart güncellenir.`, '#5865F2', [new ActionRowBuilder().addComponents(selectMenu)]);
            await interaction.editReply(payload).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    if (interaction.customId.startsWith('eco_buy_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        const itemId = interaction.customId.split('_')[2];

        let conn;
        try {
            conn = await db.pool.getConnection();
            const items = await conn.query('SELECT * FROM economy_shop_items WHERE id = ? AND guild_id = ?', [itemId, interaction.guild.id]);
            if (items.length === 0) {
                return interaction.editReply(createContainerMessage('Hata', 'Ürün bulunamadı.', '#ED4245', [], [], false, true)).catch(() => {});
            }
            const item = items[0];

            if (item.stock !== null && item.stock <= 0) {
                return interaction.editReply(createContainerMessage('Hata', 'Bu ürünün stoğu tükenmiş.', '#ED4245', [], [], false, true)).catch(() => {});
            }

            const paid = await eco.takeBalance(interaction.user.id, Number(item.price));
            if (!paid) {
                const w = await eco.getWallet(interaction.user.id);
                return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Bu ürün **${item.price}** Jeton. Sende **${w.balance}** var.`, '#FEE75C', [], [], false, true)).catch(() => {});
            }

            if (item.item_type === 'role' && item.role_id) {
                const role = interaction.guild.roles.cache.get(item.role_id);
                if (role && !interaction.member.roles.cache.has(role.id)) {
                    await interaction.member.roles.add(role).catch(() => {});
                }
            }

            await conn.query(
                'INSERT INTO economy_inventory (guild_id, user_id, item_id, quantity) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
                [interaction.guild.id, interaction.user.id, item.id]
            );
            await conn.query("INSERT INTO economy_transactions (guild_id, from_user, amount, type) VALUES (?, ?, ?, 'shop_purchase')", [interaction.guild.id, interaction.user.id, item.price]).catch(() => {});

            if (item.stock !== null) {
                await conn.query('UPDATE economy_shop_items SET stock = stock - 1 WHERE id = ?', [item.id]);
            }

            await interaction.editReply(createContainerMessage('Satın Alım Başarılı', `<:mono:${MONO_EMOJIS.check}> **${item.name}** satın alındı!`, '#57F287', [], [], false, true)).catch(() => {});
            try { require('./achievements').trackBalance(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
        } catch (error) {
            console.error('Economy buy error:', error.message);
            await interaction.editReply(createContainerMessage('Hata', 'Satın alma başarısız oldu.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    if (interaction.customId.startsWith('eco_transfer_')) {
        await interaction.deferUpdate().catch(() => {});
        const parts = interaction.customId.split('_');
        const targetUserId = parts[2];
        const amount = parseInt(parts[3], 10);

        const ok = await eco.transferCoins(interaction.user.id, targetUserId, amount);
        if (!ok) {
            return interaction.editReply(createContainerMessage('Yetersiz Bakiye', 'İşlem iptal edildi: Bakiyen yetersiz (başkası önce harcamış olabilir).', '#FEE75C', [], [], false, true)).catch(() => {});
        }

        await db.pool.query("INSERT INTO economy_transactions (guild_id, from_user, to_user, amount, type) VALUES (?, ?, ?, ?, 'transfer')", [interaction.guild.id, interaction.user.id, targetUserId, amount]).catch(() => {});

        const successMsg = createContainerMessage('Transfer Başarılı', `<:mono:${MONO_EMOJIS.check}> <@${targetUserId}> adlı kullanıcıya **${amount}** Jeton gönderildi!`, '#57F287');
        await interaction.editReply({ ...successMsg, components: [] }).catch(() => {});
        try { require('./achievements').trackBalance(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
    }
}

module.exports = {
    handleEconomyInteractions,
    rewardMessageEconomy
};
