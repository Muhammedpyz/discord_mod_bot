const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Botun ses kanalında 7/24 kesintisiz kalma modunu açar veya kapatır.')
        .addStringOption(opt => 
            opt.setName('durum')
                .setDescription('7/24 Modu Durumu')
                .setRequired(true)
                .addChoices(
                    { name: 'Aktif (7/24 Kanalda Kal)', value: 'on' },
                    { name: 'Deaktif (Sıra Bitince Çık / Ayrıl)', value: 'off' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const mode = interaction.options.getString('durum') === 'on';
        const guildId = interaction.guildId;
        const member = interaction.member;

        await db.updateMusicConfig(guildId, { is_247_enabled: mode ? 1 : 0 });

        let player = client.manager ? client.manager.players.get(guildId) : null;
        let extraInfo = '';

        if (mode) {
            // 7/24 Açıldı
            if (player) {
                player.is247 = true;
                extraInfo = 'Bot mevcut ses kanalında 7/24 kesintisiz kalacak.';
            } else {
                // Eğer oyuncu yoksa ve komutu kullanan yetkili sesteyse, botu kanala bağla
                const voiceChannel = member?.voice?.channel;
                if (voiceChannel && client.manager) {
                    player = await client.manager.createPlayer({
                        guildId: guildId,
                        textId: interaction.channelId,
                        voiceId: voiceChannel.id,
                        deaf: true
                    }).catch(() => null);

                    if (player) {
                        player.is247 = true;
                        extraInfo = `Bot **${voiceChannel.name}** kanalına katıldı ve 7/24 moduna alındı.`;
                    } else {
                        extraInfo = 'Bot 7/24 moduna alındı.';
                    }
                } else {
                    extraInfo = '7/24 modu aktif edildi. Bir şarkı çalındığında bot kanaldan hiç ayrılmayacak.';
                }
            }
        } else {
            // 7/24 Kapatıldı
            if (player) {
                player.is247 = false;
                const isIdle = !player.playing && !player.paused && player.queue.length === 0 && !player.queue.current;
                
                if (isIdle) {
                    // Müzik çalmıyor ve sıra boşsa botu hemen kanaldan çıkar
                    player.destroy();
                    extraInfo = 'Şu anda çalan bir müzik olmadığı için bot ses kanalından ayrıldı.';
                } else {
                    extraInfo = 'Mevcut şarkı veya sıra bittiğinde bot ses kanalından otomatik olarak ayrılacak.';
                }
            } else {
                extraInfo = '7/24 modu deaktif edildi.';
            }
        }

        const payload = createContainerMessage(
            `<:mono:${mode ? (MONO_EMOJIS.check || '1530917534885478600') : (MONO_EMOJIS.cross || '1530917536806469783')}> 7/24 Radyo Modu Güncellendi`,
            `<:mono:${MONO_EMOJIS.status || '1530917510189285528'}> **Durum:** ${mode ? '**AKTİF** (7/24 Kesintisiz)' : '**DEAKTİF** (Otomatik Çıkış)'}\n\n${extraInfo}`,
            mode ? '#57F287' : '#FEE75C'
        );
        payload.flags = MessageFlags.IsComponentsV2;

        return await interaction.editReply(payload);
    }
};

