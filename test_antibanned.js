// Simulasi fitur anti-banned tanpa terhubung ke WhatsApp
function spin(text) {
    return text.replace(/{([^{}]+)}/g, function(match, contents) {
        const parts = contents.split('|');
        return parts[Math.floor(Math.random() * parts.length)];
    });
}

function getCustomMessage(name, niche, city) {
    return spin(`{Halo|Hai|Selamat pagi|Selamat siang} kak, {salam kenal|perkenalkan}. Saya lihat profil {MUA|jasa makeup} ${name} di Google Maps daerah ${city}. Portofolionya {keren banget|sangat estetik|luar biasa}! ✨\n\n` +
           `Kalau dari ${name} ada rencana bikin website portofolio biar kelihatan makin {premium|profesional} dan tepercaya, yuk diskusi santai kak. {Sukses terus ya|Semoga makin laris manis}! 😊`);
}

const leads = [
    {name: "MUA 1", niche: "make up artist", city: "Medan"},
    {name: "MUA 2", niche: "make up artist", city: "Medan"},
    {name: "MUA 3", niche: "make up artist", city: "Medan"}
];

let batchSentCount = 4; // Simulasi batas batch (sebantar lagi istirahat)
let currentBatchLimit = 5;

console.log("=== HASIL UJI COBA ANTI-BANNED ===");
for(let i=0; i<leads.length; i++) {
    const lead = leads[i];
    const msg = getCustomMessage(lead.name, lead.niche, lead.city);
    console.log(`\nTARGET ${i+1}: ${lead.name}`);
    console.log(`Pesan yang dikirim (Spintax):\n"${msg}"`);
    
    const dynamicTypingDuration = Math.min((msg.length * 40) + Math.floor(Math.random() * 2000) + 1000, 12000);
    console.log(`-> Durasi Mengetik: ${(dynamicTypingDuration/1000).toFixed(1)} detik`);
    
    batchSentCount++;
    if (batchSentCount >= currentBatchLimit) {
        const restTime = Math.floor(Math.random() * 600000) + 600000;
        console.log(`-> BATCH TERCAPAI. Bot istirahat: ${(restTime/60000).toFixed(1)} menit`);
        batchSentCount = 0;
        currentBatchLimit = Math.floor(Math.random() * 4) + 5;
    } else {
        const waitTime = Math.floor(Math.random() * 120000) + 60000;
        console.log(`-> Jeda antar pesan: ${(waitTime/1000).toFixed(1)} detik`);
    }
}
