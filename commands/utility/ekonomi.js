const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const { withGuard } = require('../../utils/interactionGuard');
const eco = require('../../utils/globalEco');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ekonomi')
        .setDescription('Global Ekonomi Sistemi (tüm sunucularda tek cüzdan)')
        .addSubcommand(sub =>
            sub.setName('cuzdan')
                .setDescription('Global bakiyeni (veya başkasının) gösterir.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Bakiyesini görmek istediğiniz kişi').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('gunluk')
                .setDescription('Günlük ödülünüzü alırsınız (Seri gün bonusu ile).')
        )
        .addSubcommand(sub =>
            sub.setName('haftalik')
                .setDescription('Haftalık ödülünüzü alırsınız.')
        )
        .addSubcommand(sub =>
            sub.setName('transfer')
                .setDescription('Başka bir kullanıcıya para gönderirsiniz.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Para gönderilecek kişi').setRequired(true))
                .addIntegerOption(opt => opt.setName('miktar').setDescription('Gönderilecek miktar').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('bankaya-yatir')
                .setDescription('Nakit bakiyenden global bankaya para yatırırsın.')
                .addIntegerOption(opt => opt.setName('miktar').setDescription('Yatırılacak miktar').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('bankadan-cek')
                .setDescription('Global bankadan cüzdanına para çekersin.')
                .addIntegerOption(opt => opt.setName('miktar').setDescription('Çekilecek miktar').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('market')
                .setDescription('Sunucu sanal marketini görüntüler (Menüden satın al).')
        )
        .addSubcommand(sub =>
            sub.setName('satinal')
                .setDescription('Marketten bir eşya veya rol satın alır.')
                .addIntegerOption(opt => opt.setName('esya_id').setDescription('Satın alınacak eşyanın ID numarası (Marketten bakın)').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('envanter')
                .setDescription('Sahip olduğunuz eşyaları gösterir.')
        )
        .addSubcommand(sub =>
            sub.setName('siralama')
                .setDescription('Global en zengin üyeleri gösterir (tüm sunucular).')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

        let conn;
        try {
            conn = await db.pool.getConnection();

            if (sub === 'cuzdan') {
                const targetUser = interaction.options.getUser('kullanici') || interaction.user;
                const w = await eco.getWallet(targetUser.id);
                const balance = Number(w.balance || 0);
                const bank = Number(w.bank_balance || 0);
                const streak = Number(w.daily_streak || 0);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`eco_refresh_${targetUser.id}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
                );
                const msg = createContainerMessage(
                    `${targetUser.username} — Global Cüzdan`,
                    `**Nakit:** \`${balance.toLocaleString('tr-TR')}\` Jeton\n**Banka:** \`${bank.toLocaleString('tr-TR')}\` Jeton\n**Toplam:** \`${(balance + bank).toLocaleString('tr-TR')}\` Jeton${streak > 0 ? `\n**Günlük seri:** ${streak} gün` : ''}\n\n-# Bakiye tüm sunucularda ortaktır.`,
                    '#5865F2',
                    [row]
                );
                return interaction.editReply(msg);
            }

            else if (sub === 'gunluk') {
                await withGuard(interaction, { cooldown: 24 * 60 * 60 * 1000, cooldownKey: 'eco_daily' }, async () => {
                    const { reward, streak, bonus } = await eco.claimDaily(interaction.user.id);
                    await db.pool.query("INSERT INTO economy_transactions (guild_id, to_user, amount, type) VALUES (?, ?, ?, 'daily')", [interaction.guild.id, interaction.user.id, reward]).catch(() => {});
                    const streakText = streak > 1 ? ` (**${streak} gün** seri! +${bonus} bonus)` : '';
                    await interaction.editReply(createContainerMessage('Günlük Ödül', `<:mono:${MONO_EMOJIS.check}> Günlük ödül olarak **${reward}** Jeton kazandınız!${streakText}\nYarın tekrar gelmeyi unutmayın.`, '#57F287'));
                    try { require('../../utils/achievements').trackDailyStreak(interaction.guild.id, interaction.user.id, streak).catch(() => {}); } catch {}
                    try { require('../../utils/achievements').trackBalance(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
                });
            }

            else if (sub === 'haftalik') {
                await withGuard(interaction, { cooldown: 7 * 24 * 60 * 60 * 1000, cooldownKey: 'eco_weekly' }, async () => {
                    const reward = await eco.claimWeekly(interaction.user.id);
                    await db.pool.query("INSERT INTO economy_transactions (guild_id, to_user, amount, type) VALUES (?, ?, ?, 'weekly')", [interaction.guild.id, interaction.user.id, reward]).catch(() => {});
                    await interaction.editReply(createContainerMessage('Haftalık Ödül', `<:mono:${MONO_EMOJIS.check}> Haftalık ödül olarak **${reward}** Jeton kazandınız!`, '#57F287'));
                    try { require('../../utils/achievements').trackBalance(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
                });
            }

            else if (sub === 'bankaya-yatir') {
                const amount = interaction.options.getInteger('miktar');
                const ok = await eco.bankDeposit(interaction.user.id, amount);
                if (!ok) {
                    const w = await eco.getWallet(interaction.user.id);
                    return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Cüzdanında **${w.balance}** Jeton var, **${amount}** yatıramazsın.`, '#FEE75C', [], [], false, true));
                }
                await db.pool.query("INSERT INTO economy_transactions (guild_id, from_user, amount, type) VALUES (?, ?, ?, 'bank_deposit')", [interaction.guild.id, interaction.user.id, amount]).catch(() => {});
                await interaction.editReply(createContainerMessage('Banka Yatırımı', `<:mono:${MONO_EMOJIS.check}> **${amount}** Jeton global bankana yatırıldı.`, '#57F287', [], [], false, true));
            }

            else if (sub === 'bankadan-cek') {
                const amount = interaction.options.getInteger('miktar');
                const ok = await eco.bankWithdraw(interaction.user.id, amount);
                if (!ok) {
                    const w = await eco.getWallet(interaction.user.id);
                    return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Bankanda **${w.bank_balance}** Jeton var, **${amount}** çekemezsin.`, '#FEE75C', [], [], false, true));
                }
                await db.pool.query("INSERT INTO economy_transactions (guild_id, to_user, amount, type) VALUES (?, ?, ?, 'bank_withdraw')", [interaction.guild.id, interaction.user.id, amount]).catch(() => {});
                await interaction.editReply(createContainerMessage('Banka Çekimi', `<:mono:${MONO_EMOJIS.check}> **${amount}** Jeton cüzdanına çekildi.`, '#57F287', [], [], false, true));
            }

            else if (sub === 'transfer') {
                const targetUser = interaction.options.getUser('kullanici');
                const amount = interaction.options.getInteger('miktar');

                if (targetUser.id === interaction.user.id || targetUser.bot) {
                    return interaction.editReply(createContainerMessage('Hata', 'Kendine veya botlara para gönderemezsin.', '#ED4245', [], [], false, true));
                }

                const w = await eco.getWallet(interaction.user.id);
                if (Number(w.balance) < amount) {
                    return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Bakiyen yetersiz. (Mevcut: ${w.balance})`, '#FEE75C', [], [], false, true));
                }

                // Onay akışı (Button) — AYNI ephemeral kart düzenlenir
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`eco_transfer_${targetUser.id}_${amount}`).setLabel('Onayla').setStyle(ButtonStyle.Success).setEmoji(MONO_EMOJIS.check),
                    new ButtonBuilder().setCustomId('eco_cancel').setLabel('İptal').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.cross)
                );
                const confirmMsg = createContainerMessage('Transfer Onayı', `<@${targetUser.id}> adlı kullanıcıya **${amount}** Jeton göndereceksin (global cüzdandan). Onaylıyor musun?`, '#3498DB', [row]);
                await interaction.editReply(confirmMsg);
            }

            else if (sub === 'market') {
                const items = await conn.query('SELECT * FROM economy_shop_items WHERE guild_id = ? ORDER BY price ASC', [interaction.guild.id]);

                if (items.length === 0) {
                    return interaction.editReply(createContainerMessage('Market Boş', 'Bu sunucunun marketinde henüz hiçbir ürün yok.', '#3498DB', [], [], false, true));
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('eco_market_select')
                    .setPlaceholder('Satın almak istediğiniz ürünü seçin...')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(items.slice(0, 25).map(i => ({
                        label: i.name.substring(0, 100),
                        description: `${i.price} Jeton${i.stock !== null ? ` • Stok: ${i.stock}` : ' • Sınırsız'}`.substring(0, 100),
                        value: String(i.id)
                    })));

                const row = new ActionRowBuilder().addComponents(selectMenu);
                let listText = '';
                for (const i of items.slice(0, 10)) {
                    listText += `\`#${i.id}\` **${i.name}** — ${Number(i.price).toLocaleString('tr-TR')} Jeton${i.stock !== null ? ` (Stok: ${i.stock})` : ''}\n`;
                }
                if (items.length > 10) listText += `\n-# +${items.length - 10} ürün daha — menüden seçin`;
                const msg = createContainerMessage('Sunucu Marketi', `${listText}\n\n-# Ürün seçince aynı kart güncellenir. Ödeme global cüzdandan.`, '#5865F2', [row]);
                await interaction.editReply(msg);
            }

            else if (sub === 'satinal') {
                const itemId = interaction.options.getInteger('esya_id');

                const items = await conn.query('SELECT * FROM economy_shop_items WHERE id = ? AND guild_id = ?', [itemId, interaction.guild.id]);
                if (items.length === 0) {
                    return interaction.editReply(createContainerMessage('Hata', 'Bu ID numarasına sahip bir ürün bulunamadı.', '#ED4245', [], [], false, true));
                }
                const item = items[0];

                if (item.stock !== null && item.stock <= 0) {
                    return interaction.editReply(createContainerMessage('Hata', 'Bu ürünün stoğu tükenmiş.', '#ED4245', [], [], false, true));
                }

                const paid = await eco.takeBalance(interaction.user.id, Number(item.price));
                if (!paid) {
                    const w = await eco.getWallet(interaction.user.id);
                    return interaction.editReply(createContainerMessage('Yetersiz Bakiye', `Bu ürün **${item.price}** Jeton. Sende **${w.balance}** var.`, '#FEE75C', [], [], false, true));
                }

                if (item.item_type === 'role' && item.role_id) {
                    const role = interaction.guild.roles.cache.get(item.role_id);
                    if (role && !interaction.member.roles.cache.has(role.id)) {
                        await interaction.member.roles.add(role).catch(() => {});
                    }
                }

                await conn.query('INSERT INTO economy_inventory (guild_id, user_id, item_id, quantity) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1', [interaction.guild.id, interaction.user.id, item.id]);
                await conn.query("INSERT INTO economy_transactions (guild_id, from_user, amount, type) VALUES (?, ?, ?, 'shop_purchase')", [interaction.guild.id, interaction.user.id, item.price]).catch(() => {});

                if (item.stock !== null) {
                    await conn.query('UPDATE economy_shop_items SET stock = stock - 1 WHERE id = ?', [item.id]);
                }

                await interaction.editReply(createContainerMessage('Satın Alım Başarılı', `<:mono:${MONO_EMOJIS.check}> **${item.name}** satın alındı!`, '#57F287', [], [], false, true));
                try { require('../../utils/achievements').trackBalance(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
            }

            else if (sub === 'envanter') {
                const inv = await conn.query(
                    'SELECT i.quantity, s.name, s.description, s.item_type FROM economy_inventory i JOIN economy_shop_items s ON i.item_id = s.id WHERE i.guild_id = ? AND i.user_id = ?',
                    [interaction.guild.id, interaction.user.id]
                );

                if (inv.length === 0) {
                    return interaction.editReply(createContainerMessage('Envanter', 'Bu sunucudaki envanterin boş. (Envanter sunucu bazlıdır.)', '#3498DB', [], [], false, true));
                }

                let list = '';
                inv.forEach(i => {
                    list += `**${i.name}** (x${i.quantity}) — Tür: ${i.item_type === 'role' ? 'Rol' : 'Eşya'}\n`;
                });

                await interaction.editReply(createContainerMessage('Envanterin (bu sunucu)', list, '#5865F2', [], [], false, true));
            }

            else if (sub === 'siralama') {
                const top = await eco.getTop(10);

                if (top.length === 0) {
                    return interaction.editReply(createContainerMessage('Sıralama', 'Henüz ekonomi verisi yok.', '#3498DB', [], [], false, true));
                }

                let list = '';
                for (let i = 0; i < top.length; i++) {
                    const u = top[i];
                    const total = Number(u.balance) + Number(u.bank_balance);
                    list += `\`#${i + 1}\` <@${u.user_id}> — **${total.toLocaleString('tr-TR')} Jeton**\n`;
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('eco_top_refresh').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh)
                );
                await interaction.editReply(createContainerMessage('Global En Zenginler', list + '\n-# Tüm sunucular ortak sıralama.', '#FEE75C', [row]));
            }

        } catch (e) {
            console.error('Ekonomi komut hatası:', e);
            await interaction.editReply(createContainerMessage('Hata', 'İşlem sırasında bir sorun oluştu.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
};
