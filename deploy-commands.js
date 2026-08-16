const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'commands');

// Discord 100 komut limiti nedeniyle deploy dışı tutulanlar
const EXCLUDE_FILES = [
    // FUN (16)
    'commands/fun/ask-olcer.js', 'commands/fun/cesaretlik.js', 'commands/fun/dogruluk-cesaret.js',
    'commands/fun/dogruluk.js', 'commands/fun/hack.js', 'commands/fun/hayvan.js',
    'commands/fun/komik-resim.js', 'commands/fun/oranlar.js', 'commands/fun/pfp.js',
    'commands/fun/rickroll.js', 'commands/fun/rizz.js', 'commands/fun/roleplay.js',
    'commands/fun/sahtemesaj.js', 'commands/fun/sahtenitro.js', 'commands/fun/ship.js',
    'commands/fun/yavsama-sozleri.js',
    // ROLEPLAY (24)
    'commands/roleplay/agla.js', 'commands/roleplay/dans.js', 'commands/roleplay/dus.js',
    'commands/roleplay/gul.js', 'commands/roleplay/gıdıkla.js', 'commands/roleplay/intihar.js',
    'commands/roleplay/isir.js', 'commands/roleplay/kac.js', 'commands/roleplay/kiz.js',
    'commands/roleplay/kork.js', 'commands/roleplay/kus.js', 'commands/roleplay/mutlu.js',
    'commands/roleplay/oksa.js', 'commands/roleplay/oldur.js', 'commands/roleplay/op.js',
    'commands/roleplay/saril.js', 'commands/roleplay/saskin.js', 'commands/roleplay/sigara.js',
    'commands/roleplay/tekme.js', 'commands/roleplay/tokat.js', 'commands/roleplay/utangac.js',
    'commands/roleplay/uyku.js', 'commands/roleplay/uzgun.js', 'commands/roleplay/yala.js',
    // OYUN
    'commands/utility/oyun-bilgi.js'
];

if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const relPath = path.join('commands', folder, file);
            if (EXCLUDE_FILES.includes(relPath)) continue;
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            }
        }
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n=============================================================`);
        console.log(`🌟 DİKKAT: Komutlar GLOBAL ağa yükleniyor!`);
        console.log(`Bu işlem, botun profiline 'Komutları Destekler' rozeti ekler.`);
        console.log(`(Global komutların tüm Discord'a yayılması 1 saati bulabilir)`);
        console.log(`=============================================================\n`);

        console.log(`Global ağa ${commands.length} komut yükleniyor...`);
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        
        console.log(`${data.length} komut başarıyla GLOBAL ağa yüklendi!`);
        console.log(`Rozetin gelmesi için Discord'u (CTRL+R) ile yenileyin.\n`);
        process.exit(0);
    } catch (error) {
        console.error('Komutlar yüklenirken hata oluştu:', error);
        process.exit(1);
    }
})();
