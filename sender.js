const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const { spawn } = require('child_process');
const { getNextTarget } = require('./target_manager');
const { spinText, randomDelay, calculateTypingTime, gaussianRandomDelay, isWorkingHour } = require('./utils_antiban');

// =========================================================================
// CONFIG: BATAS PENGIRIMAN AMAN
// =========================================================================
const MAX_MESSAGES_PER_RUN = 3; 
const DB_PATH = path.join(__dirname, 'database.json');
const REPLIED_DB_PATH = path.join(__dirname, 'replied_database.json');
let isProcessingLeads = false; // Flag untuk mencegah overlapping

// Membaca Data Prospek
function getPendingLeads() {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return data.filter(lead => lead.status === 'BELUM' || lead.status === 'PENDING');
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

// Cek apakah nomor sudah pernah dibalas otomatis
function hasBeenReplied(phone) {
    if (!fs.existsSync(REPLIED_DB_PATH)) return false;
    const data = JSON.parse(fs.readFileSync(REPLIED_DB_PATH, 'utf8'));
    return data.includes(phone);
}

// Tandai nomor sudah dibalas otomatis
function markAsReplied(phone) {
    let data = [];
    if (fs.existsSync(REPLIED_DB_PATH)) {
        data = JSON.parse(fs.readFileSync(REPLIED_DB_PATH, 'utf8'));
    }
    if (!data.includes(phone)) {
        data.push(phone);
        fs.writeFileSync(REPLIED_DB_PATH, JSON.stringify(data, null, 4));
    }
}

function formatToJid(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
    }
    return clean + '@s.whatsapp.net';
}

function jidToPhone(jid) {
    return jid.split('@')[0];
}

function getBaitMessage(name, city) {
    const rawTemplate = `{Halo|Hai|Permisi} kak, {maaf ganggu|selamat siang}. {Ini|Apakah ini} dengan admin {MUA|makeup} *${name}* yang di daerah ${city} {ya|bukan ya}?`;
    return spinText(rawTemplate);
}

function getVCard() {
    const vcard = 'BEGIN:VCARD\n'
                + 'VERSION:3.0\n' 
                + 'FN:Sharesa Space\n' 
                + 'ORG:Sharesa Space Digital;\n'
                + 'TEL;type=CELL;type=VOICE;waid=6287813259106:+62 878-1325-9106\n' 
                + 'END:VCARD';
    
    return {
        contacts: {
            displayName: 'Sharesa Space',
            contacts: [{ vcard }]
        }
    };
}

function getPitchMessage() {
    const rawTemplate = `Halo kak! Betul sekali, perkenalkan {saya|kami} dari *Sharesa Space*. \n\nKebetulan {saya|kami} melihat profil dan hasil karya MUA kakak bagus banget! {Kami|Sharesa Space} mau menawarkan kerja sama pembuatan website portofolio profesional untuk menampilkan karya kakak agar lebih meyakinkan calon klien.\n\nJika kakak berkenan, silakan cek contoh portofolio buatan kami di sini ya kak: https://sharesa.space\n\n{Terima kasih atas waktunya!|Semoga sukses selalu kak usahanya!}`;
    return spinText(rawTemplate);
}

// =========================================================================
// SIKLUS MASTER BRAIN
// =========================================================================

// Fungsi menjalankan Scraper secara berkala
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

