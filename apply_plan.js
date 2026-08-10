require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const adminRoles = ['Yönetici', 'Geliştirici', 'GOD', 'The Türklions.'];
const staffRoles = ['Discord Moderatör', 'Moderatör', 'Asistan', 'Yardımcı', 'Medya Sorumlusu', 'Ekosistem', 'Mimar'];
const vipRoles = ['VIP', 'VIP+', 'SVIP', 'MVIP', 'LVIP', 'LVIP+', 'ULTRA'];
const punishRoles = ['Ban', 'Uyarı', 'Uyarı 2', 'Mute'];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

client.once('ready', async () => {
    console.log("Sunucuya bağlanılıyor...");
    const guildId = '1441769969133293621'; // TurkLion Network
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    
    if (!guild) {
        console.log("Sunucu bulunamadı.");
        process.exit(1);
    }
    
    console.log("Roller güncelleniyor...");
    await guild.roles.fetch();
    
    for (const [id, role] of guild.roles.cache) {
        if (role.name === '@everyone' || role.managed) continue;
        
        let targetPermissions;
        if (adminRoles.includes(role.name)) {
            targetPermissions = [PermissionsBitField.Flags.Administrator];
        } else if (staffRoles.includes(role.name)) {
            targetPermissions = [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.MuteMembers,
                PermissionsBitField.Flags.KickMembers
            ];
            if (role.name === 'Moderatör' || role.name === 'Discord Moderatör') {
                targetPermissions.push(PermissionsBitField.Flags.BanMembers);
            }
        } else if (vipRoles.includes(role.name)) {
            targetPermissions = [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.UseExternalEmojis,
                PermissionsBitField.Flags.UseExternalStickers,
                PermissionsBitField.Flags.EmbedLinks,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.AddReactions
            ];
        } else if (punishRoles.includes(role.name) || role.name.toLowerCase().includes('ban') || role.name.toLowerCase().includes('mute')) {
            targetPermissions = [];
        } else {
            targetPermissions = [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.AddReactions,
                PermissionsBitField.Flags.AttachFiles
            ];
        }
        
        try {
            await role.setPermissions(targetPermissions);
            console.log(`Güncellendi: Rol ${role.name}`);
            await sleep(1000);
        } catch(e) {
            console.log(`Hata (Rol): ${role.name} - ${e.message}`);
        }
    }
    
    console.log("Kanallar güncelleniyor...");
    await guild.channels.fetch();
    
    const oyuncu = guild.roles.cache.find(r => r.name === 'Oyuncu');
    const vipRolesFound = vipRoles.map(n => guild.roles.cache.find(r => r.name === n)).filter(Boolean);
    const staffRolesFound = staffRoles.map(n => guild.roles.cache.find(r => r.name === n)).filter(Boolean);
    const punishRolesFound = punishRoles.map(n => guild.roles.cache.find(r => r.name === n)).filter(Boolean);
    const everyone = guild.roles.everyone;

    for (const [id, ch] of guild.channels.cache) {
        const name = ch.name.toLowerCase();
        
        let allowEveryone = false;
        let allowVip = false;
        let allowStaff = false;
        let readOnly = false;
        
        if (name.includes('vip') || name.includes('youtuber')) {
            allowVip = true;
        } else if (name.includes('yetkili') || name.includes('yönetim') || name.includes('mod') || name.includes('log') || name.includes('personel') || name.includes('geliştirme') || name.includes('plan') || name.includes('toplantı') || name.includes('hatalar') || name.includes('mimar') || name.includes('oda olustur')) {
            allowStaff = true;
        } else if (name.includes('kurallar') || name.includes('duyuru') || name.includes('giriş') || name.includes('bilgi')) {
            allowEveryone = true;
            readOnly = true;
        } else {
            allowEveryone = true;
        }
        
        if (!ch.permissionOverwrites || !ch.permissionOverwrites.cache) continue;

        let overwrites = Array.from(ch.permissionOverwrites.cache.values())
            .filter(ov => ov.type === 1) 
            .map(ov => ({
                id: ov.id,
                allow: ov.allow.toArray(),
                deny: ov.deny.toArray(),
                type: 1
            }));
        
        for (const pr of punishRolesFound) {
            overwrites.push({ id: pr.id, deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect], type: 0 });
        }
        
        if (allowStaff) {
            overwrites.push({ id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel], type: 0 });
            if (oyuncu) overwrites.push({ id: oyuncu.id, deny: [PermissionsBitField.Flags.ViewChannel], type: 0 });
            for (const sr of staffRolesFound) {
                if (name.includes('log')) {
                    overwrites.push({ id: sr.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages], type: 0 });
                } else {
                    overwrites.push({ id: sr.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], type: 0 });
                }
            }
        } else if (allowVip) {
            overwrites.push({ id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel], type: 0 });
            if (oyuncu) overwrites.push({ id: oyuncu.id, deny: [PermissionsBitField.Flags.ViewChannel], type: 0 });
            for (const vr of vipRolesFound) {
                overwrites.push({ id: vr.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect], type: 0 });
            }
        } else if (allowEveryone) {
            if (readOnly) {
                overwrites.push({ id: everyone.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages], type: 0 });
                if (oyuncu) overwrites.push({ id: oyuncu.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages], type: 0 });
            } else {
                overwrites.push({ id: everyone.id, allow: [PermissionsBitField.Flags.ViewChannel], type: 0 });
                if (oyuncu) overwrites.push({ id: oyuncu.id, allow: [PermissionsBitField.Flags.ViewChannel], type: 0 });
            }
        }
        
        try {
            await ch.permissionOverwrites.set(overwrites);
            console.log(`Güncellendi: Kanal ${ch.name}`);
            await sleep(1500);
        } catch(e) {
            console.log(`Hata (Kanal): ${ch.name} - ${e.message}`);
        }
    }

    console.log("Tüm işlemler tamamlandı!");
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
