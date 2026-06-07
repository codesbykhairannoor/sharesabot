// utils_antiban.js
// Kumpulan fungsi sakti untuk menipu deteksi bot WhatsApp

/**
 * Fungsi Spintax
 * Menerima string dengan format {Opsi1|Opsi2|Opsi3} dan merandom hasilnya.
 * Contoh: "{Halo|Hai} kak, {gimana kabarnya|sehat}? -> "Hai kak, sehat?"
 */
function spinText(text) {
    let result = text;
    // Cari pola kurung kurawal {...}
    const regex = /{([^{}]+)}/g;
    
    let match;
    while ((match = regex.exec(result)) !== null) {
        const fullMatch = match[0]; // contoh: "{Halo|Hai}"
        const options = match[1].split('|'); // contoh: ["Halo", "Hai"]
        // Pilih salah satu secara acak
        const randomOption = options[Math.floor(Math.random() * options.length)];
        
        // Ganti di teks aslinya
        result = result.replace(fullMatch, randomOption);
        
        // Reset index regex karena string berubah
        regex.lastIndex = 0; 
    }
    return result;
}

/**
 * Fungsi Delay Jitter (Jeda Waktu Acak)
 * Berhenti selama sekian milidetik secara acak di antara min dan max
 */
function randomDelay(minMs, maxMs) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Kalkulator Waktu Mengetik (Human Typing Simulator)
 * Menghitung berapa lama seorang manusia mengetik berdasarkan panjang teks
 */
function calculateTypingTime(text) {
    const minMsPerChar = 50;
    const maxMsPerChar = 150;
    let totalTime = 0;
    for (let i = 0; i < text.length; i++) {
        totalTime += Math.floor(Math.random() * (maxMsPerChar - minMsPerChar + 1) + minMsPerChar);
    }
    return Math.min(totalTime, 12000); 
}

/**
 * Algoritma Jeda Gaussian (Box-Muller Transform)
 * Menghasilkan delay yang distribusinya menyerupai lonceng (lebih alami daripada sekadar Math.random())
 */
function gaussianRandomDelay(minMs, maxMs) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    
    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) num = Math.random(); // resample
    
    const delay = Math.floor(num * (maxMs - minMs) + minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Fungsi Penjaga Sirkadian (Jam Kerja)
 * Memastikan bot hanya mengirim pesan pada jam 09:00 pagi sampai 17:00 sore waktu server
 */
function isWorkingHour() {
    // Menggunakan waktu Asia/Jakarta (WIB) tanpa peduli zona waktu VPS
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    const currentHour = jakartaTime.getHours();
    
    // Jam 9 pagi sampai jam 5 sore (17)
    if (currentHour >= 9 && currentHour < 17) {
        return true;
    }
    return false;
}

module.exports = {
    spinText,
    randomDelay,
    calculateTypingTime,
    gaussianRandomDelay,
    isWorkingHour
};
