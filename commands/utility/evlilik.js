const { 
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, 
    SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags 
} = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evlilik')
        .setDescription('Kullanıcılar arası evlenme ve boşanma işlemlerini yönetir.')
        .addSubcommand(sub =>
            sub.setName('teklif')
                .setDescription('Bir kullanıcıya evlilik teklifi gönderir.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Evlilik teklif edilecek kullanıcı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('bosan')
                .setDescription('Mevcut evliliğinizi sonlandırır.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const author = interaction.user;

        if (sub === 'bosan') {
            await interaction.deferReply();
            const profile = await db.getUserProfile(author.id);
            if (!profile || !profile.partner_id) {
                return interaction.editReply(createContainerMessage(
                    `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Zaten Bekarsınız`,
                    'Şu anda evli değilsiniz, boşanacak bir partneriniz yok.',
                    '#ED4245', [], [], false
                ));
            }

            const exPartner = profile.partner_id;
            await db.removeMarriage(author.id);

            return interaction.editReply(createContainerMessage(
                `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Boşanma Gerçekleşti`,
                `<@${author.id}> ile <@${exPartner}> arasındaki evlilik resmi olarak sonlandırıldı.`,
                '#ED4245', [], [], false
            ));
        }

        if (sub === 'teklif') {
            const target = interaction.options.getUser('kullanici');

            if (target.id === author.id) {
                return interaction.reply({
                    ...createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Kendinle Evlenemezsin`,
                        'Kendinle evlilik teklifi edemezsin reis!',
                        '#ED4245', [], [], false
                    ),
                    flags: MessageFlags.Ephemeral
                });
            }

            if (target.bot) {
                return interaction.reply({
                    ...createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Botla Evlenemezsin`,
                        'Botlarla evlenemezsiniz.',
                        '#ED4245', [], [], false
                    ),
                    flags: MessageFlags.Ephemeral
                });
            }

            const authorProfile = await db.getUserProfile(author.id);
            if (authorProfile && authorProfile.partner_id) {
                return interaction.reply({
                    ...createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Zaten Evlisiniz`,
                        `Siz zaten <@${authorProfile.partner_id}> ile evlisiniz! Başkasına teklif etmek için önce \`/evlilik bosan\` yazmalısınız.`,
                        '#ED4245', [], [], false
                    ),
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetProfile = await db.getUserProfile(target.id);
            if (targetProfile && targetProfile.partner_id) {
                return interaction.reply({
                    ...createContainerMessage(
                        `<:mono:${MONO_EMOJIS.error || '1530917462000930887'}> Kullanıcı Zaten Evli`,
                        `<@${target.id}> zaten <@${targetProfile.partner_id}> ile evli!`,
                        '#ED4245', [], [], false
                    ),
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            const customIdYes = `marry_yes:${author.id}:${target.id}`;
            const customIdNo = `marry_no:${author.id}:${target.id}`;

            const mainContainer = new ContainerBuilder();
            const section = new SectionBuilder();
            section.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### <:mono:${MONO_EMOJIS.heart || '1538517512340119664'}> Romantik Bir Evlilik Teklifi!\n` +
                    `**<@${author.id}>**, **<@${target.id}>** kullanıcısına diz çökerek bir yüzük uzattı ve sordu:\n\n` +
                    `> *"Benimle hayatını birleştirmeye, birlikte Discord'da yaşlanmaya var mısın?"*\n\n` +
                    `*<@${target.id}>, bu teklifi kabul etmek için 60 saniyen var!*`
                )
            );
            mainContainer.addSectionComponents(section);

            const buttonContainer = new ContainerBuilder();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdYes)
                    .setLabel('Evet, Kabul Ediyorum! 💍')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(MONO_EMOJIS.success || '1530917482435579974'),
                new ButtonBuilder()
                    .setCustomId(customIdNo)
                    .setLabel('Hayır, Reddet')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(MONO_EMOJIS.error || '1530917462000930887')
            );
            buttonContainer.addActionRowComponents(row);

            const sentMsg = await interaction.editReply({
                content: `<@${target.id}>`,
                flags: MessageFlags.IsComponentsV2,
                components: [mainContainer, buttonContainer]
            });

            // Buton Tıklamalarını Toplayıcı (Collector) ile Dinle
            const collector = sentMsg.createMessageComponentCollector({
                filter: i => i.user.id === target.id,
                time: 60000,
                max: 1
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId === customIdYes) {
                    await db.setMarriage(author.id, target.id);
                    const acceptMsg = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.heart || '1538517512340119664'}> TEBRİKLER! EVLENDİLER! 💍`,
                        `**<@${author.id}>** ve **<@${target.id}>** resmi olarak dünya evine girdiler!\nBirbirinize ömür boyu mutluluklar dileriz! 🎉`,
                        '#EB459E', [], [], false
                    );
                    await interaction.editReply({ content: `<@${author.id}> <@${target.id}>`, ...acceptMsg, components: [] });
                } else {
                    const rejectMsg = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.inactive || '1530917456728559648'}> Teklif Reddedildi 💔`,
                        `**<@${target.id}>**, **<@${author.id}>** kullanıcısının evlilik teklifini geri çevirdi.`,
                        '#ED4245', [], [], false
                    );
                    await interaction.editReply({ content: '', ...rejectMsg, components: [] });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    const timeoutMsg = createContainerMessage(
                        `<:mono:${MONO_EMOJIS.timer || '1537767794551296061'}> Teklif Zaman Aşımına Uğradı`,
                        `**<@${target.id}>** 60 saniye içinde teklife yanıt vermedi.`,
                        '#95A5A6', [], [], false
                    );
                    await interaction.editReply({ content: '', ...timeoutMsg, components: [] });
                }
            });
        }
    }
};
