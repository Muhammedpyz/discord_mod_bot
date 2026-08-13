const { spawn, execSync } = require('child_process');
const path = require('path');

function checkAndFixDB() {
    try {
        execSync('pgrep mariadbd || pgrep mysqld', { stdio: 'ignore' });
    } catch (e) {
        console.log('[Bekçi] MariaDB çalışmıyor! MariaDB başlatılıyor...');
        try {
            execSync('nohup mariadbd --user=$(whoami) > /dev/null 2>&1 &', { stdio: 'ignore' });
            console.log('[Bekçi] MariaDB başlatma komutu gönderildi.');
        } catch (err) {
            console.error('[Bekçi] MariaDB başlatılamadı:', err.message);
        }
    }

    try {
        execSync('pgrep redis-server', { stdio: 'ignore' });
    } catch (e) {
        console.log('[Bekçi] Redis sunucusu çalışmıyor! Redis başlatılıyor...');
        try {
            execSync('nohup redis-server > /dev/null 2>&1 &', { stdio: 'ignore' });
            console.log('[Bekçi] Redis başlatma komutu gönderildi.');
        } catch (err) {
            console.error('[Bekçi] Redis başlatılamadı:', err.message);
        }
    }
}

function startBotProcess() {
    checkAndFixDB();

    try {
        execSync('pkill -f "node index.js"', { stdio: 'ignore' });
    } catch(e) {}

    console.log('[Bekçi] Bot tekil işlem olarak başlatılıyor...');
    const bot = spawn('node', ['index.js'], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    bot.on('close', (code) => {
        console.error(`[Bekçi] Bot kapandı (Çıkış Kodu: ${code}). 3 saniye sonra otomatik yeniden başlatılıyor...`);
        setTimeout(() => {
            startBotProcess();
        }, 3000);
    });

    bot.on('error', (err) => {
        console.error('[Bekçi] Bot başlatma hatası:', err);
        setTimeout(() => {
            startBotProcess();
        }, 5000);
    });
}

startBotProcess();
