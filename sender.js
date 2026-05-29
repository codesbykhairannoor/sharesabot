const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

const QUEUE_FILE = 'database.json';

function getCustomMessage(name, niche, city) {
    return `Halo kak, salam kenal. Saya liat profil ${name} di Google Maps daerah ${city}. Portofolionya bagus banget! ✨\n\n` +
           `Kebetulan kami dari Sharesa (sharesa.space). Skrg kan lagi rame bgt isu penipuan WO/MUA/Catering bodong ya kak. Nah, biar calon klien makin trust dan ngerasa aman, kita ada solusi pembuatan website portofolio profesional.\n\n` +
           `Kalo dari ${name} ada rencana ningkatin trust klien lewat website, mari diskusi santai kak. Sukses terus ya! 😊`;
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    // We use silent logger unless debugging
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['ShAresa Bot', 'Chrome', '1.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('[QR] Silakan scan QR code di bawah ini:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[SENDER] Koneksi terputus (Status Code: ${statusCode}). Reconnecting:`, shouldReconnect);
            
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 2000); // delay 2 seconds to prevent infinite tight loop
            } else {
                console.log('[SENDER] Anda telah logout. Silakan hapus folder auth_info_baileys dan jalankan ulang untuk scan QR baru.');
                process.exit(1);
            }
        } else if (connection === 'open') {
            console.log('[SENDER] Berhasil terhubung ke WhatsApp! Mulai memproses antrean pesan...');
            await processQueue(sock);
            
            console.log('[SENDER] Selesai memproses antrean. Menutup koneksi...');
            await delay(3000);
            process.exit(0);
        }
    });
}

async function processQueue(sock) {
    if (!fs.existsSync(QUEUE_FILE)) {
        console.log(`[SENDER] File ${QUEUE_FILE} tidak ditemukan. Tidak ada pesan untuk dikirim.`);
        return;
    }

    let leads = [];
    try {
        leads = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch (e) {
        console.log(`[SENDER] Error membaca ${QUEUE_FILE}:`, e.message);
        return;
    }

    let sentCount = 0;

    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        
        if (lead.status === 'PENDING') {
            const jid = `${lead.phone}@s.whatsapp.net`;
            const msg = getCustomMessage(lead.name, lead.niche, lead.city);
            
            console.log(`\n[SENDER] [${i+1}/${leads.length}] Mengirim pesan ke ${lead.name} (${lead.phone})...`);
            
            try {
                // Check if number exists on WA
                const [result] = await sock.onWhatsApp(jid);
                if (result && result.exists) {
                    // Send typing simulation
                    await sock.sendPresenceUpdate('composing', jid);
                    await delay(2000);
                    await sock.sendPresenceUpdate('paused', jid);
                    
                    // Send actual message
                    await sock.sendMessage(jid, { text: msg });
                    console.log(`[SENDER] ✅ Berhasil terkirim ke ${lead.name}`);
                    leads[i].status = 'TERKIRIM';
                    sentCount++;
                    
                    // Save progress immediately
                    fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
                    
                    // Delay between messages (10 - 25 seconds) to avoid spam ban
                    const waitTime = Math.floor(Math.random() * 15000) + 10000;
                    console.log(`[SENDER] Menunggu ${waitTime/1000} detik sebelum target berikutnya...`);
                    await delay(waitTime);
                } else {
                    console.log(`[SENDER] ❌ Nomor tidak terdaftar di WhatsApp: ${lead.phone}`);
                    leads[i].status = 'GAGAL (Tidak Terdaftar)';
                    fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
                }
            } catch (err) {
                console.log(`[SENDER] ❌ Error mengirim ke ${lead.name}:`, err.message);
                leads[i].status = 'GAGAL (Error)';
                fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
            }
        }
    }
    
    console.log(`\n[SENDER] Antrean selesai. Berhasil mengirim ${sentCount} pesan baru.`);
}

// Start bot
connectToWhatsApp();
