const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { spinText, randomDelay, calculateTypingTime, gaussianRandomDelay, isWorkingHour } = require('./utils_antiban');

// =========================================================================
// CONFIG: BATAS PENGIRIMAN AMAN
// =========================================================================
const MAX_MESSAGES_PER_RUN = 3; 
const DB_PATH = path.join(__dirname, 'database.json');
const REPLIED_DB_PATH = path.join(__dirname, 'replied_database.json');

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

// Format Nomor Telepon menjadi format JID WhatsApp
function formatToJid(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
    }
    return clean + '@s.whatsapp.net';
}

// Ekstrak Nomor dari JID
function jidToPhone(jid) {
    return jid.split('@')[0];
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

// 3. Pesan Auto-Reply Penawaran Utama
function getPitchMessage() {
    const rawTemplate = `Halo kak! Betul sekali, perkenalkan {saya|kami} dari *Sharesa Space*. \n\nKebetulan {saya|kami} melihat profil dan hasil karya MUA kakak bagus banget! {Kami|Sharesa Space} mau menawarkan kerja sama pembuatan website portofolio profesional untuk menampilkan karya kakak agar lebih meyakinkan calon klien.\n\nJika kakak berkenan, silakan cek contoh portofolio buatan kami di sini ya kak: https://sharesa.space\n\n{Terima kasih atas waktunya!|Semoga sukses selalu kak usahanya!}`;
    return spinText(rawTemplate);
}

// =========================================================================
// FUNGSI UTAMA PENGIRIMAN & PENERIMAAN WHATSAPP
// =========================================================================
async function startBot() {
    console.log("==================================================");
    console.log("🥷 MEMULAI SENDER & LISTENER WHATSAPP (RESEPSIONIS) 🥷");
    console.log("==================================================");

    if (!isWorkingHour()) {
        console.log("💤 Di luar jam kerja (Hanya aktif jam 09:00 - 17:00). Bot dimatikan untuk menghindari ban.");
        process.exit(0);
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false // [SILUMAN] Mencegah status "Online" 24 Jam
    });

    sock.ev.on('creds.update', saveCreds);

    // MENDENGARKAN PESAN MASUK (AUTO-REPLY)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const m = messages[0];
        if (!m.message) return; // Kosong
        if (m.key.fromMe) return; // Jangan balas pesan dari diri sendiri
        
        const senderJid = m.key.remoteJid;
        if (senderJid.endsWith('@g.us')) return; // Jangan balas pesan dari grup
        if (senderJid === 'status@broadcast') return; // Jangan balas status WA

        const senderPhone = jidToPhone(senderJid);
        const incomingText = m.message.conversation || m.message.extendedTextMessage?.text || "";

        console.log(`\n📩 [PESAN MASUK] Dari: ${senderPhone}`);
        console.log(`💬 Isi Pesan: "${incomingText}"`);

        // Cek apakah nomor ini sudah pernah kita kasih Auto-Reply
        if (hasBeenReplied(senderPhone)) {
            console.log(`⏭️ Target sudah pernah di-reply otomatis sebelumnya. Bot mengabaikan pesan ini.`);
            return;
        }

        console.log(`🎯 Target potensial membalas! Mempersiapkan Auto-Reply Siluman...`);
        const pitchMessage = getPitchMessage();

        try {
            // Simulasi Ngetik
            const typingTimeMs = calculateTypingTime(pitchMessage);
            console.log(`[SILUMAN] ⌨️ Pura-pura mengetik selama ${(typingTimeMs/1000).toFixed(1)} detik...`);
            
            await sock.presenceSubscribe(senderJid);
            await delay(500);
            await sock.sendPresenceUpdate('composing', senderJid);
            await randomDelay(typingTimeMs, typingTimeMs + 1000);
            await sock.sendPresenceUpdate('paused', senderJid);

            // Kirim Penawaran
            await sock.sendMessage(senderJid, { text: pitchMessage });
            console.log(`✅ [AUTO-REPLY] Pesan penawaran berhasil dikirim ke ${senderPhone}!`);
            
            // Catat di database agar tidak dispam dua kali
            markAsReplied(senderPhone);
        } catch (error) {
            console.error(`❌ [AUTO-REPLY] Gagal mengirim pesan ke ${senderPhone}:`, error);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n[!] SCAN QR CODE DI ATAS MENGGUNAKAN WHATSAPP ANDA');
            qrcode.generate(qr, { small: true });
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

            const pendingLeads = getPendingLeads();
            if (pendingLeads.length === 0) {
                console.log("✅ Tidak ada data prospek baru untuk dikirim.");
                console.log("👁️ Bot sekarang standby memantau pesan masuk (Resepsionis Aktif).");
                return; // JANGAN process.exit(0) agar bot tetap mendengarkan
            }

            const targetLeads = pendingLeads.slice(0, Math.min(pendingLeads.length, MAX_MESSAGES_PER_RUN));
            console.log(`📬 Menyiapkan pengiriman untuk ${targetLeads.length} antrean (Batas Aman: ${MAX_MESSAGES_PER_RUN}/run)`);

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
                        const minDelay = 180000; 
                        const maxDelay = 420000; 
                        console.log(`[SILUMAN] 💤 Menggunakan Gaussian Delay... Menunggu jeda aman...`);
                        await gaussianRandomDelay(minDelay, maxDelay);
                    }

                } catch (error) {
                    console.error(`❌ GAGAL MENGIRIM PESAN: ${error.message}`);
                    updateLeadStatus(lead.phone, `GAGAL (${error.message})`);
                }
            }

            console.log(`\n🎉 SEMUA ANTREAN SELESAI DIPROSES!`);
            console.log(`👁️ Bot tidak dimatikan. Beralih ke mode RESEPSIONIS (Standby menunggu balasan)...`);
            // Tidak ada sock.logout() atau process.exit() di sini
        }
    });
}

startBot();
