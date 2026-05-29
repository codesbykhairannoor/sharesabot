const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

const QUEUE_FILE = 'database.json';

function getCustomMessage(name, niche, city) {
    const defaultMsg = `Halo kak, salam kenal. Saya liat profil ${name} di Google Maps daerah ${city}. Ulasannya bagus banget! ✨\n\n` +
           `Kebetulan kami dari Sharesa (sharesa.space). Skrg kan klien tuh makin kritis ya kak, apalagi di industri ${niche} lagi rame banget isu bisnis fiktif/bodong.\n\n` +
           `Nah, biar calon klien makin trust dan yakin pas nyari jasa ${niche}, kita ada solusi pembuatan website company profile/portofolio profesional.\n\n` +
           `Kalo dari ${name} ada rencana ningkatin trust klien lewat website, mari diskusi santai kak. Sukses terus ya! 😊`;

    const cleanNiche = niche.trim().toLowerCase();

    if (cleanNiche.includes("make up artist") || cleanNiche.includes("mua")) {
        return `Halo kak, salam kenal. Saya lihat profil MUA ${name} di Google Maps daerah ${city}. Portofolionya keren banget! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Sekarang kan calon pengantin atau klien wisuda itu kritis banget ya kak pas nyari MUA. Mereka butuh lihat portofolio lengkap, price list, dan jadwal booking secara rapi.\n\n` +
               `Biar calon klien makin percaya dan langsung gercep booking, kami ada solusi pembuatan website portofolio & booking MUA profesional.\n\n` +
               `Kalau dari ${name} ada rencana bikin website portofolio biar kelihatan makin premium dan tepercaya, yuk diskusi santai kak. Sukses terus ya! 😊`;
    }

    if (cleanNiche.includes("catering") || cleanNiche.includes("katering")) {
        return `Halo kak, salam kenal. Saya lihat profil ${name} di Google Maps daerah ${city}. Ulasannya mantap sekali! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Di industri katering pernikahan/acara, calon klien biasanya sangat selektif membandingkan paket menu, review food test, dan dokumentasi event.\n\n` +
               `Biar calon klien makin yakin tanpa ragu, kami ada solusi pembuatan website katalog menu & company profile katering yang profesional dan menggugah selera.\n\n` +
               `Jika dari ${name} ada rencana merilis website portofolio katering yang mewah, mari diskusi santai kak. Sukses selalu usahanya! 😊`;
    }

    if (cleanNiche.includes("wedding") || cleanNiche.includes("wo")) {
        return `Halo kak, salam kenal. Saya lihat profil Wedding Organizer ${name} di Google Maps daerah ${city}. Dokumentasi acaranya luar biasa! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Sekarang calon pengantin sangat kritis membandingkan paket WO, vendor rekanan, dan testimoni sukses lewat internet.\n\n` +
               `Biar brand ${name} kelihatan makin kredibel, premium, dan mendominasi di ${city}, kami menyediakan solusi pembuatan website company profile & portofolio WO yang elegan.\n\n` +
               `Jika kakak ada rencana menaikkan level branding WO-nya lewat website profesional, mari kita ngobrol santai. Sukses terus ya kak! 😊`;
    }

    if (cleanNiche.includes("interior") || cleanNiche.includes("kontraktor")) {
        return `Halo pak/bu, salam kenal. Saya lihat profil jasa interior ${name} di Google Maps daerah ${city}. Hasil project-nya sangat estetik! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Klien interior/renovasi sekarang sangat detail menilai portofolio desain 3D, material, dan progress project sebelum memilih kontraktor.\n\n` +
               `Biar calon klien makin trust dan yakin untuk dealing project besar, kami menyediakan jasa pembuatan website portofolio proyek & profil kontraktor profesional.\n\n` +
               `Jika dari ${name} ada rencana mempercantik branding digital lewat website yang premium, mari diskusi santai pak/bu. Sukses selalu project-nya! 😊`;
    }

    if (cleanNiche.includes("klinik kecantikan") || cleanNiche.includes("beauty")) {
        return `Halo kak, salam kenal. Saya lihat profil klinik kecantikan ${name} di Google Maps daerah ${city}. Rating dan review-nya bagus sekali! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Pasien klinik kecantikan sekarang sangat kritis membandingkan jenis treatment, profil dokter ahli, testimoni real, dan kemudahan booking jadwal.\n\n` +
               `Untuk meningkatkan kepercayaan pasien dan mempermudah reservasi online, kami ada solusi pembuatan website klinik kecantikan yang elegan dan terintegrasi sistem booking.\n\n` +
               `Jika ${name} ingin menaikkan prestise klinik lewat website premium, yuk diskusi santai kak. Sukses terus kliniknya! 😊`;
    }

    if (cleanNiche.includes("klinik gigi") || cleanNiche.includes("dokter gigi")) {
        return `Halo dokter, salam kenal. Saya lihat profil klinik gigi ${name} di Google Maps daerah ${city}. Ulasan pasiennya sangat positif! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Pasien gigi sekarang sangat memperhatikan kenyamanan klinik, sertifikasi dokter, ketersediaan jadwal, serta testimoni penanganan.\n\n` +
               `Agar calon pasien lebih mudah melihat jadwal praktik dokter dan melakukan reservasi online, kami menyediakan solusi pembuatan website klinik gigi modern dan tepercaya.\n\n` +
               `Jika dokter ada rencana membuat website klinik gigi yang profesional, mari kita berdiskusi santai. Sehat dan sukses selalu dok! 😊`;
    }

    if (cleanNiche.includes("rental") || cleanNiche.includes("sewa mobil")) {
        return `Halo pak/bu, salam kenal. Saya lihat profil rental mobil ${name} di Google Maps daerah ${city}. Unit armadanya lengkap sekali! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Klien korporat maupun personal sekarang sangat mengutamakan kejelasan tarif, syarat sewa, serta daftar armada mobil mewah yang ready.\n\n` +
               `Biar rental mobil ${name} terlihat makin bonafide dan tepercaya, kami menawarkan solusi pembuatan website katalog sewa mobil mewah yang responsif dan elegan.\n\n` +
               `Jika ada rencana meningkatkan branding rentalnya lewat website premium, mari diskusi santai pak/bu. Sukses selalu usahanya! 😊`;
    }

    if (cleanNiche.includes("studio foto") || cleanNiche.includes("fotografi")) {
        return `Halo kak, salam kenal. Saya lihat profil studio foto ${name} di Google Maps daerah ${city}. Hasil jepretannya luar biasa estetik! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Klien yang mencari jasa foto (graduation, prewedding, family) sangat mengandalkan website portofolio untuk menilai kualitas tone warna dan konsep studio.\n\n` +
               `Biar calon klien makin jatuh cinta dengan karya ${name} dan langsung booking, kami menawarkan jasa pembuatan website galeri portofolio fotografi yang premium.\n\n` +
               `Jika kakak tertarik membuat portofolio studio foto tampil lebih profesional di website sendiri, yuk diskusi santai. Sukses terus karyanya! 😊`;
    }

    if (cleanNiche.includes("event organizer") || cleanNiche.includes("eo")) {
        return `Halo kak, salam kenal. Saya lihat profil Event Organizer ${name} di Google Maps daerah ${city}. Event-event yang ditangani sangat seru dan sukses! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Klien corporate maupun promotor sekarang sangat selektif melihat skala event, testimonial klien besar, dan dokumentasi detail acara.\n\n` +
               `Biar EO ${name} terlihat semakin berkelas dan kredibel untuk memenangkan tender-tender besar, kami ada solusi pembuatan website company profile & portofolio EO profesional.\n\n` +
               `Jika ada rencana memperkuat kredibilitas EO lewat website berstandar industri, mari kita diskusi santai kak. Sukses terus acaranya! 😊`;
    }

    if (cleanNiche.includes("arsitek") || cleanNiche.includes("desain rumah")) {
        return `Halo pak/bu, salam kenal. Saya lihat profil jasa arsitek ${name} di Google Maps daerah ${city}. Desain-desainnya sangat inspiratif dan mewah! ✨\n\n` +
               `Kebetulan kami dari Sharesa (sharesa.space). Calon klien arsitek biasanya ingin melihat portofolio gambar 3D render, layout denah, hingga foto rumah yang sudah terbangun secara jelas.\n\n` +
               `Biar kredibilitas Anda makin kuat dibanding kompetitor, kami menghadirkan jasa pembuatan website portofolio arsitek yang profesional dan eksklusif.\n\n` +
               `Jika bapak/ibu tertarik menampilkan karya arsitektur terbaik lewat website premium, mari diskusi santai. Sukses selalu project-nya! 😊`;
    }

    return defaultMsg;
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

    const pendingLeads = leads.filter(l => l.status === 'PENDING');
    if (pendingLeads.length === 0) {
        console.log(`\n==================================================`);
        console.log(`✨ [SENDER] Tidak ada antrean pesan PENDING di ${QUEUE_FILE}.`);
        console.log(`==================================================`);
        return;
    }

    console.log(`\n==================================================`);
    console.log(`📬 [SENDER] Memulai pengiriman untuk ${pendingLeads.length} antrean PENDING.`);
    console.log(`==================================================`);

    let sentCount = 0;
    let notRegCount = 0;
    let errCount = 0;

    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        
        if (lead.status === 'PENDING') {
            const jid = `${lead.phone}@s.whatsapp.net`;
            const msg = getCustomMessage(lead.name, lead.niche, lead.city);
            
            console.log(`\n[SENDER] 👉 [Mengirim ${sentCount + notRegCount + errCount + 1}/${pendingLeads.length}]`);
            console.log(`[SENDER] Nama Bisnis : ${lead.name}`);
            console.log(`[SENDER] Kategori    : ${lead.niche}`);
            console.log(`[SENDER] Kota        : ${lead.city}`);
            console.log(`[SENDER] No Telepon  : ${lead.phone}`);
            console.log(`[SENDER] Status WA   : Memeriksa pendaftaran nomor...`);
            
            try {
                // Check if number exists on WA
                const [result] = await sock.onWhatsApp(jid);
                if (result && result.exists) {
                    console.log(`[SENDER] Status WA   : ✅ Nomor Terdaftar! Mensimulasikan ketikan (typing)...`);
                    // Send typing simulation
                    await sock.sendPresenceUpdate('composing', jid);
                    await delay(3000);
                    await sock.sendPresenceUpdate('paused', jid);
                    
                    // Send actual message
                    await sock.sendMessage(jid, { text: msg });
                    console.log(`[SENDER] Hasil       : 🎉 PESAN BERHASIL TERKIRIM ke ${lead.name}!`);
                    leads[i].status = 'TERKIRIM';
                    sentCount++;
                    
                    // Save progress immediately
                    fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
                    
                    // Delay between messages (10 - 25 seconds) to avoid spam ban
                    const waitTime = Math.floor(Math.random() * 15000) + 10000;
                    console.log(`[SENDER] Jeda        : Menunggu ${waitTime/1000} detik sebelum target berikutnya untuk mencegah spam block...`);
                    await delay(waitTime);
                } else {
                    console.log(`[SENDER] Hasil       : ❌ GAGAL! Nomor tidak terdaftar di WhatsApp.`);
                    leads[i].status = 'GAGAL (Tidak Terdaftar)';
                    notRegCount++;
                    fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
                }
            } catch (err) {
                console.log(`[SENDER] Hasil       : ❌ ERROR! Gagal mengirim:`, err.message);
                leads[i].status = 'GAGAL (Error)';
                errCount++;
                fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
            }
        }
    }
    
    console.log(`\n==================================================`);
    console.log(`🏁 [SENDER] PROSES ANTREAN SELESAI!`);
    console.log(`==================================================`);
    console.log(`📈 RINGKASAN LAPORAN PENGIRIMAN:`);
    console.log(`   ✅ Berhasil Terkirim      : ${sentCount} pesan`);
    console.log(`   ❌ Gagal (Tidak Ada WA)   : ${notRegCount} nomor`);
    console.log(`   ⚠️ Gagal (Sistem Error)   : ${errCount} nomor`);
    console.log(`   📊 Total Diproses         : ${sentCount + notRegCount + errCount} nomor`);
    console.log(`==================================================\n`);
}

// Start bot
connectToWhatsApp();
