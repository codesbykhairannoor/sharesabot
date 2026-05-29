const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DB_FILE = 'database.json';

// Auto-detect Chrome/Chromium di sistem
function findChromePath() {
    const candidates = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome-unstable'
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null; // fallback ke bundled Puppeteer/Chrome dari 'npx puppeteer'
}

async function scrapeGMaps(niche, city, totalLeads = 10) {
    const fullQuery = `${niche} di ${city}`;
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(fullQuery)}`;
    
    console.log(`[SCRAPER] Navigasi ke: ${searchUrl}`);
    
    const chromePath = findChromePath();
    if (chromePath) {
        console.log(`[SCRAPER] Menggunakan browser: ${chromePath}`);
    } else {
        console.log(`[SCRAPER] Tidak ditemukan browser sistem, menggunakan bawaan Puppeteer.`);
    }
    
    const launchOptions = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
            '--disable-extensions'
        ]
    };
    if (chromePath) launchOptions.executablePath = chromePath;
    
    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
    } catch (launchError) {
        console.error(`\n[SCRAPER] ❌ FATAL: Gagal menjalankan browser!`);
        console.error(`Pesan Error: ${launchError.message}`);
        console.log(`\n[SOLUSI] Masalah ini biasanya karena:`);
        console.log(`1. Library sistem kurang. Jalankan ini di VPS:`);
        console.log(`   sudo apt-get update && sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 chromium-browser`);
        console.log(`2. Disk VPS Penuh. Cek dengan perintah: df -h`);
        console.log(`3. Folder /tmp penuh atau tidak punya ijin tulis.`);
        return;
    }
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(r => setTimeout(r, 5000));
        await page.waitForSelector('div[role="feed"]', { timeout: 30000 });
    } catch (e) {
        console.log(`[SCRAPER] Gagal memuat halaman: ${e.message}`);
        await browser.close();
        return;
    }
    
    const results = [];
    const visited = new Set();
    let scrollAttempts = 0;
    
    while (results.length < totalLeads && scrollAttempts < 15) {
        await page.mouse.wheel({ deltaY: 3000 });
        await new Promise(r => setTimeout(r, 3000));
        scrollAttempts++;
        
        const items = await page.$$('div[role="article"]');
        if (!items.length) break;
        
        for (const item of items) {
            if (results.length >= totalLeads) break;
            
            try {
                const name = await item.evaluate(el => el.getAttribute('aria-label'));
                if (!name || visited.has(name)) continue;
                visited.add(name);
                
                await item.click();
                await new Promise(r => setTimeout(r, 3000));
                
                // Cari nomor telepon
                const phoneEl = await page.$('button[data-tooltip="Salin nomor telepon"]');
                if (!phoneEl) continue;
                
                const phoneRaw = await phoneEl.evaluate(el => el.innerText);
                if (!phoneRaw || phoneRaw === '-') continue;
                
                // Bersihkan nomor
                let cleanPhone = phoneRaw.replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                
                if (cleanPhone.startsWith('628')) {
                    results.push({
                        name,
                        niche,
                        city,
                        phone: cleanPhone,
                        status: 'PENDING'
                    });
                    console.log(`[SCRAPER] Found: ${name} | ${cleanPhone}`);
                }
            } catch (err) {
                continue;
            }
        }
    }
    
    await browser.close();
    
    // Simpan ke database.json (append, anti-duplikat)
    let existingData = [];
    if (fs.existsSync(DB_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch (e) { /* ignore */ }
    }
    
    const existingPhones = new Set(existingData.map(x => x.phone));
    const newLeads = results.filter(r => !existingPhones.has(r.phone));
    
    const finalData = [...existingData, ...newLeads];
    fs.writeFileSync(DB_FILE, JSON.stringify(finalData, null, 4));
    
    console.log(`[SCRAPER] Selesai. Disimpan ${newLeads.length} lead baru ke ${DB_FILE}`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node scraper.js <niche> <city> [total]');
    process.exit(1);
}

const niche = args[0];
const city = args[1];
const total = parseInt(args[2]) || 10;

scrapeGMaps(niche, city, total);
