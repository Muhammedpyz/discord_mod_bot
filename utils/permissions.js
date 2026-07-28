function validateModTarget(interaction, targetUser, targetMember) {
    if (targetUser.id === interaction.user.id) {
        return { valid: false, reason: 'Kendiniz üzerinde bu işlemi gerçekleştiremezsiniz.' };
    }

    if (targetUser.id === interaction.client.user.id) {
        return { valid: false, reason: 'Bot üzerinde bu işlemi gerçekleştiremezsiniz.' };
    }

    if (targetUser.id === interaction.guild.ownerId) {
        return { valid: false, reason: 'Sunucu sahibi üzerinde bu işlemi gerçekleştiremezsiniz.' };
    }

    if (!targetMember) {
        return { valid: false, reason: 'Kullanıcı sunucuda bulunamadı.' };
    }

    if (targetMember) {
        const config = require('../config.json');
        // Sunucu sahibi veya Super Admin her işlemi yapabilir
        if (interaction.user.id !== interaction.guild.ownerId && !require('./systemNode').checkSystemNode(interaction.user.id)) {
            const executorHighest = interaction.member.roles.highest.position;
            const targetHighest = targetMember.roles.highest.position;

            if (executorHighest <= targetHighest) {
                return { valid: false, reason: 'Hedef üyenin rolü sizinkine eşit veya sizden yüksek olduğu için bu işlemi yapamazsınız.' };
            }
        }

        if (!targetMember.moderatable) {
            return { valid: false, reason: 'Botun rol yetkisi bu kullanıcıya işlem yapmaya yetmiyor.' };
        }
    }

    return { valid: true };
}

module.exports = { validateModTarget };
