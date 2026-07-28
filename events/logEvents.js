const { Events } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { createContainerMessage } = require('../utils/uiBuilder');

module.exports = [
 {
 name: Events.MessageDelete,
 async execute(message, client) {
 if (!message.guild) return;
 if (message.author?.bot) return;

 const authorTag = message.author ? message.author.tag : 'Bilinmeyen Kullanıcı';
 const authorId = message.author ? message.author.id : null;
 const authorMention = authorId ? `<@${authorId}>` : 'Bilinmeyen Kullanıcı';

 // Snipe için kaydet
 if (client && client.snipes) {
 client.snipes.set(message.channel.id, {
 content: message.content || '',
 author: message.author || { tag: authorTag, id: '0' },
 image: message.attachments?.first() ? message.attachments.first().proxyURL : null,
 timestamp: Date.now()
 });
 }

 // Audit Logs ile mesajı sileyini tespit et
 let deletedById = authorId;
 let deleteReason = 'Kullanıcı Kendi Sildi';

 try {
 const { AuditLogEvent } = require('discord.js');
 const fetchedLogs = await message.guild.fetchAuditLogs({
 limit: 1,
 type: AuditLogEvent.MessageDelete,
 }).catch(() => null);

 if (fetchedLogs) {
 const deletionLog = fetchedLogs.entries.first();
 if (deletionLog) {
 const { executor, target, createdTimestamp, reason } = deletionLog;
 if (target?.id === authorId && (Date.now() - createdTimestamp < 5000)) {
 deletedById = executor.id;
 deleteReason = reason ? `Yetkili Silme: ${reason}` : 'Yetkili Tarafından Silindi';
 }
 }
 }
 } catch (e) {}

 // DB'ye kaydet (Panel ve Sorgu için)
 const { pool } = require('../db');
 if (authorId && message.content && message.content.trim().length > 0) {
 pool.query(
 'INSERT INTO deleted_messages (guild_id, channel_id, user_id, deleted_by, reason, content) VALUES (?, ?, ?, ?, ?, ?)',
 [message.guild.id, message.channel.id, authorId, deletedById, deleteReason, message.content.substring(0, 2000)]
 ).catch(err => console.error("Deleted message DB insert error:", err));
 }

 let contentText = message.content || '*[İçerik Geçmişte Önbelleğe Alınmamış veya Sadece Medya]*';
 if (contentText.length > 1024) contentText = contentText.slice(0, 1021) + '...';
 
 const fields = [
 { name: 'Kanal', value: `<#${message.channel.id}> (\`${message.channel.name || 'Bilinmiyor'}\`)`, inline: true },
 { name: 'Mesaj Sahibi', value: authorMention, inline: true },
 { name: 'Silen Yetkili / Kişi', value: deletedById === authorId ? 'Kullanıcı Kendi Sildi' : `<@${deletedById}>`, inline: true },
 { name: 'Silinme Sebebi', value: deleteReason, inline: true },
 { name: 'Mesaj ID', value: `\`${message.id}\``, inline: true },
 { name: 'Silinen İçerik', value: `\`\`\`\n${contentText}\n\`\`\``, inline: false }
 ];

 if (message.mentions?.users?.size > 0) {
 fields.push({ name: 'Uyarı', value: 'Ghost Ping Tespit Edildi! (Etiket içeren mesaj silindi)', inline: false });
 }

 const payload = createContainerMessage('Mesaj Silindi', '', '#FF4444', [], fields);
 sendLog(message.guild, payload);
 }
 },
 {
 name: Events.MessageUpdate,
 execute(oldMessage, newMessage) {
 if (!oldMessage.guild) return;
 if (oldMessage.author?.bot || newMessage.author?.bot) return;
 if (oldMessage.content === newMessage.content) return;

 const authorMention = oldMessage.author ? `<@${oldMessage.author.id}>` : (newMessage.author ? `<@${newMessage.author.id}>` : 'Bilinmeyen Kullanıcı');

 let oldText = oldMessage.content || '*[Eski İçerik Önbellekte Yok]*';
 if (oldText.length > 1024) oldText = oldText.slice(0, 1021) + '...';
 
 let newText = newMessage.content || '*[Yeni İçerik Önbellekte Yok]*';
 if (newText.length > 1024) newText = newText.slice(0, 1021) + '...';

 const fields = [
 { name: 'Kanal', value: `<#${oldMessage.channel.id}> (\`${oldMessage.channel.name || 'Bilinmiyor'}\`)`, inline: true },
 { name: 'Mesaj Sahibi', value: authorMention, inline: true },
 { name: 'Mesaj Bağlantısı', value: `[Mesaja Git](${newMessage.url})`, inline: true },
 { name: 'Eski İçerik', value: `\`\`\`\n${oldText}\n\`\`\``, inline: false },
 { name: 'Yeni İçerik', value: `\`\`\`\n${newText}\n\`\`\``, inline: false }
 ];

 const payload = createContainerMessage('Mesaj Düzenlendi', '', '#FFCC00', [], fields);
 sendLog(oldMessage.guild, payload);
 }
 },
 {
 name: Events.GuildMemberUpdate,
 execute(oldMember, newMember) {
 if (!oldMember.guild) return;

 // Nickname değişimi
 if (oldMember.nickname !== newMember.nickname) {
 const payload = createContainerMessage(
 'İsim (Nickname) Değiştirildi',
 '',
 '#00AAFF',
 [],
 [
 { name: 'Üye', value: `<@${newMember.id}>`, inline: true },
 { name: 'Eski İsim', value: `\`${oldMember.nickname || oldMember.user.username}\``, inline: true },
 { name: 'Yeni İsim', value: `\`${newMember.nickname || newMember.user.username}\``, inline: true }
 ]
 );
 sendLog(newMember.guild, payload);
 }

 // Rol Ekleme/Çıkarma
 if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
 const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
 const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

 if (addedRoles.size > 0) {
 const payload = createContainerMessage(
 'Rol Eklendi',
 '',
 '#00FF00',
 [],
 [
 { name: 'Üye', value: `<@${newMember.id}>`, inline: true },
 { name: 'Verilen Rol(ler)', value: addedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true }
 ]
 );
 sendLog(newMember.guild, payload);
 }

 if (removedRoles.size > 0) {
 const payload = createContainerMessage('Rol Alındı', '', '#FF5555', [], [
 { name: 'Üye', value: `<@${newMember.id}>`, inline: true },
 { name: 'Alınan Rol(ler)', value: removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true }
 ]);
 sendLog(newMember.guild, payload);
 }
 }
 }
 },
 {
 name: Events.VoiceStateUpdate,
 execute(oldState, newState) {
 if (!oldState.guild) return;
 const member = newState.member || oldState.member;
 if (!member || member.user.bot) return;

 // Kanala Katılma
 if (!oldState.channelId && newState.channelId) {
 const payload = createContainerMessage('Ses Kanalına Katıldı', '', '#00FFaa', [], [
 { name: 'Üye', value: `<@${member.id}>`, inline: true },
 { name: 'Kanal', value: `<#${newState.channelId}> (\`${newState.channel.name}\`)`, inline: true }
 ]);
 sendLog(newState.guild, payload);
 }
 // Kanaldan Ayrılma
 else if (oldState.channelId && !newState.channelId) {
 const payload = createContainerMessage('Ses Kanalından Ayrıldı', '', '#FFaa00', [], [
 { name: 'Üye', value: `<@${member.id}>`, inline: true },
 { name: 'Ayrıldığı Kanal', value: `<#${oldState.channelId}> (\`${oldState.channel.name}\`)`, inline: true }
 ]);
 sendLog(newState.guild, payload);
 }
 // Kanal Değiştirme
 else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
 const payload = createContainerMessage('Ses Kanalı Değiştirildi', '', '#00AAFF', [], [
 { name: 'Üye', value: `<@${member.id}>`, inline: false },
 { name: 'Eski Kanal', value: `<#${oldState.channelId}> (\`${oldState.channel.name}\`)`, inline: true },
 { name: 'Yeni Kanal', value: `<#${newState.channelId}> (\`${newState.channel.name}\`)`, inline: true }
 ]);
 sendLog(newState.guild, payload);
 }

 // Sunucu Tarafından Mute/Deafen Uygulanması
 if (oldState.serverMute !== newState.serverMute) {
 const payload = createContainerMessage(newState.serverMute ? 'Seste Susturuldu (Server Mute)' : 'Sesteki Susturması Kaldırıldı', '', newState.serverMute ? '#FF5555' : '#55FF55', [], [
 { name: 'Üye', value: `<@${member.id}>`, inline: true },
 { name: 'Kanal', value: newState.channelId ? `<#${newState.channelId}>` : 'Bilinmiyor', inline: true }
 ]);
 sendLog(newState.guild, payload);
 }

 if (oldState.serverDeaf !== newState.serverDeaf) {
 const payload = createContainerMessage(newState.serverDeaf ? 'Seste Sağırlaştırıldı (Server Deafen)' : 'Sesteki Sağırlaştırılması Kaldırıldı', '', newState.serverDeaf ? '#FF5555' : '#55FF55', [], [
 { name: 'Üye', value: `<@${member.id}>`, inline: true },
 { name: 'Kanal', value: newState.channelId ? `<#${newState.channelId}>` : 'Bilinmiyor', inline: true }
 ]);
 sendLog(newState.guild, payload);
 }
 }
 },
 {
 name: Events.ChannelCreate,
 execute(channel) {
 if (!channel.guild) return;
 const payload = createContainerMessage('Yeni Kanal Oluşturuldu', '', '#00FF00', [], [
 { name: 'Kanal', value: `<#${channel.id}>`, inline: true },
 { name: 'İsim', value: `\`${channel.name}\``, inline: true },
 { name: 'Tür', value: `\`${channel.type}\``, inline: true }
 ]);
 sendLog(channel.guild, payload);
 }
 },
 {
 name: Events.ChannelDelete,
 execute(channel) {
 if (!channel.guild) return;
 const payload = createContainerMessage('Kanal Silindi', '', '#FF0000', [], [
 { name: 'İsim', value: `\`${channel.name}\``, inline: true },
 { name: 'Tür', value: `\`${channel.type}\``, inline: true }
 ]);
 sendLog(channel.guild, payload);
 }
 },
 {
 name: Events.GuildRoleCreate,
 execute(role) {
 const payload = createContainerMessage('Yeni Rol Oluşturuldu', '', '#00FF00', [], [
 { name: 'Rol', value: `<@&${role.id}>`, inline: true },
 { name: 'İsim', value: `\`${role.name}\``, inline: true },
 { name: 'Renk Kodu', value: `\`${role.hexColor}\``, inline: true }
 ]);
 sendLog(role.guild, payload);
 }
 },
 {
 name: Events.GuildRoleDelete,
 execute(role) {
 const payload = createContainerMessage('Rol Silindi', '', '#FF0000', [], [
 { name: 'İsim', value: `\`${role.name}\``, inline: true },
 { name: 'Renk Kodu', value: `\`${role.hexColor}\``, inline: true }
 ]);
 sendLog(role.guild, payload);
 }
 },
 {
 name: Events.ChannelUpdate,
 execute(oldChannel, newChannel) {
 if (!oldChannel.guild) return;
 if (oldChannel.name !== newChannel.name) {
 const payload = createContainerMessage('Kanal İsim Değişikliği', '', '#00AAFF', [], [
 { name: 'Kanal', value: `<#${newChannel.id}>`, inline: true },
 { name: 'Eski İsim', value: `\`${oldChannel.name}\``, inline: true },
 { name: 'Yeni İsim', value: `\`${newChannel.name}\``, inline: true }
 ]);
 sendLog(newChannel.guild, payload);
 }
 }
 },
 {
 name: Events.GuildBanRemove,
 execute(ban) {
 const payload = createContainerMessage('Yasaklama (Ban) Kaldırıldı', '', '#00FF00', [], [
 { name: 'Kullanıcı', value: `<@${ban.user.id}> (\`${ban.user.tag}\`)`, inline: true },
 { name: 'ID', value: `\`${ban.user.id}\``, inline: true }
 ]);
 sendLog(ban.guild, payload);
 }
 },
 {
 name: Events.InviteCreate,
 execute(invite) {
 if (!invite.guild) return;
 const inviter = invite.inviter ? `<@${invite.inviter.id}>` : 'Bilinmiyor';
 const payload = createContainerMessage('Yeni Davet Bağlantısı Oluşturuldu', '', '#00FFaa', [], [
 { name: 'Kanal', value: `<#${invite.channel?.id}>`, inline: true },
 { name: 'Oluşturan', value: inviter, inline: true },
 { name: 'Kod', value: `\`${invite.code}\``, inline: true },
 { name: 'Süre/Kullanım', value: `${invite.maxAge ? `${invite.maxAge}sn` : 'Süresiz'} / ${invite.maxUses ? `${invite.maxUses} kullanım` : 'Sınırsız'}`, inline: true }
 ]);
 sendLog(invite.guild, payload);
 }
 },
 {
 name: Events.InviteDelete,
 execute(invite) {
 if (!invite.guild) return;
 const payload = createContainerMessage('Davet Bağlantısı Silindi', '', '#FFaa00', [], [
 { name: 'Kanal', value: invite.channel ? `<#${invite.channel.id}>` : 'Bilinmiyor', inline: true },
 { name: 'Kod', value: `\`${invite.code}\``, inline: true }
 ]);
 sendLog(invite.guild, payload);
 }
 }
];
