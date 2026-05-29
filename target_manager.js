const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'scrape_history.json');

// Daftar Niche dan Kota (Bisa ditambah ratusan)
const NICHES = [
    "Make Up Artist",
    "Catering Pernikahan",
    "Wedding Organizer",
    "Kontraktor Interior",
    "Klinik Kecantikan",
    "Klinik Gigi",
    "Rental Mobil Mewah",
    "Studio Foto",
    "Event Organizer",
    "Jasa Arsitek"
];

const CITIES = [
    "Jakarta",
    "Bandung",
    "Surabaya",
    "Semarang",
    "Medan",
    "Makassar",
    "Yogyakarta",
    "Palembang",
    "Bali",
    "Malang"
];

function initHistory() {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        } catch (e) {
            console.error("[TARGET MANAGER] Error membaca history:", e);
        }
    }

    // Buat kombinasi yang belum ada di history
    const existingMap = new Set(history.map(h => `${h.niche}|${h.city}`));
    
    let added = 0;
    for (const niche of NICHES) {
        for (const city of CITIES) {
            const key = `${niche}|${city}`;
            if (!existingMap.has(key)) {
                history.push({
                    niche,
                    city,
                    last_scraped: 0 // 0 berarti belum pernah di-scrape
                });
                added++;
            }
        }
    }

    if (added > 0) {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 4));
        console.log(`[TARGET MANAGER] Menambahkan ${added} kombinasi target baru ke database.`);
    }

    return history;
}

function getNextTarget() {
    const history = initHistory();

    // Urutkan berdasarkan waktu scrape paling lama
    history.sort((a, b) => a.last_scraped - b.last_scraped);

    const target = history[0];

    // Update waktu
    target.last_scraped = Date.now();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 4));

    console.log(`[TARGET MANAGER] Memilih target: ${target.niche} di ${target.city}`);
    return target;
}

module.exports = { getNextTarget };
