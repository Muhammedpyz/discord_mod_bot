const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

const RP_ACTIONS = {
    'hug': { tr: 'sarıldı', selfTr: 'kendine sarıldı', icon: 'heart', animeAction: 'hug' },
    'kiss': { tr: 'öptü', selfTr: 'aynayı öptü', icon: 'heart', animeAction: 'kiss' },
    'slap': { tr: 'tokatladı', selfTr: 'kendine tokat attı', icon: 'fire', animeAction: 'slap' },
    'kill': { tr: 'ortadan kaldırdı', selfTr: 'kendini yok etti', icon: 'warn', animeAction: 'punch' },
    'pat': { tr: 'başını okşadı', selfTr: 'kendi başını okşadı', icon: 'star', animeAction: 'pat' },
    'poke': { tr: 'dürttü', selfTr: 'kendini dürttü', icon: 'disc', animeAction: 'poke' },
    'cuddle': { tr: 'sokuldu', selfTr: 'yastığına sokuldu', icon: 'heart', animeAction: 'cuddle' },
    'dance': { tr: 'ile dans etti', selfTr: 'tek başına çılgınca dans ediyor', icon: 'music', animeAction: 'dance' },
    'cry': { tr: 'omzunda ağladı', selfTr: 'hüngür hüngür ağlıyor', icon: 'inactive', animeAction: 'cry' },
    'blush': { tr: 'karşısında utandı', selfTr: 'kıpkırmızı oldu', icon: 'heart', animeAction: 'blush' },
    'laugh': { tr: 'ile birlikte kahkaha attı', selfTr: 'kahkahalara boğuldu', icon: 'star', animeAction: 'laugh' },
    'sleep': { tr: 'ile birlikte uykuya daldı', selfTr: 'mırıl mırıl uyuyor', icon: 'timer', animeAction: 'sleep' },
    'smile': { tr: 'için gülümsedi', selfTr: 'tatlı tatlı gülümsüyor', icon: 'star', animeAction: 'smile' },
    'wink': { tr: 'üzerine göz kırptı', selfTr: 'etrafına göz kırptı', icon: 'star', animeAction: 'wink' },
    'thumbsup': { tr: 'için parmak kaldırdı (Onayladı)', selfTr: 'kendini tebrik etti', icon: 'success', animeAction: 'thumbsup' },
    'shrug': { tr: 'karşısında omuz silkti', selfTr: 'omuz silkti', icon: 'info', animeAction: 'shrug' },
    'salute': { tr: 'önünde selam durdu', selfTr: 'asker selamı verdi', icon: 'shield', animeAction: 'salute' },
    'facepalm': { tr: 'yüzünden yüzünü kapattı', selfTr: 'yüzünü kapattı (Facepalm)', icon: 'warn', animeAction: 'facepalm' },
    'deathstare': { tr: 'üzerine ölümcül bakış attı', selfTr: 'karanlık bakışlar atıyor', icon: 'warn', animeAction: 'stare' },
    'eat': { tr: 'ile birlikte yemek yedi', selfTr: 'afiyetle yemek yiyor', icon: 'star', animeAction: 'feed' },
    'bow': { tr: 'önünde saygıyla eğildi', selfTr: 'saygıyla eğildi', icon: 'owner', animeAction: 'bow' },
    'clap': { tr: 'için alkış tuttu', selfTr: 'hararetle alkışlıyor', icon: 'star', animeAction: 'clap' },
    'run': { tr: 'görünce arkasına bakmadan kaçtı', selfTr: 'hızla koşuyor', icon: 'timer', animeAction: 'run' },
    'tickle': { tr: 'gıdıkladı', selfTr: 'kıkırdıyor', icon: 'star', animeAction: 'tickle' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rp')
        .setDescription('24 farklı GIF destekli interaktif rol yapma (Roleplay) eylemi gerçekleştirir.')
        .addStringOption(opt =>
            opt.setName('eylem')
                .setDescription('Gerçekleştirilecek rol yapma eylemi')
                .setRequired(true)
                .addChoices(
                    { name: 'Sarıl (Hug)', value: 'hug' },
                    { name: 'Öp (Kiss)', value: 'kiss' },
                    { name: 'Tokatla (Slap)', value: 'slap' },
                    { name: 'Öldür (Kill)', value: 'kill' },
                    { name: 'Başını Okşa (Pat)', value: 'pat' },
                    { name: 'Dürt (Poke)', value: 'poke' },
                    { name: 'Sokul (Cuddle)', value: 'cuddle' },
                    { name: 'Dans Et (Dance)', value: 'dance' },
                    { name: 'Ağla (Cry)', value: 'cry' },
                    { name: 'Utan (Blush)', value: 'blush' },
                    { name: 'Gül (Laugh)', value: 'laugh' },
                    { name: 'Uyu (Sleep)', value: 'sleep' },
                    { name: 'Gülümse (Smile)', value: 'smile' },
                    { name: 'Göz Kırp (Wink)', value: 'wink' },
                    { name: 'Onayla (Thumbsup)', value: 'thumbsup' },
                    { name: 'Omuz Silk (Shrug)', value: 'shrug' },
                    { name: 'Selam Dur (Salute)', value: 'salute' },
                    { name: 'Yüz Kapat (Facepalm)', value: 'facepalm' },
                    { name: 'Ölümcül Bakış (Deathstare)', value: 'deathstare' },
                    { name: 'Yemek Ye (Eat)', value: 'eat' },
                    { name: 'Eğil (Bow)', value: 'bow' },
                    { name: 'Alkışla (Clap)', value: 'clap' },
                    { name: 'Kaç (Run)', value: 'run' },
                    { name: 'Gıdıkla (Tickle)', value: 'tickle' }
                )
        )
        .addUserOption(opt =>
            opt.setName('hedef')
                .setDescription('Eylemin gerçekleştirileceği kullanıcı (İsteğe bağlı)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const actionKey = interaction.options.getString('eylem');
        const target = interaction.options.getUser('hedef');
        const author = interaction.user;

        const actionObj = RP_ACTIONS[actionKey] || RP_ACTIONS['hug'];
        const isSelf = !target || target.id === author.id;

        let gifUrl = null;
        try {
            const apiRes = await fetch(`https://nekos.best/api/v2/${actionObj.animeAction}`);
            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data.results && data.results[0]) {
                    gifUrl = data.results[0].url;
                }
            }
        } catch (e) {}

        const titleIcon = MONO_EMOJIS[actionObj.icon] || '1530917515227725834';
        const title = `<:mono:${titleIcon}> Roleplay Eylemi`;
        
        let desc = isSelf 
            ? `**<@${author.id}>** ${actionObj.selfTr}!`
            : `**<@${author.id}>**, **<@${target.id}>** kullanıcısına ${actionObj.tr}!`;

        const payload = createContainerMessage(title, desc, '#5865F2', [], [], false);
        
        if (gifUrl) {
            return interaction.editReply({
                ...payload,
                files: [gifUrl]
            });
        }

        return interaction.editReply(payload);
    }
};