// Fungsi mengecek dan mengirim pesan (Hanya aktif jam kerja)
async function processPendingLeadsTask(sock) {
    console.log(`[DEBUG SENDER] Memeriksa kondisi antrean...`);
    console.log(`[DEBUG SENDER] isProcessingLeads: ${isProcessingLeads}`);
    
    if (isProcessingLeads) return; // Mencegah bentrok jika proses sebelumnya belum selesai
    
    const isWorkHour = isWorkingHour();
    console.log(`[DEBUG SENDER] isWorkingHour: ${isWorkHour}`);
    if (!isWorkHour) return;  // Dilarang mengirim pesan di luar jam kerja

    isProcessingLeads = true;
    try {
        const pendingLeads = getPendingLeads();
        console.log(`[DEBUG SENDER] pendingLeads.length: ${pendingLeads.length}`);
        
        if (pendingLeads.length === 0) {
            isProcessingLeads = false;
            return;
        }

        const targetLeads = pendingLeads.slice(0, Math.min(pendingLeads.length, MAX_MESSAGES_PER_RUN));
        console.log(`\n📬 [SENDER] Menyiapkan pengiriman untuk ${targetLeads.length} antrean (Batas: ${MAX_MESSAGES_PER_RUN}/run)`);

        for (let i = 0; i < targetLeads.length; i++) {
            const lead = targetLeads[i];
            console.log(`--------------------------------------------------`);
            console.log(`👉 [Mengirim Pancingan ${i + 1}/${targetLeads.length}]`);
            console.log(`👤 Target : ${lead.name} (${lead.phone})`);
            
            const jid = formatToJid(lead.phone);
            const baitMessage = getBaitMessage(lead.name, lead.city);

            try {
                const [result] = await sock.onWhatsApp(jid);
                if (!result || !result.exists) {
                    console.log(`❌ GAGAL: Nomor tidak terdaftar di WhatsApp.`);
                    updateLeadStatus(lead.phone, "GAGAL (Tidak Terdaftar)");
                    continue;
                }

                console.log(`[SILUMAN] 📇 Mengirim Kartu Kontak (VCard)...`);
                await sock.sendMessage(jid, getVCard());
                await randomDelay(2000, 4000);

                const typingTimeMs = calculateTypingTime(baitMessage);
                console.log(`[SILUMAN] ⌨️ Pura-pura mengetik selama ${(typingTimeMs/1000).toFixed(1)} detik...`);
                
                await sock.presenceSubscribe(jid);
                await delay(500);
                await sock.sendPresenceUpdate('composing', jid);
                await randomDelay(typingTimeMs, typingTimeMs + 1000);
                await sock.sendPresenceUpdate('paused', jid);

                console.log(`[SILUMAN] ✉️ Mengirim pesan: "${baitMessage}"`);
                await sock.sendMessage(jid, { text: baitMessage });
                console.log(`✅ BERHASIL TERKIRIM!`);
                updateLeadStatus(lead.phone, "TERKIRIM (Menunggu Balasan)");

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
        console.log(`\n🎉 SEMUA ANTREAN SELESAI DIPROSES! Kembali ke mode Resepsionis.`);
    } catch (error) {
        console.error(`❌ Kesalahan pada proses antrean:`, error);
    }
    isProcessingLeads = false;
}


// =========================================================================
// FUNGSI UTAMA KONEKSI WHATSAPP (BOT CORE)
// =========================================================================
async function startBot() {
    console.log("==================================================");
    console.log("🔥 MASTER BRAIN (SCRAPER + SENDER + RESEPSIONIS) 🔥");
    console.log("==================================================");

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    let proxyAgent = undefined;
    if (process.env.SOCKS_PROXY_URL) {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        console.log(`🌐 [SILUMAN] Menggunakan Proxy: ${process.env.SOCKS_PROXY_URL}`);
        proxyAgent = new SocksProxyAgent(process.env.SOCKS_PROXY_URL);
    }

    const sockConfig = {
        version,
        logger: pino({ level: 'silent' }), // Sembunyikan log ribet Baileys
        printQRInTerminal: true,
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'] // Nyamar jadi browser Mac biar elegan
    };

    if (proxyAgent) {
        sockConfig.agent = proxyAgent;
        sockConfig.fetchAgent = proxyAgent;
    }

    const sock = makeWASocket(sockConfig);

    sock.ev.on('creds.update', saveCreds);

    // MENDENGARKAN PESAN MASUK (AUTO-REPLY)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return; 
        
        const senderJid = m.key.remoteJid;
        if (senderJid.endsWith('@g.us') || senderJid === 'status@broadcast') return;

        const senderPhone = jidToPhone(senderJid);
        const incomingText = m.message.conversation || m.message.extendedTextMessage?.text || "";

        console.log(`\n📩 [PESAN MASUK] Dari: ${senderPhone}`);
        console.log(`💬 Isi Pesan: "${incomingText}"`);

        if (hasBeenReplied(senderPhone)) {
            console.log(`⏭️ Target sudah pernah di-reply otomatis. Mengabaikan.`);
            return;
        }

        console.log(`🎯 Target membalas! Mempersiapkan Auto-Reply Siluman...`);
        const pitchMessage = getPitchMessage();

        try {
            const typingTimeMs = calculateTypingTime(pitchMessage);
            console.log(`[SILUMAN] ⌨️ Pura-pura mengetik ${(typingTimeMs/1000).toFixed(1)} detik...`);
            
            await sock.presenceSubscribe(senderJid);
            await delay(500);
            await sock.sendPresenceUpdate('composing', senderJid);
            await randomDelay(typingTimeMs, typingTimeMs + 1000);
            await sock.sendPresenceUpdate('paused', senderJid);

            await sock.sendMessage(senderJid, { text: pitchMessage });
            console.log(`✅ [AUTO-REPLY] Pesan penawaran terkirim ke ${senderPhone}!`);
            markAsReplied(senderPhone);
        } catch (error) {
            console.error(`❌ [AUTO-REPLY] Gagal mengirim pesan:`, error);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n[!] SCAN QR CODE DI ATAS MENGGUNAKAN WHATSAPP ANDA');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect.error)?.output?.statusCode;
            
            if ([401, 403, 405, 500].includes(statusCode)) {
                console.error(`\n🚨 [ALARM BAHAYA] Meta mengirimkan sinyal deteksi bot (Code: ${statusCode}).`);
                console.error(`Sistem dimatikan paksa (AUTO-KILL) untuk menghindari BANNED PERMANEN.`);
                process.exit(1);
            }

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                const errorMsg = lastDisconnect.error?.message || 'Unknown Error';
                console.log(`[SILUMAN] Koneksi terputus tak terduga (Code: ${statusCode}, Error: ${errorMsg}). Mencoba menyambung kembali secara internal...`);
                setTimeout(() => startBot(), 3000);
            } else {
                console.log('[SENDER] Anda telah log out. Hapus folder "auth_info_baileys" dan scan ulang.');
                process.exit(1);
            }
        } else if (connection === 'open') {
            console.log('\n[MASTER BRAIN] ✅ Berhasil terhubung ke WhatsApp!\n');
            
            // JALANKAN PENJADWALAN HANYA SEKALI SAAT KONEKSI PERTAMA DIBUKA
            if (!global.isSchedulerStarted) {
                global.isSchedulerStarted = true;

                // 1. Jadwal Scraper: Diatur KETAT sesuai jam operasional (Jam 09:00, 11:00, 13:00, 15:00, 16:00 WIB)
                cron.schedule('0 9,11,13,15,16 * * *', () => {
                    runScraperTask();
                }, { timezone: "Asia/Jakarta" });
                console.log(`⏰ Jadwal Scraper terpasang (Jam 09:00, 11:00, 13:00, 15:00, 16:00 WIB).`);

                // 2. Jadwal Pengirim Pesan: Setiap 5 menit mengecek antrean
                cron.schedule('*/5 * * * *', () => {
                    processPendingLeadsTask(sock);
                }, { timezone: "Asia/Jakarta" });
                console.log(`⏰ Jadwal Pengirim Pesan terpasang (Mengecek antrean setiap 5 menit).`);

                // Cek langsung saat pertama nyala
                console.log(`🚀 [MASTER BRAIN] Menginisiasi siklus pertama...`);
                processPendingLeadsTask(sock);
            }
        }
    });
}

startBot();
