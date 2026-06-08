require('dotenv').config();

async function sendCloudAPITest() {
    // 1. Ganti dengan ID Nomor Telepon Meta App Anda
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || "GANTI_DENGAN_PHONE_NUMBER_ID"; 
    // 2. Ganti dengan Access Token Meta App Anda
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "GANTI_DENGAN_ACCESS_TOKEN";
    // 3. Nomor target (contoh: nomor teman Anda)
    const targetPhone = process.argv[2];

    if (!targetPhone) {
        console.log("Cara pakai: node test_meta.js 628123456789 (HARUS pakai kode negara, tanpa +)");
        process.exit(1);
    }

    const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

    // Data payload untuk mengirim template "hello_world" (template bawaan Meta)
    const payload = {
        messaging_product: "whatsapp",
        to: targetPhone,
        type: "template",
        template: {
            name: "hello_world",
            language: {
                code: "en_US"
            }
        }
    };

    console.log(`Mengirim pesan tes ke ${targetPhone} menggunakan Meta Cloud API...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("✅ Pesan berhasil terkirim melalui Meta Cloud API!");
            console.log("Response dari server Meta:", JSON.stringify(data, null, 2));
        } else {
            console.log("❌ Gagal mengirim pesan!");
            console.error("Error dari Meta:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("❌ Terjadi kesalahan jaringan:", error.message);
    }
}

sendCloudAPITest();
