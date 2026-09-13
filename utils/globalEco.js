const { MessageFlags } = require('discord.js');
const db = require('../db');

/**
 * GLOBAL EKONOMİ (OwO tarzı) — tek cüzdan, tüm sunucularda geçerli.
 * Tüm bakiye işlemleri BURADAN yapılır. Sunucu-bazlı economy_users'a yazılmaz.
 * Atomik harcama: UPDATE ... WHERE balance >= ? (affectedRows kontrolü, race-safe).
 */

async function getWallet(userId) {
    const rows = await db.pool.query('SELECT * FROM global_wallet WHERE user_id = ?', [userId]);
    if (rows.length > 0) return rows[0];
    await db.pool.query('INSERT IGNORE INTO global_wallet (user_id) VALUES (?)', [userId]);
    const fresh = await db.pool.query('SELECT * FROM global_wallet WHERE user_id = ?', [userId]);
    return fresh[0] || { user_id: userId, balance: 0, bank_balance: 0, last_daily: null, last_weekly: null, daily_streak: 0 };
}

async function addBalance(userId, amount) {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) return getWallet(userId);
    await db.pool.query('INSERT INTO global_wallet (user_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?', [userId, amount, amount]);
    return getWallet(userId);
}

/** Yeterli bakiye varsa düşer, yoksa false döner (atomik). */
async function takeBalance(userId, amount) {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) return true;
    const res = await db.pool.query('UPDATE global_wallet SET balance = balance - ? WHERE user_id = ? AND balance >= ?', [amount, userId, amount]);
    return (res.affectedRows || 0) > 0;
}

async function transferCoins(fromId, toId, amount) {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) return false;
    let conn;
    try {
        conn = await db.pool.getConnection();
        await conn.beginTransaction();
        await conn.query('INSERT IGNORE INTO global_wallet (user_id) VALUES (?)', [fromId]);
        await conn.query('INSERT IGNORE INTO global_wallet (user_id) VALUES (?)', [toId]);
        const rows = await conn.query('SELECT balance FROM global_wallet WHERE user_id = ? FOR UPDATE', [fromId]);
        if (!rows[0] || Number(rows[0].balance) < amount) {
            await conn.rollback();
            return false;
        }
        await conn.query('UPDATE global_wallet SET balance = balance - ? WHERE user_id = ?', [amount, fromId]);
        await conn.query('UPDATE global_wallet SET balance = balance + ? WHERE user_id = ?', [amount, toId]);
        await conn.commit();
        return true;
    } catch {
        if (conn) await conn.rollback().catch(() => {});
        return false;
    } finally {
        if (conn) conn.release();
    }
}

async function bankDeposit(userId, amount) {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) return false;
    const res = await db.pool.query('UPDATE global_wallet SET balance = balance - ?, bank_balance = bank_balance + ? WHERE user_id = ? AND balance >= ?', [amount, amount, userId, amount]);
    return (res.affectedRows || 0) > 0;
}

async function bankWithdraw(userId, amount) {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) return false;
    const res = await db.pool.query('UPDATE global_wallet SET bank_balance = bank_balance - ?, balance = balance + ? WHERE user_id = ? AND bank_balance >= ?', [amount, amount, userId, amount]);
    return (res.affectedRows || 0) > 0;
}

/** Günlük ödül: streak hesabı global last_daily'ye göre. {reward, streak} döner. */
async function claimDaily(userId) {
    const w = await getWallet(userId);
    let streak = 1;
    if (w.last_daily) {
        const last = new Date(w.last_daily);
        const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diff = Math.round((today - lastDay) / 86400000);
        if (diff === 1) streak = (Number(w.daily_streak) || 0) + 1;
    }
    if (streak > 14) streak = 14;
    const base = 30 + Math.floor(Math.random() * 31); // 30-60
    const bonus = streak * 8;
    const reward = base + bonus;
    await db.pool.query('UPDATE global_wallet SET balance = balance + ?, last_daily = NOW(), daily_streak = ? WHERE user_id = ?', [reward, streak, userId]);
    return { reward, streak, bonus };
}

async function claimWeekly(userId) {
    const reward = 150 + Math.floor(Math.random() * 101); // 150-250
    await db.pool.query('INSERT INTO global_wallet (user_id, balance, last_weekly) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE balance = balance + ?, last_weekly = NOW()', [userId, reward, reward]);
    return reward;
}

async function getTop(limit = 10) {
    return db.pool.query('SELECT user_id, balance, bank_balance FROM global_wallet ORDER BY (balance + bank_balance) DESC LIMIT ?', [limit]);
}

module.exports = { getWallet, addBalance, takeBalance, transferCoins, bankDeposit, bankWithdraw, claimDaily, claimWeekly, getTop };
