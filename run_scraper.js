// run_scraper.js - Script mandiri yang dijadwal PM2
// Tugasnya: pilih target, scrape, kirim ke Telegram, lalu EXIT
require('dotenv').config();
const { spawn } = require('child_process');
const { getNextTarget } = require('./target_manager.js');

const target = getNextTarget();
console.log(`[SCRAPER-RUNNER] Target: "${target.niche}" di "${target.city}"`);

const proc = spawn('node', ['scraper.js', target.niche, target.city, '15'], {
    stdio: 'inherit',
    cwd: __dirname
});

proc.on('close', (code) => {
    console.log(`[SCRAPER-RUNNER] Scraper selesai (kode: ${code}). Keluar.`);
    process.exit(code || 0);
});

proc.on('error', (err) => {
    console.error(`[SCRAPER-RUNNER] Error: ${err.message}`);
    process.exit(1);
});
