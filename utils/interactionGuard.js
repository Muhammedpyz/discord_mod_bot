const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('./uiBuilder');

// Basit bellek içi cooldown yönetimi (Ölçeklenirse Redis'e taşınabilir)
const cooldowns = new Map();

/**
 * Merkezi Etkileşim Koruma Katmanı (Guard Middleware)
 * @param {import('discord.js').CommandInteraction | import('discord.js').ButtonInteraction} interaction 
 * @param {Object} options 
 * @param {string|bigint} options.permission Gerekli yetki (örn. PermissionFlagsBits.Administrator)
 * @param {number} options.cooldown Cooldown süresi (milisaniye)
 * @param {string} options.cooldownKey Cooldown için benzersiz anahtar (örn. 'eco_daily')
 * @param {Function} callback Guard geçilirse çalıştırılacak fonksiyon
 */
async function withGuard(interaction, options = {}, callback) {
    try {
        // 1. Yetki Kontrolü
        if (options.permission) {
            if (!interaction.member.permissions.has(options.permission)) {
                const errorPayload = createContainerMessage(
                    'Yetki Reddedildi',
                    `<:mono:${MONO_EMOJIS.lock}> Bu işlemi gerçekleştirmek için yeterli yetkiniz bulunmuyor.`,
                    '#ED4245',
                    [], [], false, true
                );
                
                if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(errorPayload);
                } else {
                    return await interaction.reply({ ...errorPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                }
            }
        }

        // 2. Cooldown Kontrolü
        if (options.cooldown && options.cooldownKey) {
            const key = `${options.cooldownKey}_${interaction.user.id}`;
            const now = Date.now();
            const lastTime = cooldowns.get(key);

            if (lastTime && (now - lastTime) < options.cooldown) {
                const remaining = Math.ceil((options.cooldown - (now - lastTime)) / 1000);
                const cooldownPayload = createContainerMessage(
                    'Biraz Yavaşlayın',
                    `<:mono:${MONO_EMOJIS.clock || MONO_EMOJIS.history || '1531752487067975963'}> Bu işlemi tekrar kullanabilmek için **${remaining} saniye** beklemelisiniz.`,
                    '#FEE75C',
                    [], [], false, true
                );

                if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(cooldownPayload);
                } else {
                    return await interaction.reply({ ...cooldownPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                }
            }
            cooldowns.set(key, now);
        }

        // 3. Callback Çalıştır
        await callback();

    } catch (error) {
        console.error(`[Guard Error] - Interaction: ${interaction.customId || interaction.commandName}`, error);
        
        const errorPayload = createContainerMessage(
            'Sistem Hatası',
            `<:mono:${MONO_EMOJIS.cross || '1531752498509910199'}> İşlem sırasında beklenmedik bir hata oluştu.`,
            '#ED4245',
            [], [], false, true
        );

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(errorPayload).catch(() => {});
        } else {
            await interaction.reply({ ...errorPayload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }
}

module.exports = {
    withGuard
};
