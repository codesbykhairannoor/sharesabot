const cron = require('node-cron');
const { execSync, spawnSync } = require('child_process');
const { getNextTarget } = require('./target_manager');

console.log("==================================================");
console.log("🔥 SHARESABOT SCHEDULER AKTIF 24/7 🔥");
console.log("==================================================");
console.log("Bot akan mencari target baru secara otomatis sesuai jadwal.");

// Jadwal: Setiap jam 09:00, 13:00, dan 17:00
// Format Cron: Menit Jam Tanggal Bulan Hari
const SCHEDULE = '0 9,13,17 * * *';

// Fungsi utama yang mengeksekusi siklus bot
function runBotCycle() {
    console.log(`\n⏰ [SCHEDULER] Trigger waktu aktif! Memulai siklus pada: ${new Date().toLocaleString()}`);
    
    // 1. Dapatkan target paling usang
    const target = getNextTarget();
    
    try {
        console.log(`\n[SCHEDULER] Tahap 1: Menjalankan Scraper untuk Kategori: "${target.niche}" di Kota: "${target.city}"...`);
        execSync(`node scraper.js "${target.niche}" "${target.city}" 15`, { stdio: 'inherit' });
    } catch (error) {
        console.error(`[SCHEDULER] Error saat menjalankan scraper:`, error.message);
    }

    try {
        console.log(`\n[SCHEDULER] Tahap 2: Menjalankan Pengirim WA...`);
        // Menjalankan sender.js sebagai child process. Ini memastikan memory dibersihkan setelah selesai
        spawnSync('node', ['sender.js'], { stdio: 'inherit' });
    } catch (error) {
        console.error(`[SCHEDULER] Error saat menjalankan sender WA:`, error.message);
    }
    
    console.log(`\n✅ [SCHEDULER] Siklus otomatis selesai. Menunggu jadwal cron berikutnya...`);
}

// Jadwalkan task
cron.schedule(SCHEDULE, () => {
    runBotCycle();
});

// Jalankan sekali langsung saat startup agar pengguna bisa melihat proses berjalan otomatis seketika!
console.log(`\n🚀 [SCHEDULER] Menjalankan siklus otomatis pertama langsung saat startup...`);
runBotCycle();

console.log(`⏰ Jadwal terpasang: ${SCHEDULE} (Jam 9 pagi, 1 siang, 5 sore)`);
console.log(`Tekan Ctrl + C untuk mematikan scheduler.`);
