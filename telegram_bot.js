require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');
const { getNextTarget } = require('./target_manager.js');
const { spinText } = require('./utils_antiban.js');

const DB_PATH = path.join(__dirname, 'database.json');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// =========================================================================
// FORMATTING PESAN
// =========================================================================

function formatToWaPhone(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
    }
    return clean;
}

function getBaitMessage(name, city, niche) {
    const rawTemplate = `{Halo|Hai|Permisi} kak, {maaf ganggu|selamat siang}. {Ini|Apakah ini} dengan admin *${name}* yang melayani jasa *${niche}* di daerah ${city} {ya|bukan ya}?`;
    return spinText(rawTemplate);
}

// =========================================================================
// TELEGRAM SENDER
// =========================================================================

async function sendTelegramMessage(text) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("❌ ERROR: TELEGRAM_TOKEN atau TELEGRAM_CHAT_ID belum diatur di .env");
        return false;
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            })
        });
        const data = await response.json();
        if (!data.ok) {
            console.error("❌ Telegram API Error:", data.description);
            return false;
        }
        return true;
    } catch (err) {
        console.error("❌ Gagal menghubungi Telegram:", err.message);
        return false;
    }
}

// =========================================================================
// CORE LOGIC
// =========================================================================

let isProcessingLeads = false;

async function processPendingLeads() {
    if (isProcessingLeads) return;
    isProcessingLeads = true;

    try {
        if (!fs.existsSync(DB_PATH)) {
            isProcessingLeads = false;
            return;
        }

        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        const pendingLeads = data.filter(d => d.status === 'PENDING' || d.status === 'BELUM');

        if (pendingLeads.length > 0) {
            console.log(`\n📬 [TELEGRAM] Ditemukan ${pendingLeads.length} target baru. Mengirim ke Telegram...`);
            
            for (let i = 0; i < pendingLeads.length; i++) {
                const lead = pendingLeads[i];
                const waPhone = formatToWaPhone(lead.phone);
                const niche = lead.niche || "jasa profesional";
                
                // 1. Buat Pesan Pancingan
                const baitMsg = getBaitMessage(lead.name, lead.city, niche);
                const waLinkBait = `https://wa.me/${waPhone}?text=${encodeURIComponent(baitMsg)}`;
                
                // 2. Buat Pesan Penawaran (Pitch)
                const pitchMsg = `Halo kak! Betul sekali, perkenalkan kami dari *Sharesa Space*. \n\nKebetulan kami melihat profil dan layanan *${niche}* yang kakak tawarkan bagus banget!\n\nKami mau menawarkan kerja sama pembuatan website resmi profesional untuk bisnis kakak. Apalagi di zaman sekarang calon klien makin banyak *trust issue*, punya website resmi sendiri itu terbukti ampuh banget buat naikin kredibilitas dan bikin klien langsung percaya sama layanan kakak.\n\nJika kakak berkenan, boleh saya jelaskan lebih detail mengenai penawaran ini kak?\n\nTerima kasih atas waktunya kak!`;
                const waLinkPitch = `https://wa.me/${waPhone}?text=${encodeURIComponent(pitchMsg)}`;
                
                const telegramText = `🎯 *TARGET BARU DARI GOOGLE MAPS*\n\n`
                                   + `👤 *Nama:* ${lead.name}\n`
                                   + `🏢 *Niche:* ${lead.niche}\n`
                                   + `📍 *Kota:* ${lead.city}\n`
                                   + `📞 *Nomor:* +${waPhone}\n\n`
                                   + `— *AKSI MANUAL ANDA* —\n\n`
                                   + `1️⃣ *TOMBOL PANCINGAN*\n`
                                   + `_(Klik ini pertama kali untuk nyapa)_:\n`
                                   + `👉 [KIRIM PESAN PANCINGAN](${waLinkBait})\n\n`
                                   + `2️⃣ *TOMBOL PENAWARAN (PITCH)*\n`
                                   + `_(Klik ini kalau mereka udah bales chat pertama)_:\n`
                                   + `👉 [KIRIM PESAN PENAWARAN](${waLinkPitch})`;
                
                const success = await sendTelegramMessage(telegramText);
                
                if (success) {
                    // Update status
                    const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                    const targetIndex = dbData.findIndex(l => l.phone === lead.phone);
                    if (targetIndex !== -1) {
                        dbData[targetIndex].status = "DIKIRIM KE TELEGRAM";
                        dbData[targetIndex].sentAt = Date.now();
                        fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 4));
                    }
                    console.log(`✅ [TELEGRAM] Terkirim: ${lead.name}`);
                }
                
                // Delay 2 detik antar pesan agar tidak kena limit Telegram
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    } catch (err) {
        console.error(`❌ Kesalahan pada proses antrean Telegram:`, err.message);
    }

    isProcessingLeads = false;
}

// =========================================================================
// SCHEDULER (PERSIS SEPERTI SEBELUMNYA)
// =========================================================================

function runScraperTask() {
    console.log(`\n⏰ [SCHEDULER] Menjalankan Scraper otomatis...`);
    const target = getNextTarget();
    try {
        console.log(`[SCHEDULER] Target: "${target.niche}" di "${target.city}"`);
        const scraper = spawn('node', ['scraper.js', target.niche, target.city, '15'], { stdio: 'inherit' });
        scraper.on('error', (err) => {
            console.error(`[SCHEDULER] Gagal memulai scraper:`, err.message);
        });
        scraper.on('close', (code) => {
            if (code !== 0) {
                console.error(`[SCHEDULER] Scraper selesai dengan error kode ${code}`);
            }
        });
    } catch (error) {
        console.error(`[SCHEDULER] Error tidak terduga saat memulai scraper:`, error.message);
    }
}

console.log("==================================================");
console.log("🔥 TELEGRAM NOTIFIER & SCRAPER BOT 🔥");
console.log("==================================================");

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("⚠️ PERINGATAN: TELEGRAM_TOKEN atau TELEGRAM_CHAT_ID kosong!");
    console.log("Silakan atur di file .env Anda.");
}

// Jadwal Scraper: Setiap jam genap (08:00, 10:00, 12:00, 14:00, 16:00, 18:00 WIB)
cron.schedule('0 1,3,5,7,9,11 * * *', runScraperTask, { timezone: "Asia/Jakarta" });
console.log(`⏰ Jadwal Scraper terpasang (2 Jam sekali).`);

// Jadwal Kirim ke Telegram: Setiap 5 menit mengecek database.json
cron.schedule('*/5 * * * *', processPendingLeads);
console.log(`⏰ Jadwal Pengecekan Target Baru terpasang (Setiap 5 menit).`);

// Proses sekarang juga saat pertama kali dijalankan
processPendingLeads();
