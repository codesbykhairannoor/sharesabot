const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { spinText, randomDelay, calculateTypingTime, gaussianRandomDelay, isWorkingHour } = require('./utils_antiban');

// =========================================================================
// CONFIG: BATAS PENGIRIMAN AMAN
// =========================================================================
const MAX_MESSAGES_PER_RUN = 3; // Kurangi jadi 3 per sesi agar lebih natural
const DB_PATH = path.join(__dirname, 'database.json');

// Membaca Data Prospek
function getPendingLeads() {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return data.filter(lead => lead.status === 'BELUM');
}

// Update Status Prospek di Database
function updateLeadStatus(phone, newStatus) {
    if (!fs.existsSync(DB_PATH)) return;
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const index = data.findIndex(lead => lead.phone === phone);
    if (index !== -1) {
        data[index].status = newStatus;
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));
    }
}

// Format Nomor Telepon menjadi format JID WhatsApp
function formatToJid(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
    }
    return clean + '@s.whatsapp.net';
}

// 1. Pesan Pancingan (Singkat & Memaksa Balasan)
function getBaitMessage(name, city) {
    const rawTemplate = `{Halo|Hai|Permisi} kak, {maaf ganggu|selamat siang}. {Ini|Apakah ini} dengan admin {MUA|makeup} *${name}* yang di daerah ${city} {ya|bukan ya}?`;
    return spinText(rawTemplate);
}

// 2. Pembuatan Kartu Kontak (VCard)
function getVCard() {
    const vcard = 'BEGIN:VCARD\n'
                + 'VERSION:3.0\n' 
                + 'FN:Sharesa Space\n' // Nama yang muncul
                + 'ORG:Sharesa Space Digital;\n'
                + 'TEL;type=CELL;type=VOICE;waid=6287813259106:+62 878-1325-9106\n' // Nomor Utama Lu
                + 'END:VCARD';
    
    return {
        contacts: {
            displayName: 'Sharesa Space',
            contacts: [{ vcard }]
        }
    };
}

// =========================================================================
// FUNGSI UTAMA PENGIRIMAN WHATSAPP SILUMAN
// =========================================================================
async function startBot() {
    console.log("==================================================");
    console.log("🥷 MEMULAI SENDER WHATSAPP (ADVANCED STEALTH) 🥷");
    console.log("==================================================");

    if (!isWorkingHour()) {
        console.log("💤 Di luar jam kerja (Hanya aktif jam 09:00 - 17:00). Bot dimatikan untuk menghindari ban.");
        process.exit(0);
    }

    const pendingLeads = getPendingLeads();
    if (pendingLeads.length === 0) {
        console.log("✅ Tidak ada data prospek baru untuk dikirim.");
        process.exit(0);
    }

    const targetLeads = pendingLeads.slice(0, Math.min(pendingLeads.length, MAX_MESSAGES_PER_RUN));
    console.log(`📬 Menyiapkan pengiriman untuk ${targetLeads.length} antrean (Batas Aman: ${MAX_MESSAGES_PER_RUN}/run)`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'], // OS Spoofing
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n[!] SCAN QR CODE DI ATAS MENGGUNAKAN WHATSAPP ANDA');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[SENDER] Koneksi terputus. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('[SENDER] Anda telah log out. Silakan hapus folder "auth_info_baileys" dan scan ulang.');
                process.exit(1);
            }
        } else if (connection === 'open') {
            console.log('\n[SENDER] ✅ Berhasil terhubung ke WhatsApp!\n');

            for (let i = 0; i < targetLeads.length; i++) {
                const lead = targetLeads[i];
                console.log(`--------------------------------------------------`);
                console.log(`👉 [Mengirim ${i + 1}/${targetLeads.length}]`);
                console.log(`👤 Target : ${lead.name} (${lead.phone})`);
                
                const jid = formatToJid(lead.phone);
                const baitMessage = getBaitMessage(lead.name, lead.city);

                try {
                    // 1. Cek apakah nomor target terdaftar di WA
                    const [result] = await sock.onWhatsApp(jid);
                    if (!result || !result.exists) {
                        console.log(`❌ GAGAL: Nomor tidak terdaftar di WhatsApp.`);
                        updateLeadStatus(lead.phone, "GAGAL (Tidak Terdaftar)");
                        continue;
                    }

                    // 2. KIRIM KARTU KONTAK (VCARD) DULU
                    console.log(`[SILUMAN] 📇 Mengirim Kartu Kontak (VCard) agar tidak di-Report Spam...`);
                    await sock.sendMessage(jid, getVCard());
                    
                    // Jeda sejenak setelah ngirim VCard
                    await randomDelay(2000, 4000);

                    // 3. SIMULASI MENGETIK (Human Typing Simulator)
                    const typingTimeMs = calculateTypingTime(baitMessage);
                    console.log(`[SILUMAN] ⌨️ Pura-pura mengetik selama ${(typingTimeMs/1000).toFixed(1)} detik...`);
                    
                    await sock.presenceSubscribe(jid);
                    await delay(500);
                    await sock.sendPresenceUpdate('composing', jid);
                    await randomDelay(typingTimeMs, typingTimeMs + 1000);
                    await sock.sendPresenceUpdate('paused', jid);

                    // 4. KIRIM PESAN PANCINGAN SINGKAT
                    console.log(`[SILUMAN] ✉️ Mengirim pesan: "${baitMessage}"`);
                    await sock.sendMessage(jid, { text: baitMessage });
                    console.log(`✅ BERHASIL TERKIRIM!`);
                    updateLeadStatus(lead.phone, "TERKIRIM (Siluman Tkt Dewa)");

                    // 5. GAUSSIAN JITTER DELAY (Antar pesan agar tidak dibanned)
                    if (i < targetLeads.length - 1) {
                        const minDelay = 180000; // 3 Menit
                        const maxDelay = 420000; // 7 Menit
                        console.log(`[SILUMAN] 💤 Menggunakan Gaussian Delay... Menunggu jeda aman...`);
                        await gaussianRandomDelay(minDelay, maxDelay);
                    }

                } catch (error) {
                    console.error(`❌ GAGAL MENGIRIM PESAN: ${error.message}`);
                    updateLeadStatus(lead.phone, `GAGAL (${error.message})`);
                }
            }

            console.log(`\n🎉 SEMUA ANTREAN SELESAI DIPROSES! Bot akan dimatikan otomatis.`);
            await sock.logout();
            process.exit(0);
        }
    });
}

// Jalankan Bot
startBot();
