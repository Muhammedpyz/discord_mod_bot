/**
 * POLLS — V2 + butonlu, TEK mesaj edit (spam yok), debounce'lu anlık yenileme.
 * custom_id: poll_vote_{pollId}_{optionId} | poll_close_{pollId} | poll_refresh_{pollId}
 * (eski poll_vote_{optionId} formatı geriye dönük desteklenir)
 * - multiple_choice=false: kullanıcı başına tek oy (UNIQUE mantığı kodda)
 * - multiple_choice=true: seçenek başına toggle
 * - anonymous=true: kimlik gizli (sadece sayı); false: son oy verenler özeti ephemeral'da
 * Rate-limit: mesaj başına edit debounce 2500ms (toplu güncelleme).
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../db');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');
const { parseFancyDuration } = require('./theme');

// pollId -> { timer, client }
const renderTimers = new Map();
function scheduleRender(client, pollId, delayMs = 2500) {
    if (renderTimers.has(pollId)) return; // zaten kuyrukta — toplu güncelleme
    const timer = setTimeout(async () => {
        renderTimers.delete(pollId);
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
            if (rows.length > 0) await renderPollMessage(client, conn, rows[0]);
        } catch (e) {
            console.error('[Poll] debounce render hatası:', e.message);
        } finally {
            if (conn) conn.release();
        }
    }, delayMs);
    renderTimers.set(pollId, { timer });
}

function bar(percent) {
    const p = Math.max(0, Math.min(100, percent));
    const filled = Math.round(p / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

async function renderPollMessage(client, conn, poll) {
    const channel = client.channels.cache.get(poll.channel_id);
    if (!channel) return;
    const message = await channel.messages.fetch(poll.message_id).catch(() => null);
    if (!message) return;

    const options = await conn.query('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY order_index ASC', [poll.id]);
    const votes = await conn.query('SELECT option_id, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_id', [poll.id]);

    let totalVotes = 0;
    const voteMap = {};
    for (const v of votes) {
        const c = Number(v.count);
        totalVotes += c;
        voteMap[v.option_id] = c;
    }

    let resultText = '';
    const actionRows = [];
    let currentRow = new ActionRowBuilder();

    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const vCount = voteMap[opt.id] || 0;
        const percent = totalVotes === 0 ? 0 : Math.round((vCount / totalVotes) * 100);
        const emoji = opt.emoji || null;
        resultText += `**${i + 1}.** ${emoji ? `${emoji} ` : ''}**${opt.label}**\n\`${bar(percent)}\` %${percent} (${vCount} oy)\n\n`;

        const btn = new ButtonBuilder()
            .setCustomId(`poll_vote_${poll.id}_${opt.id}`)
            .setLabel(String(opt.label).substring(0, 80))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(poll.status === 'closed');
        try { if (emoji) btn.setEmoji(emoji); } catch {}
        currentRow.addComponents(btn);
        if (currentRow.components.length === 5 || i === options.length - 1) {
            actionRows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
    }

    let footerDesc = `Toplam oy: ${totalVotes}`;
    if (poll.multiple_choice) footerDesc += ' • Çoklu seçim açık';
    if (poll.anonymous) footerDesc += ' • Anonim';
    if (poll.ends_at && poll.status === 'active') {
        footerDesc += ` • Bitiş: <t:${Math.floor(new Date(poll.ends_at).getTime() / 1000)}:R>`;
    } else if (poll.status === 'closed') {
        footerDesc += ` • Anket kapandı`;
    }

    // Kontrol satırı: Yenile (herkes) + Kapat (oluşturan/yetkili — handler'da doğrulanır)
    const ctrlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`poll_refresh_${poll.id}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji(MONO_EMOJIS.refresh),
        new ButtonBuilder().setCustomId(`poll_close_${poll.id}`).setLabel('Anketi Kapat').setStyle(ButtonStyle.Danger).setEmoji(MONO_EMOJIS.lock).setDisabled(poll.status === 'closed')
    );

    const pollMsg = createContainerMessage(
        `${poll.question}`,
        resultText.trim() + `\n\n-# ${footerDesc}`,
        poll.status === 'active' ? '#5865F2' : '#ED4245',
        [...actionRows, ctrlRow], [], false
    );
    await message.edit({ ...pollMsg, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

function parseYesNo(v) {
    if (!v) return false;
    const s = String(v).toLocaleLowerCase('tr-TR').trim();
    return ['evet', 'e', 'yes', 'y', '1', 'açık', 'acik', 'aktif'].includes(s);
}

async function handlePollInteractions(interaction) {
    // --- Modal submit: anket oluştur ---
    if (interaction.customId === 'poll_create_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const question = interaction.fields.getTextInputValue('poll_question');
        const rawOptions = interaction.fields.getTextInputValue('poll_options').split('\n').map(o => o.trim()).filter(o => o.length > 0);
        const durationRaw = interaction.fields.getTextInputValue('poll_duration');
        let multipleRaw = ''; let anonymousRaw = '';
        try { multipleRaw = interaction.fields.getTextInputValue('poll_multiple'); } catch {}
        try { anonymousRaw = interaction.fields.getTextInputValue('poll_anonymous'); } catch {}

        if (rawOptions.length < 2 || rawOptions.length > 10) {
            return interaction.editReply(createContainerMessage('Hata', 'En az 2, en fazla 10 seçenek belirlemelisiniz.', '#ED4245', [], [], false, true));
        }

        let endsAt = null;
        if (durationRaw && durationRaw.trim()) {
            const ms = parseFancyDuration(durationRaw.trim());
            if (!ms) {
                return interaction.editReply(createContainerMessage('Hata', 'Geçersiz süre! Örn: `24s` (24 saat), `30dk`, `1s30dk`, `2gün`. Boş bırakırsanız sınırsız olur.', '#ED4245', [], [], false, true));
            }
            endsAt = new Date(Date.now() + ms);
        }
        const multiple = parseYesNo(multipleRaw);
        const anonymous = parseYesNo(anonymousRaw);

        let conn;
        try {
            conn = await db.pool.getConnection();
            const res = await conn.query(
                'INSERT INTO polls (guild_id, channel_id, question, multiple_choice, anonymous, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [interaction.guild.id, interaction.channel.id, question, multiple, anonymous, endsAt, interaction.user.id]
            );
            const pollId = Number(res.insertId);

            for (let i = 0; i < rawOptions.length; i++) {
                await conn.query('INSERT INTO poll_options (poll_id, label, order_index) VALUES (?, ?, ?)', [pollId, rawOptions[i].substring(0, 100), i]);
            }

            const initialMsg = createContainerMessage('Anket hazırlanıyor...', 'Sonuç kartı oluşturuluyor, birazdan güncellenecek.', '#5865F2');
            const sentMsg = await interaction.channel.send({ ...initialMsg, flags: MessageFlags.IsComponentsV2 });
            await conn.query('UPDATE polls SET message_id = ? WHERE id = ?', [sentMsg.id, pollId]);

            const rows = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
            await renderPollMessage(interaction.client, conn, rows[0]);

            try { require('./achievements').trackPollCreate(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}

            await interaction.editReply(createContainerMessage('Başarılı', `Anket oluşturuldu! Oylar geldikçe **aynı mesaj** güncellenir (spam yok).${multiple ? '\n• Çoklu seçim: açık' : ''}${anonymous ? '\n• Anonim: açık' : ''}`, '#57F287', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // --- Yenile: aynı mesajı anında yeniden çiz (yeni mesaj YOK) ---
    if (interaction.customId.startsWith('poll_refresh_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const pollId = interaction.customId.split('_')[2];
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
            if (rows.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Anket bulunamadı.', '#ED4245', [], [], false, true));
            await renderPollMessage(interaction.client, conn, rows[0]);
            return interaction.editReply(createContainerMessage('Bilgi', 'Anket kartı güncellendi.', '#3498DB', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // --- Kapat: sadece oluşturan veya Mesajları Yönet yetkisi ---
    if (interaction.customId.startsWith('poll_close_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const pollId = interaction.customId.split('_')[2];
        let conn;
        try {
            conn = await db.pool.getConnection();
            const rows = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
            if (rows.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Anket bulunamadı.', '#ED4245', [], [], false, true));
            const poll = rows[0];
            const canClose = poll.created_by === interaction.user.id || interaction.member.permissions.has('ManageMessages');
            if (!canClose) return interaction.editReply(createContainerMessage('Yetki Yok', 'Bu anketi sadece oluşturan kişi veya yetkililer kapatabilir.', '#ED4245', [], [], false, true));
            await conn.query("UPDATE polls SET status = 'closed' WHERE id = ?", [pollId]);
            const fresh = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
            await renderPollMessage(interaction.client, conn, fresh[0]);
            return interaction.editReply(createContainerMessage('Bilgi', 'Anket kapatıldı. Sonuç kartı güncellendi.', '#57F287', [], [], false, true));
        } finally {
            if (conn) conn.release();
        }
        return;
    }

    // --- Oy ver: poll_vote_{pollId}_{optionId} (yeni) veya poll_vote_{optionId} (eski) ---
    if (interaction.customId.startsWith('poll_vote_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const parts = interaction.customId.split('_');
        let pollId = null; let optionId = null;
        if (parts.length >= 4) { pollId = parts[2]; optionId = parts[3]; }
        else { optionId = parts[2]; }

        let conn;
        try {
            conn = await db.pool.getConnection();
            const opts = await conn.query('SELECT * FROM poll_options WHERE id = ?', [optionId]);
            if (opts.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Seçenek bulunamadı.', '#ED4245', [], [], false, true));
            pollId = pollId || opts[0].poll_id;

            const polls = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
            if (polls.length === 0) return interaction.editReply(createContainerMessage('Hata', 'Anket bulunamadı.', '#ED4245', [], [], false, true));
            const poll = polls[0];

            if (poll.status === 'closed') {
                return interaction.editReply(createContainerMessage('Kapalı', 'Bu anket oylamaya kapatılmış.', '#ED4245', [], [], false, true));
            }
            if (poll.ends_at && new Date(poll.ends_at).getTime() <= Date.now()) {
                await conn.query("UPDATE polls SET status = 'closed' WHERE id = ?", [pollId]);
                const fresh = await conn.query('SELECT * FROM polls WHERE id = ?', [pollId]);
                await renderPollMessage(interaction.client, conn, fresh[0]);
                return interaction.editReply(createContainerMessage('Kapalı', 'Bu anketin süresi dolmuş.', '#ED4245', [], [], false, true));
            }

            if (poll.multiple_choice) {
                const existing = await conn.query('SELECT * FROM poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?', [pollId, optionId, interaction.user.id]);
                if (existing.length > 0) {
                    await conn.query('DELETE FROM poll_votes WHERE id = ?', [existing[0].id]);
                    await interaction.editReply(createContainerMessage('Bilgi', 'Bu seçenekteki oyunuz geri çekildi.', '#3498DB', [], [], false, true));
                } else {
                    await conn.query('INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)', [pollId, optionId, interaction.user.id]);
                    await interaction.editReply(createContainerMessage('Bilgi', 'Oyunuz kaydedildi. (Çoklu seçim açık — diğer seçeneklere de oy verebilirsiniz.)', '#57F287', [], [], false, true));
                    try { require('./achievements').trackPollVote(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
                }
            } else {
                const existing = await conn.query('SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?', [pollId, interaction.user.id]);
                if (existing.length > 0) {
                    if (String(existing[0].option_id) === String(optionId)) {
                        await conn.query('DELETE FROM poll_votes WHERE id = ?', [existing[0].id]);
                        await interaction.editReply(createContainerMessage('Bilgi', 'Oyunuz geri çekildi.', '#3498DB', [], [], false, true));
                    } else {
                        await conn.query('UPDATE poll_votes SET option_id = ?, voted_at = NOW() WHERE id = ?', [optionId, existing[0].id]);
                        await interaction.editReply(createContainerMessage('Bilgi', 'Oyunuz güncellendi.', '#57F287', [], [], false, true));
                    }
                } else {
                    await conn.query('INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)', [pollId, optionId, interaction.user.id]);
                    await interaction.editReply(createContainerMessage('Bilgi', 'Oyunuz kaydedildi.', '#57F287', [], [], false, true));
                    try { require('./achievements').trackPollVote(interaction.guild.id, interaction.user.id).catch(() => {}); } catch {}
                }
            }

            // Anlık yenileme hissi + rate-limit koruması: debounce'lu toplu edit (aynı mesaj)
            scheduleRender(interaction.client, pollId, 1500);
        } catch (e) {
            console.error('Poll vote error:', e);
            await interaction.editReply(createContainerMessage('Hata', 'Oy işlenirken bir sorun oluştu.', '#ED4245', [], [], false, true)).catch(() => {});
        } finally {
            if (conn) conn.release();
        }
    }
}

module.exports = { handlePollInteractions, renderPollMessage, scheduleRender };
