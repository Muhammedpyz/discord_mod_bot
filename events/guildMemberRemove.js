const { Events } = require('discord.js');
const { pool, getGuildConfig } = require('../db');
const { createContainerMessage } = require('../utils/uiBuilder');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        let configRow;
        try {
            configRow = await getGuildConfig(member.guild.id);
        } catch(e) {
            console.error("Config hatası guildMemberRemove:", e);
            return;
        }

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(`
                UPDATE members 
                SET is_in_guild = FALSE, last_leave = NOW(), username = ? 
                WHERE user_id = ?
            `, [member.user.username, member.id]);
            
            await conn.query(`
                UPDATE invite_tracking 
                SET has_left = TRUE 
                WHERE user_id = ? AND guild_id = ?
            `, [member.id, member.guild.id]);
            
            const ticketRows = await conn.query('SELECT * FROM tickets WHERE guild_id = ? AND owner_id = ? AND status = "open"', [member.guild.id, member.id]);
            if (ticketRows.length > 0) {
                const { refreshRoomMessageInPlace } = require('../utils/ticketSystem');
                for (const row of ticketRows) {
                    await conn.query("UPDATE tickets SET status = 'closed', closed_at = NOW(), closed_by = ?, close_reason = 'Üye sunucudan ayrıldı.' WHERE id = ?", [client.user.id, row.id]);
                    const ticketChannel = member.guild.channels.cache.get(row.channel_id);
                    if (ticketChannel) {
                        try {
                            await refreshRoomMessageInPlace(ticketChannel, {
                                status: 'Kapalı',
                                closedBy: client.user.id,
                                closeReason: 'Üye sunucudan ayrıldı.'
                            });
                            setTimeout(async () => {
                                await ticketChannel.delete().catch(() => {});
                            }, 5000);
                        } catch (e) {
                            console.error("Yetim ticket kapatma hatası:", e.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Member leave update error:", err);
        } finally {
            if (conn) conn.release();
        }

        // Uğurlama (Goodbye) Sistemi
        try {
            const { getWelcomeConfig } = require('../db');
            const { parseWelcomePlaceholders } = require('../utils/welcomeSystem');
            const { generateWelcomeCard } = require('../utils/welcomeCardGenerator');
            const { ContainerBuilder, TextDisplayBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');

            const welcomeCfg = await getWelcomeConfig(member.guild.id);
            const gChannelId = welcomeCfg?.goodbye_channel_id || configRow?.goodbye_channel_id || configRow?.welcome_channel_id;

            if (gChannelId) {
                const channel = member.guild.channels.cache.get(gChannelId);
                if (channel) {
                    const rawMsg = welcomeCfg?.goodbye_message || '{user} sunucumuzdan ayrıldı.';
                    const formattedMsg = parseWelcomePlaceholders(rawMsg, member);

                    let files = [];
                    if (welcomeCfg?.goodbye_gen_image) {
                        let fetchedUser = member.user;
                        try {
                            fetchedUser = await member.client.users.fetch(member.user.id, { force: true });
                        } catch (e) {
                            fetchedUser = member.user;
                        }

                        const avatarUrl = fetchedUser.displayAvatarURL({ extension: 'png', size: 256 });
                        const userFlags = fetchedUser.flags?.toArray() || [];
                        const isBooster = !!member.premiumSince || member.roles?.cache?.some(r => r.name.toLowerCase().includes('boost'));
                        const isOwner = member.guild?.ownerId === member.id;
                        const isBot = fetchedUser.bot;

                        const customCardHeader = welcomeCfg?.goodbye_title 
                            ? parseWelcomePlaceholders(welcomeCfg.goodbye_title, member, null, 0, true)
                            : null;
                        const customCardSubtitle = welcomeCfg?.goodbye_message
                            ? parseWelcomePlaceholders(welcomeCfg.goodbye_message, member, null, 0, true)
                            : `${member.guild.name} sunucusundan ayrıldı`;

                        const hasCountVariable = (welcomeCfg?.goodbye_message && (welcomeCfg.goodbye_message.includes('{count') || welcomeCfg.goodbye_message.includes('{memberCount}'))) ||
                                                 (welcomeCfg?.goodbye_title && (welcomeCfg.goodbye_title.includes('{count') || welcomeCfg.goodbye_title.includes('{memberCount}')));

                        const cardBuffer = await generateWelcomeCard({
                            avatarUrl,
                            username: fetchedUser.tag || fetchedUser.username,
                            customHeader: customCardHeader,
                            customSubtitle: customCardSubtitle,
                            guildName: member.guild.name,
                            memberCount: member.guild.memberCount,
                            type: 'goodbye',
                            userFlags,
                            isBooster,
                            isOwner,
                            isBot,
                            showCountPill: !!hasCountVariable
                        });
                        if (cardBuffer) {
                            files.push(new AttachmentBuilder(cardBuffer, { name: 'goodbye.png' }));
                        }
                    }

                    if (welcomeCfg?.goodbye_plain_text) {
                        await channel.send({ content: formattedMsg, files }).catch(e => console.error("Goodbye send error:", e));
                    } else {
                        const container = new ContainerBuilder();
                        if (welcomeCfg?.goodbye_show_title !== false && welcomeCfg?.goodbye_show_title !== 0) {
                            const title = welcomeCfg?.goodbye_title 
                                ? parseWelcomePlaceholders(welcomeCfg.goodbye_title, member)
                                : `Görüşürüz, ${member.user.username}!`;
                            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
                        }
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(formattedMsg));

                        if (files.length > 0) {
                            const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
                            container.addMediaGalleryComponents(
                                new MediaGalleryBuilder().addItems(
                                    new MediaGalleryItemBuilder().setURL('attachment://goodbye.png')
                                )
                            );
                        }

                        await channel.send({
                            components: [container],
                            files,
                            flags: MessageFlags.IsComponentsV2
                        }).catch(e => console.error("Goodbye V2 send error:", e));
                    }
                }
            }
        } catch (goodbyeErr) {
            console.error("Goodbye dispatch error:", goodbyeErr);
        }

        // Sayaç güncelle (üye ayrıldı)
        try {
            const { updateSayac } = require('../utils/kayitHandler');
            if (member.guild) await updateSayac(member.guild).catch(() => {});
        } catch (e) {
            console.error('[Sayaç hook]:', e.message);
        }
    }
};
