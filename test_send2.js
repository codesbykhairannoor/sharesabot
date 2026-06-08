const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function sendTestMessage() {
    const targetPhone = process.argv[2];
    if (!targetPhone) {
        console.log("Cara pakai: node test_send2.js 08123456789");
        process.exit(1);
    }

    let clean = targetPhone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.substring(1);
    const jid = clean + '@s.whatsapp.net';

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        browser: ['Mac OS', 'Safari', '10.15.7']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("✅ Berhasil terhubung! Mengirim pesan tes ke", jid);
            try {
                const [result] = await sock.onWhatsApp(jid);
                if (!result || !result.exists) {
                    console.log("❌ Nomor tidak terdaftar di WA!");
                    process.exit(1);
                }
                
                await sock.sendMessage(jid, { text: "Halo bos! Ini pesan tes dari Master Brain. Kalau pesan ini masuk, berarti lu NGGAK di-shadowban!" });
                console.log("✅ Pesan berhasil terkirim ke server WhatsApp!");
                console.log("⚠️ Sedang menunggu sinkronisasi latar belakang... (Dilarang mematikan script ini selama 15 detik)");
                
                setTimeout(() => {
                    console.log("✅ Sinkronisasi selesai. Cek HP sekarang. Script dimatikan otomatis.");
                    process.exit(0);
                }, 15000);
            } catch (err) {
                console.error("❌ Gagal:", err);
                process.exit(1);
            }
        } else if (connection === 'close') {
            console.log("❌ Koneksi terputus:", lastDisconnect.error?.message);
            process.exit(1);
        }
    });
}

sendTestMessage();
