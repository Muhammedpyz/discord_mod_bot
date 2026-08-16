const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dump')
        .setDescription('Sunucu verilerini (ceza sicili, uyarılar, üye listesi) dosya olarak dışa aktarır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('cezalar')
                .setDescription('Sunucudaki tüm ceza geçmişini (mute, ban vb.) dosya olarak indirir.')
        )
        .addSubcommand(sub =>
            sub.setName('uyarilar')
                .setDescription('Sunucudaki tüm uyarı kayıtlarını dosya olarak indirir.')
        )
        .addSubcommand(sub =>
            sub.setName('uyeler')
                .setDescription('Sunucudaki tüm üyeleri (ID, Kullanıcı Adı, Roller) liste dosyası olarak indirir.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const guildId = guild.id;

        if (sub === 'cezalar') {
            const mutes = await db.dumpGuildPunishments(guildId);
            if (mutes.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Kayıt Yok`,
                    'Sunucuda kayıtlı herhangi bir ceza bulunamadı.',
                    '#5865F2', [], [], false
                ));
            }

            let fileContent = `========================================================\n`;
            fileContent += `SUNUCU CEZA SİCİL DÖKÜMÜ - ${guild.name} (${guild.id})\n`;
            fileContent += `Oluşturulma Tarihi: ${new Date().toISOString()}\n`;
            fileContent += `Toplam Ceza Sayısı: ${mutes.length}\n`;
            fileContent += `========================================================\n\n`;

            mutes.forEach((m, idx) => {
                fileContent += `[#${idx + 1}] ID: ${m.id} | Hedef: ${m.user_id} | Tür: ${m.action_type} | Yetkili: ${m.moderator_id}\n`;
                fileContent += `      Sebep: ${m.reason || 'Belirtilmedi'}\n`;
                fileContent += `      Tarih: ${m.created_at} | Bitiş: ${m.expires_at || 'Süresiz'} | Aktif: ${m.is_active ? 'EVET' : 'HAYIR'}\n\n`;
            });

            const buffer = Buffer.from(fileContent, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `${guild.name}_ceza_dokumu_${Date.now()}.txt` });

            const title = `<:mono:${MONO_EMOJIS.shield || '1530917506867400775'}> Ceza Sicili Dışa Aktarıldı`;
            const desc = `Toplam **${mutes.length}** adet ceza kaydı metin dosyası olarak hazırlandı.`;

            return interaction.editReply({
                ...createContainerMessage(title, desc, '#57F287', [], [], false),
                files: [attachment]
            });
        }

        if (sub === 'uyarilar') {
            const warns = await db.dumpGuildWarnings(guildId);
            if (warns.length === 0) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.info || '1530917464731422730'}> Kayıt Yok`,
                    'Sunucuda kayıtlı herhangi bir uyarı bulunamadı.',
                    '#5865F2', [], [], false
                ));
            }

            let fileContent = `========================================================\n`;
            fileContent += `SUNUCU UYARI DÖKÜMÜ - ${guild.name} (${guild.id})\n`;
            fileContent += `Oluşturulma Tarihi: ${new Date().toISOString()}\n`;
            fileContent += `Toplam Uyarı Sayısı: ${warns.length}\n`;
            fileContent += `========================================================\n\n`;

            warns.forEach((w, idx) => {
                fileContent += `[#${idx + 1}] ID: ${w.id} | Kullanıcı: ${w.user_id} | Yetkili: ${w.moderator_id}\n`;
                fileContent += `      Sebep: ${w.reason || 'Belirtilmedi'}\n`;
                fileContent += `      Tarih: ${w.created_at}\n\n`;
            });

            const buffer = Buffer.from(fileContent, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `${guild.name}_uyari_dokumu_${Date.now()}.txt` });

            const title = `<:mono:${MONO_EMOJIS.warn || '1530917488806727761'}> Uyarılar Dışa Aktarıldı`;
            const desc = `Toplam **${warns.length}** adet uyarı kaydı metin dosyası olarak hazırlandı.`;

            return interaction.editReply({
                ...createContainerMessage(title, desc, '#57F287', [], [], false),
                files: [attachment]
            });
        }

        if (sub === 'uyeler') {
            await guild.members.fetch();
            const members = Array.from(guild.members.cache.values());

            let csvContent = `ID,Kullanıcı Adı,Global İsim,Bot mu,Katılma Tarihi,Hesap Oluşturma,Roller\n`;

            members.forEach(m => {
                const username = (m.user.username || '').replace(/,/g, '');
                const globalName = (m.user.globalName || '').replace(/,/g, '');
                const isBot = m.user.bot ? 'EVET' : 'HAYIR';
                const joinedAt = m.joinedAt ? m.joinedAt.toISOString() : 'Bilinmiyor';
                const createdAt = m.user.createdAt ? m.user.createdAt.toISOString() : 'Bilinmiyor';
                const roles = m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name.replace(/,/g, '')).join('; ');

                csvContent += `${m.id},"${username}","${globalName}",${isBot},${joinedAt},${createdAt},"${roles}"\n`;
            });

            const buffer = Buffer.from(csvContent, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `${guild.name}_uye_listesi_${Date.now()}.csv` });

            const title = `<:mono:${MONO_EMOJIS.user || '1537768132062486558'}> Üye Listesi Dışa Aktarıldı`;
            const desc = `Toplam **${members.length}** adet üye CSV tablosu olarak dışa aktarıldı.`;

            return interaction.editReply({
                ...createContainerMessage(title, desc, '#57F287', [], [], false),
                files: [attachment]
            });
        }
    }
};
