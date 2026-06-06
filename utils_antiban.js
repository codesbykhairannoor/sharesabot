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
 * Asumsi: 1 karakter membutuhkan waktu 100ms - 250ms
 */
function calculateTypingTime(text) {
    const minMsPerChar = 50;
    const maxMsPerChar = 150;
    
    let totalTime = 0;
    for (let i = 0; i < text.length; i++) {
        totalTime += Math.floor(Math.random() * (maxMsPerChar - minMsPerChar + 1) + minMsPerChar);
    }
    
    // Maksimal waktu ngetik kita batasi 12 detik biar nggak kelamaan nunggu
    return Math.min(totalTime, 12000); 
}

module.exports = {
    spinText,
    randomDelay,
    calculateTypingTime
};
