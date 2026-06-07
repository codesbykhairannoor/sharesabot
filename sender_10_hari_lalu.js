const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { spinText, randomDelay, calculateTypingTime } = require('./utils_antiban');

// =========================================================================
// CONFIG: BATAS PENGIRIMAN AMAN
// =========================================================================
const MAX_MESSAGES_PER_RUN = 5; // Berapa pesan maksimal yang dikirim dalam satu sesi eksekusi (biar nggak dicurigai)

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

// Format Nomor Telepon menjadi format JID WhatsApp (628... @s.whatsapp.net)
function formatToJid(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
    }
    return clean + '@s.whatsapp.net';
}

// Template Pesan dengan Spintax
// Ini akan dirandom secara otomatis oleh fungsi spinText
function getMessageTemplate(name, city) {
    const rawTemplate = `{Halo|Hai|Permisi|Selamat pagi/siang/sore} kak, perkenalkan {saya|kami} melihat profil bisnis *${name}* di Google Maps daerah ${city}. {Ulasannya bagus banget!|Reviewnya keren-keren nih!|Kami sangat terkesan dengan portofolionya.} {Boleh ngobrol sebentar kak?|Ada waktu luang sebentar kak buat ngobrol?|Kami ada penawaran menarik, boleh ngobrol bentar?}`;
    return spinText(rawTemplate);
}

// =========================================================================
// FUNGSI UTAMA PENGIRIMAN WHATSAPP SILUMAN
// =========================================================================
async function startBot() {
    console.log("==================================================");
    console.log("🥷 MEMULAI SENDER WHATSAPP (MODE SILUMAN) 🥷");
    console.log("==================================================");

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
        logger: pino({ level: 'silent' }), // Sembunyikan log ribet Baileys
        printQRInTerminal: true,
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'] // Nyamar jadi browser Mac biar elegan
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
                const finalMessage = getMessageTemplate(lead.name, lead.city);

                try {
                    // 1. Cek apakah nomor target terdaftar di WA
                    console.log(`[SENDER] Memeriksa status pendaftaran WA...`);
                    const [result] = await sock.onWhatsApp(jid);
                    if (!result || !result.exists) {
                        console.log(`❌ GAGAL: Nomor tidak terdaftar di WhatsApp.`);
                        updateLeadStatus(lead.phone, "GAGAL (Tidak Terdaftar)");
                        continue; // Lanjut ke target berikutnya
                    }

                    console.log(`✅ Nomor Aktif! Mempersiapkan pengiriman mode siluman...`);

                    // 2. SIMULASI MENGETIK (Human Typing Simulator)
                    const typingTimeMs = calculateTypingTime(finalMessage);
                    console.log(`[SILUMAN] ⌨️ Pura-pura mengetik selama ${(typingTimeMs/1000).toFixed(1)} detik...`);
                    
                    // Beritahu WA kalau kita lagi ngetik
                    await sock.presenceSubscribe(jid);
                    await delay(500); // jeda bentar sebelum status ngetik muncul
                    await sock.sendPresenceUpdate('composing', jid);
                    
                    // Tunggu sesuai durasi ngetik manusia
                    await randomDelay(typingTimeMs, typingTimeMs + 500);
                    
                    // Berhenti ngetik
                    await sock.sendPresenceUpdate('paused', jid);

                    // 3. KIRIM PESAN
                    console.log(`[SILUMAN] ✉️ Mengirim pesan: "${finalMessage}"`);
                    await sock.sendMessage(jid, { text: finalMessage });
                    console.log(`✅ BERHASIL TERKIRIM!`);
                    updateLeadStatus(lead.phone, "TERKIRIM (Siluman)");

                    // 4. RANDOM JITTER DELAY (Antar pesan agar tidak dibanned)
                    // Jika ini bukan pesan terakhir, beri jeda acak 2 sampai 5 menit
                    if (i < targetLeads.length - 1) {
                        const delaySeconds = Math.floor(Math.random() * (300 - 120 + 1) + 120); // 120s - 300s
                        console.log(`[SILUMAN] 💤 Menunggu ${(delaySeconds/60).toFixed(1)} menit sebelum kirim ke target berikutnya... (Menghindari banned)\n`);
                        await randomDelay(delaySeconds * 1000, delaySeconds * 1000 + 1000);
                    }

                } catch (error) {
                    console.error(`❌ GAGAL MENGIRIM PESAN: ${error.message}`);
                    updateLeadStatus(lead.phone, `GAGAL (${error.message})`);
                }
            }

            console.log(`\n🎉 SEMUA ANTREAN SELESAI DIPROSES! Bot akan dimatikan otomatis.`);
            await sock.logout(); // Logout aman untuk membersihkan RAM
            process.exit(0);
        }
    });
}

// Jalankan Bot
startBot();
