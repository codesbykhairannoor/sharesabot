const cron = require('node-cron');
const { execSync, spawnSync } = require('child_process');
const { getNextTarget } = require('./target_manager');

console.log("==================================================");
console.log("🔥 SHARESABOT SCHEDULER AKTIF 24/7 🔥");
console.log("==================================================");
console.log("Bot akan mencari target baru secara otomatis sesuai jadwal.");

// Jadwal: Setiap jam 08:00, 11:00, 14:00, 17:00, 20:00 (5 kali sehari)
// Format Cron: Menit Jam Tanggal Bulan Hari
const SCHEDULE = '0 8,11,14,17,20 * * *';

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

// Jadwalkan task dengan timezone Indonesia (WIB)
// Menambahkan timezone penting agar waktu server yang mungkin UTC tidak membuat bot salah jam
cron.schedule(SCHEDULE, () => {
    runBotCycle();
}, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});

// Jalankan sekali langsung saat startup agar pengguna bisa melihat proses berjalan otomatis seketika!
console.log(`\n🚀 [SCHEDULER] Menjalankan siklus otomatis pertama langsung saat startup...`);
runBotCycle();

console.log(`⏰ Jadwal terpasang: ${SCHEDULE} (Jam 8, 11, 14, 17, 20 WIB)`);
console.log(`Tekan Ctrl + C untuk mematikan scheduler.`);
