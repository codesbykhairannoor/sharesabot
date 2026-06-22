require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spinText } = require('./utils_antiban.js');

const DB_PATH = path.join(__dirname, 'database.json');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Interval pengiriman: setiap 5 menit (pakai setInterval, BUKAN node-cron)
// setInterval tidak bisa di-skip oleh event loop, jauh lebih reliable
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

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

function safeText(text) {
    if (!text) return '';
    // Hapus semua karakter spesial Markdown Telegram
    return text.toString().replace(/[_*`\[\]()~>#+=|{}.!-]/g, '');
}

// =========================================================================
// TELEGRAM SENDER (dengan Retry otomatis)
// =========================================================================

async function sendTelegramMessage(text, retries = 3) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("❌ ERROR: TELEGRAM_TOKEN atau TELEGRAM_CHAT_ID belum diatur di .env");
        return false;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    for (let attempt = 1; attempt <= retries; attempt++) {
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
            if (data.ok) {
                return true;
            }
            console.error(`❌ Telegram API Error (percobaan ${attempt}/${retries}):`, data.description);

            // Kalau error karena Markdown rusak, kirim ulang tanpa Markdown
            if (data.description && data.description.includes("can't parse entities")) {
                console.log(`🔁 Coba kirim ulang tanpa format Markdown...`);
                const plainResponse = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        text: text.replace(/[*_`]/g, ''), // strip all markdown
                        disable_web_page_preview: true
                    })
                });
                const plainData = await plainResponse.json();
                if (plainData.ok) return true;
            }

        } catch (err) {
            console.error(`❌ Gagal menghubungi Telegram (percobaan ${attempt}/${retries}):`, err.message);
        }

        if (attempt < retries) {
            // Tunggu 5 detik sebelum retry
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    return false;
}

// =========================================================================
// CORE LOGIC
// =========================================================================

let isProcessingLeads = false;

async function processPendingLeads() {
    if (isProcessingLeads) {
        console.log('[BOT] Masih proses, skip giliran ini...');
        return;
    }
    isProcessingLeads = true;
    const startTime = Date.now();
    console.log(`\n[${new Date().toLocaleTimeString('id-ID')}] 🔍 Mengecek database...`);

    try {
        if (!fs.existsSync(DB_PATH)) {
            console.log('[BOT] database.json belum ada, skip...');
            isProcessingLeads = false;
            return;
        }

        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        const pendingLeads = data.filter(d => d.status === 'PENDING' || d.status === 'BELUM');

        if (pendingLeads.length === 0) {
            console.log(`[BOT] Tidak ada target baru. Menunggu giliran berikutnya...`);
            isProcessingLeads = false;
            return;
        }

        console.log(`\n📬 [TELEGRAM] Ditemukan ${pendingLeads.length} target baru. Mengirim ke Telegram...`);

        for (let i = 0; i < pendingLeads.length; i++) {
            const lead = pendingLeads[i];
            const waPhone = formatToWaPhone(lead.phone);
            const niche = lead.niche || 'jasa profesional';

            const safeName = safeText(lead.name);
            const safeNiche = safeText(niche);

            // 1. Buat Pesan Pancingan
            const baitMsg = getBaitMessage(safeName, lead.city, safeNiche);
            const waLinkBait = `https://wa.me/${waPhone}?text=${encodeURIComponent(baitMsg)}`;

            // 2. Buat Pesan Penawaran (Pitch)
            const pitchMsg = `Halo kak! Betul sekali, perkenalkan kami dari Sharesa Space. \n\nKebetulan kami melihat profil dan layanan ${safeNiche} yang kakak tawarkan bagus banget!\n\nKami mau menawarkan kerja sama pembuatan website resmi profesional untuk bisnis kakak. Apalagi di zaman sekarang calon klien makin banyak trust issue, punya website resmi sendiri itu terbukti ampuh banget buat naikin kredibilitas dan bikin klien langsung percaya sama layanan kakak.\n\nJika kakak berkenan, boleh saya jelaskan lebih detail mengenai penawaran ini kak?\n\nTerima kasih atas waktunya kak!`;
            const waLinkPitch = `https://wa.me/${waPhone}?text=${encodeURIComponent(pitchMsg)}`;

            const telegramText = `🎯 *TARGET BARU DARI GOOGLE MAPS*\n\n`
                               + `👤 *Nama:* ${safeName}\n`
                               + `🏢 *Niche:* ${safeNiche}\n`
                               + `📍 *Kota:* ${lead.city}\n`
                               + `📞 *Nomor:* +${waPhone}\n\n`
                               + `— *AKSI MANUAL ANDA* —\n\n`
                               + `1️⃣ *TOMBOL PANCINGAN*\n`
                               + `_(Klik ini pertama kali untuk nyapa)_:\n`
                               + `👉 [KIRIM PESAN PANCINGAN](${waLinkBait})\n\n`
                               + `2️⃣ *TOMBOL PENAWARAN PITCH*\n`
                               + `_(Klik ini kalau mereka udah bales chat pertama)_:\n`
                               + `👉 [KIRIM PESAN PENAWARAN](${waLinkPitch})`;

            const success = await sendTelegramMessage(telegramText);

            if (success) {
                // Update status di database
                const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                const targetIndex = dbData.findIndex(l => l.phone === lead.phone);
                if (targetIndex !== -1) {
                    dbData[targetIndex].status = 'DIKIRIM KE TELEGRAM';
                    dbData[targetIndex].sentAt = Date.now();
                    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 4));
                }
                console.log(`✅ [TELEGRAM] Terkirim: ${lead.name}`);
            } else {
                console.error(`❌ [TELEGRAM] Gagal kirim setelah 3 percobaan: ${lead.name}`);
            }

            // Delay 3 detik antar pesan agar tidak kena rate-limit Telegram
            await new Promise(r => setTimeout(r, 3000));
        }

    } catch (err) {
        console.error(`❌ Kesalahan pada proses antrean Telegram:`, err.message);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BOT] Selesai dalam ${elapsed} detik.\n`);
    isProcessingLeads = false;
}

// =========================================================================
// STARTUP & SCHEDULER
// =========================================================================

console.log("==================================================");
console.log("🔥 TELEGRAM NOTIFIER BOT 🔥");
console.log("==================================================");

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("🚨 KRITIS: TELEGRAM_TOKEN atau TELEGRAM_CHAT_ID kosong di .env!");
    process.exit(1); // Langsung mati agar PM2 restart dan terlihat masalahnya
}

// Kirim ping ke Telegram saat bot pertama kali nyala (buat konfirmasi bot hidup)
(async () => {
    const pingMsg = `✅ *Sharesabot Online!*\n_Bot nyala pukul ${new Date().toLocaleTimeString('id-ID', {timeZone: 'Asia/Jakarta'})} WIB. Siap mencari prospek setiap 5 menit._`;
    await sendTelegramMessage(pingMsg);
    console.log("[BOT] Ping startup terkirim ke Telegram.");
})();

// GANTI node-cron dengan setInterval (tidak bisa di-miss oleh event loop)
console.log(`⏰ Scheduler aktif: cek database setiap 5 menit via setInterval.`);
setInterval(processPendingLeads, CHECK_INTERVAL_MS);

// Langsung proses sekarang juga
processPendingLeads();
