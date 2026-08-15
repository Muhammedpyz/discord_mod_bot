const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder } = require('discord.js');
const { pool } = require('../../db');
const { MONO_EMOJIS } = require('../../utils/uiBuilder');

async function buildPingPayload(interaction, client) {
    const startDb = Date.now();
    let dbPing = 0;
    try {
        const conn = await pool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        dbPing = Date.now() - startDb;
    } catch (e) {
        dbPing = -1;
    }

    const wsPing = client.ws.ping;
    const apiPing = Math.abs(Date.now() - interaction.createdTimestamp);

    // Status Indicator
    let statusEmoji = MONO_EMOJIS.check;
    let statusText = 'Mükemmel & Kesintisiz';
    let statusColor = '#57F287';

    if (wsPing > 200 || apiPing > 300) {
        statusEmoji = MONO_EMOJIS.warning;
        statusText = 'Orta Düzey Gecikme';
        statusColor = '#FEE75C';
    } else if (wsPing > 500 || apiPing > 700 || dbPing === -1) {
        statusEmoji = MONO_EMOJIS.cross;
        statusText = 'Yüksek Gecikme / Sorunlu';
        statusColor = '#ED4245';
    }

    const container = new ContainerBuilder()
        .setAccentColor(parseInt(statusColor.replace('#', ''), 16));

    const titleText = `## <:mono:${MONO_EMOJIS.zap}> **Canlı Bağlantı & Gecikme Testi**\n` +
                      `> Botun Discord sunucuları, API ağ geçidi ve veritabanı yanıt hızları.\n\n` +
                      `### <:mono:${statusEmoji}> **Sistem Durumu:** \`${statusText}\``;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const detailsText = 
        `### <:mono:${MONO_EMOJIS.activity || MONO_EMOJIS.gauge}> **Gecikme Değerleri**\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Discord Gateway (WebSocket):** \`${wsPing} ms\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **Mesaj / REST API Yanıtı:** \`${apiPing} ms\`\n` +
        `<:mono:${MONO_EMOJIS.chevron_right}> **MariaDB Veritabanı:** \`${dbPing >= 0 ? `${dbPing} ms` : 'Bağlantı Hatası'}\`\n\n` +
        `- # Ölçüm Zamanı: <t:${Math.floor(Date.now() / 1000)}:R>`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detailsText));

    const refreshBtn = new ButtonBuilder()
        .setCustomId('ping_refresh')
        .setLabel('Yeniden Ölç')
        .setEmoji(MONO_EMOJIS.refresh_cw)
        .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(refreshBtn);
    container.addActionRowComponents(actionRow);

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botun canlı WebSocket, REST API ve veritabanı gecikme hızını test eder.'),

    buildPingPayload,

    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const payload = await buildPingPayload(interaction, client);
        return await interaction.editReply(payload);
    }
};
