module.exports = {
    apps: [
        {
            // Bot Telegram: tugasnya HANYA kirim ke Telegram, ringan, selalu standby
            name: 'sharesabot-auto',
            script: 'telegram_bot.js',
            watch: false,
            restart_delay: 5000,
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            // Scraper: dijadwal PM2 (OS level), jalan lalu mati sendiri
            // Ini TERPISAH dari bot Telegram, jadi CPU Puppeteer tidak nge-block event loop bot
            name: 'sharesabot-scraper',
            script: 'run_scraper.js',
            cron_restart: '0 1,3,5,7,9,11 * * *', // Jam 8,10,12,14,16,18 WIB
            autorestart: false, // Mati sendiri setelah selesai scraping
            watch: false,
            env: {
                NODE_ENV: 'production',
                TZ: 'Asia/Jakarta'
            }
        }
    ]
};
