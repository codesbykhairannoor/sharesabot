require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const QUEUE_FILE = 'database.json';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Meta API mensyaratkan nomor telepon dalam format internasional tanpa tanda '+'
// Contoh: 6281234567890
function formatPhoneNumber(phone) {
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1);
    }
    return formatted;
}

// Fitur jeda (delay) agar API tidak rate-limited
const delay = ms => new Promise(res => setTimeout(res, ms));

async function sendTemplateMessage(lead) {
    const targetPhone = formatPhoneNumber(lead.phone);
    
    // Konfigurasi Payload API Meta
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: targetPhone,
        type: "template",
        template: {
            name: "sapaan_awal_bisnis", // Anda wajib membuat template dengan nama ini di Meta
            language: {
                code: "id" // Bahasa Indonesia
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: lead.name }, // Mengisi variabel {{1}}
                        { type: "text", text: lead.city }  // Mengisi variabel {{2}}
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`[SENDER] Hasil       : 🎉 PESAN (Template) BERHASIL TERKIRIM ke ${lead.name}! (Message ID: ${response.data.messages[0].id})`);
        return true;
    } catch (error) {
        let errorMsg = error.message;
        if (error.response && error.response.data && error.response.data.error) {
            errorMsg = error.response.data.error.message;
        }
        console.log(`[SENDER] Hasil       : ❌ GAGAL mengirim ke ${lead.name}. Error: ${errorMsg}`);
        return false;
    }
}

async function processQueue() {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
        console.log(`[SENDER] ERROR KRITIS: PHONE_NUMBER_ID atau META_ACCESS_TOKEN tidak ditemukan di file .env!`);
        process.exit(1);
    }

    if (!fs.existsSync(QUEUE_FILE)) {
        console.log(`[SENDER] File ${QUEUE_FILE} tidak ditemukan. Tidak ada pesan untuk dikirim.`);
        process.exit(0);
    }

    let leads = [];
    try {
        leads = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch (e) {
        console.log(`[SENDER] Error membaca ${QUEUE_FILE}:`, e.message);
        process.exit(1);
    }

    const pendingLeads = leads.filter(l => l.status === 'PENDING');
    if (pendingLeads.length === 0) {
        console.log(`\n==================================================`);
        console.log(`✨ [SENDER] Tidak ada antrean pesan PENDING di ${QUEUE_FILE}.`);
        console.log(`==================================================`);
        process.exit(0);
    }

    console.log(`\n==================================================`);
    console.log(`📬 [SENDER META API] Memulai pengiriman untuk ${pendingLeads.length} antrean PENDING.`);
    console.log(`==================================================`);

    let sentCount = 0;
    let errCount = 0;

    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        
        if (lead.status === 'PENDING') {
            console.log(`\n[SENDER] 👉 [Mengirim ${sentCount + errCount + 1}/${pendingLeads.length}]`);
            console.log(`[SENDER] Nama Bisnis : ${lead.name}`);
            console.log(`[SENDER] Kategori    : ${lead.niche}`);
            console.log(`[SENDER] Kota        : ${lead.city}`);
            console.log(`[SENDER] No Telepon  : ${formatPhoneNumber(lead.phone)}`);
            
            const isSuccess = await sendTemplateMessage(lead);
            
            if (isSuccess) {
                leads[i].status = 'TERKIRIM';
                sentCount++;
            } else {
                leads[i].status = 'GAGAL (API Error)';
                errCount++;
            }
            
            // Save progress immediately
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(leads, null, 4));
            
            // Jeda antar API Call (1-3 detik) untuk menghindari Rate Limiting Meta
            const waitTime = Math.floor(Math.random() * 2000) + 1000;
            console.log(`[SENDER] Jeda        : Menunggu ${(waitTime/1000).toFixed(1)} detik untuk target berikutnya...`);
            await delay(waitTime);
        }
    }
    
    console.log(`\n==================================================`);
    console.log(`🏁 [SENDER META API] PROSES ANTREAN SELESAI!`);
    console.log(`==================================================`);
    console.log(`📈 RINGKASAN LAPORAN PENGIRIMAN:`);
    console.log(`   ✅ Berhasil Terkirim      : ${sentCount} pesan`);
    console.log(`   ⚠️ Gagal (Sistem Error)   : ${errCount} nomor`);
    console.log(`   📊 Total Diproses         : ${sentCount + errCount} nomor`);
    console.log(`==================================================\n`);
    
    process.exit(0);
}

// Start bot
processQueue();
