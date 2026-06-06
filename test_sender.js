require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

function formatPhoneNumber(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
    }
    return clean;
}

async function runSuperTest() {
    console.log("==================================================");
    console.log("🧪 SUPER TESTING META WHATSAPP CLOUD API 🧪");
    console.log("==================================================");
    console.log(`🔑 Menggunakan Phone ID: ${PHONE_NUMBER_ID}`);

    // 1. Baca Data Hasil Scraping
    if (!fs.existsSync('database.json')) {
        console.error("❌ File database.json tidak ditemukan. Jalankan scraper.js dulu.");
        return;
    }

    const leads = JSON.parse(fs.readFileSync('database.json', 'utf8'));
    if (leads.length === 0) {
        console.error("❌ Tidak ada data prospek di database.json.");
        return;
    }

    // 2. Ambil Prospek Pertama
    const targetLead = leads[0];
    const targetPhone = formatPhoneNumber(targetLead.phone);
    console.log(`\n🎯 TARGET TESTING:`);
    console.log(`- Nama Bisnis : ${targetLead.name}`);
    console.log(`- Kota        : ${targetLead.city}`);
    console.log(`- Nomor WA    : ${targetPhone}`);

    // 3. Konfigurasi Payload API (Menggunakan Template Bawaan 'hello_world' Dulu)
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: targetPhone,
        type: "template",
        template: {
            name: "hello_world",
            language: { code: "en_US" }
        }
    };

    console.log(`\n🚀 Mengirim Request ke Server Meta...`);
    
    // 4. Eksekusi Pengiriman
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
        console.log(`\n✅ [SUKSES!] PESAN BERHASIL TERKIRIM KE ${targetPhone}!`);
        console.log("Response Meta:", response.data);
    } catch (error) {
        console.log(`\n❌ [GAGAL] SERVER META MENOLAK PENGIRIMAN!`);
        if (error.response && error.response.data) {
            const errData = error.response.data.error;
            console.log(`🔴 ERROR CODE: ${errData.code}`);
            console.log(`🔴 ERROR TYPE: ${errData.type}`);
            console.log(`🔴 PESAN ERROR DARI META: ${errData.message}`);
            
            if (errData.code === 131030) {
                console.log("\n💡 DIAGNOSIS AI: Pesan gagal karena Aplikasi Meta Anda masih berstatus 'Development Mode' (Belum Live). Di mode ini, Anda tidak bisa mengirim pesan ke nomor acak hasil scraping. Anda harus memasukkan nomor tersebut secara manual ke 'Daftar Nomor yang Diizinkan' (Allowed List) di Dashboard Meta, ATAU mengubah aplikasi menjadi Mode 'Live'.");
            } else if (errData.code === 133010) {
                console.log("\n💡 DIAGNOSIS AI: Akun WhatsApp Anda belum diverifikasi atau belum ada metode pembayaran yang valid, sehingga tidak bisa mengirim template pesan.");
            }
        } else {
            console.log(`🔴 ERROR SYSTEM: ${error.message}`);
        }
    }
}

runSuperTest();
