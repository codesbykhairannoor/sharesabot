const puppeteer = require('puppeteer');

async function testMobile() {
    console.log("Memulai simulasi stress test...");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    
    // Gunakan user agent mobile agar Google Maps meload versi ringan
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
    // Blokir resources berat
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    try {
        console.log("Navigasi ke GMaps...");
        await page.goto("https://www.google.com/maps/search/Make+Up+Artist+di+Malang", { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        await new Promise(r => setTimeout(r, 5000));
        
        // Eksekusi seluruh logika ekstraksi di DALAM browser (1x pemanggilan CDP) untuk menghindari timeout
        const leads = await page.evaluate(async () => {
            const results = [];
            // Di versi mobile, elemen hasil pencarian biasanya berupa list item (div/a)
            // Mari kita kumpulkan semua text yang terlihat di halaman
            const bodyText = document.body.innerText;
            return bodyText.substring(0, 500); // Ambil sample text untuk analisis struktur
        });
        
        console.log("Sample DOM Text Mobile:", leads);
        
    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        await browser.close();
    }
}

testMobile();
