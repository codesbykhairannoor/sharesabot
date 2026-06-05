require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// =========================================================================
// 1. ENDPOINT VERIFIKASI DARI META (Saat mendaftarkan URL Webhook)
// =========================================================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[WEBHOOK] ✅ Verifikasi Meta BERHASIL!');
            res.status(200).send(challenge);
        } else {
            console.log('[WEBHOOK] ❌ Verifikasi GAGAL: Token tidak cocok.');
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Invalid request');
    }
});

// =========================================================================
// 2. ENDPOINT MENERIMA PESAN (Saat prospek membalas pesan bot)
// =========================================================================
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        // WhatsApp mengirimkan data dalam bentuk array `entry` dan `changes`
        if (
            body.entry && 
            body.entry[0].changes && 
            body.entry[0].changes[0].value.messages && 
            body.entry[0].changes[0].value.messages[0]
        ) {
            const messageData = body.entry[0].changes[0].value.messages[0];
            const senderPhone = messageData.from; // Nomor telepon prospek
            const messageType = messageData.type;

            // Jika yang dikirim prospek adalah teks biasa
            if (messageType === 'text') {
                const incomingText = messageData.text.body;
                console.log(`\n[WEBHOOK] 📩 Pesan Masuk dari ${senderPhone}: "${incomingText}"`);

                // Mengirim Balasan Otomatis (Auto-Reply)
                await sendAutoReply(senderPhone);
            }
        }
        res.sendStatus(200); // Wajib mengirim status 200 OK ke Meta agar Meta berhenti mengirim ulang (retry)
    } else {
        res.sendStatus(404);
    }
});

// =========================================================================
// 3. FUNGSI MENGIRIM AUTO-REPLY (Pesan Bebas dengan Link Portofolio)
// =========================================================================
async function sendAutoReply(targetPhone) {
    console.log(`[WEBHOOK] 🤖 Mengirim Auto-Reply ke ${targetPhone}...`);
    
    // Teks bebas (Bukan Template)
    const replyMessage = "Terima kasih responnya kak! 🙏\n\nBoleh cek portofolio layanan dan penawaran spesial kami di: *https://sharesa.space*\n\nJika ada yang ingin ditanyakan lebih lanjut, silakan balas chat ini ya. Nanti admin kami akan membalas secepatnya. 😊";

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: targetPhone,
        type: "text",
        text: {
            preview_url: true, // Mengaktifkan *thumbnail preview* untuk link sharesa.space
            body: replyMessage
        }
    };

    try {
        await axios.post(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`[WEBHOOK] 🎉 Auto-Reply sukses terkirim ke ${targetPhone}`);
    } catch (error) {
        let errorMsg = error.message;
        if (error.response && error.response.data && error.response.data.error) {
            errorMsg = error.response.data.error.message;
        }
        console.log(`[WEBHOOK] ❌ GAGAL mengirim Auto-Reply: ${errorMsg}`);
    }
}

// Menjalankan Server Mini
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 [WEBHOOK] Server Listener AKTIF 24/7 di Port ${PORT}`);
    console.log(`==================================================`);
    console.log(`🔗 URL Webhook Anda   : (Gunakan public IP VPS Anda /webhook)`);
    console.log(`🔑 Verify Token Anda  : ${VERIFY_TOKEN}`);
    console.log(`Menunggu pesan masuk dari target...`);
    console.log(`==================================================\n`);
});
