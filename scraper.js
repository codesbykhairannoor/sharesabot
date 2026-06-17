const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('user-agent-override'); // Fix ProtocolError on headless shell
puppeteer.use(stealth);
const fs = require('fs');
const path = require('path');

const DB_FILE = 'database.json';

// Auto-detect Chrome/Chromium di sistem
function findChromePath() {
    const candidates = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium'
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
        console.log(`[SCRAPER] Menggunakan browser bawaan terisolasi Puppeteer.`);
    }
    
    const launchOptions = {
        headless: true, // Kembali ke 'true' karena Chromium bawaan VPS mungkin belum support 'shell'

        protocolTimeout: 180000, 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-features=site-per-process',
            '--js-flags=--max-old-space-size=256',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection'
        ]
    };
    if (chromePath) launchOptions.executablePath = chromePath;
    
    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
    } catch (launchError) {
        console.error(`\n[SCRAPER] ❌ FATAL: Gagal menjalankan browser!`);
        console.error(`Pesan Error: ${launchError.message}`);
        return;
    }
    
    const page = await browser.newPage();
    
    page.on('error', err => {
        console.log(`[SCRAPER] Page Error/Crash: ${err.message}`);
    });

    // OPTIMASI SUPER HEMAT RAM & CPU UNTUK VPS AWS (BLOCK GAMBAR, CSS, FONT)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        console.log(`[SCRAPER] Memuat halaman Google Maps...`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await new Promise(r => setTimeout(r, 5000));
        
        // Handle Google Consent screen jika diredirect
        const currentUrl = page.url();
        if (currentUrl.includes('consent.google.com')) {
            console.log(`[SCRAPER] Terjebak di Google Consent. Mencoba bypass...`);
            try {
                await page.evaluate(() => {
                    const forms = document.querySelectorAll('form');
                    if (forms.length > 0) forms[forms.length - 1].submit(); // Usually the "Accept all" form
                });
                await new Promise(r => setTimeout(r, 5000));
            } catch(e) {
                console.log(`[SCRAPER] Gagal bypass consent:`, e.message);
            }
        }

        console.log(`[SCRAPER] Menunggu panel hasil pencarian muncul...`);
        await page.waitForSelector('div[role="feed"]', { timeout: 60000 });
    } catch (e) {
        console.log(`[SCRAPER] Gagal memuat halaman atau feed tidak ditemukan: ${e.message}`);
        await browser.close();
        return;
    }
    
    const results = [];
    const visited = new Set();
    
    const urls = await page.evaluate(async (maxLeads) => {
        const feed = document.querySelector('div[role="feed"]');
        let scrollAttempts = 0;
        while (scrollAttempts < 15) {
            if (feed) feed.scrollBy(0, 5000);
            await new Promise(r => setTimeout(r, 2000));
            scrollAttempts++;
            const currentItems = document.querySelectorAll('div[role="article"] a');
            if (currentItems.length >= maxLeads * 2) break;
        }
        const items = document.querySelectorAll('div[role="article"] a');
        return Array.from(items)
            .map(a => a.href)
            .filter(href => href && href.includes('/place/'));
    }, totalLeads);
    
    // Tutup browser utama karena kita sudah dapat semua URL
    await browser.close();
    
    // Buang duplikat URL
    const uniqueUrls = [...new Set(urls)].slice(0, totalLeads);
    console.log(`[SCRAPER] Menemukan ${uniqueUrls.length} link tempat potensial. Mulai ekstrak data...`);
    
    for (const url of uniqueUrls) {
        if (results.length >= totalLeads) break;
        
        let detailBrowser;
        try {
            // LAUNCH BROWSER BARU PER LINK! Ini jaminan 100% anti-OOM di VPS 1GB.
            detailBrowser = await puppeteer.launch(launchOptions);
            const detailPage = await detailBrowser.newPage();
            
            // WAJIB SET USER-AGENT & VIEWPORT DI TAB BARU (Kalau nggak, Google ngasih versi Mobile yang struktur H1-nya beda!)
            await detailPage.setViewport({ width: 1280, height: 800 });
            await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await detailPage.setRequestInterception(true);
            detailPage.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
                else req.continue();
            });
            
            // Set cookie consent untuk mem-bypass layar "Before you continue" dari Google
            await detailPage.setCookie({
                name: 'CONSENT',
                value: 'YES+cb.20230501-14-p0.en+FX+410',
                domain: '.google.com'
            });

            // Tambahkan param hl=id agar memaksa bahasa Indonesia
            const targetUrl = url.includes('?') ? url + '&hl=id' : url + '?hl=id';
            await detailPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Handle Google Consent screen jika masih lolos
            if (detailPage.url().includes('consent.google')) {
                try {
                    await detailPage.evaluate(() => {
                        const forms = document.querySelectorAll('form');
                        if (forms.length > 0) forms[forms.length - 1].submit();
                    });
                    await detailPage.waitForNavigation({ timeout: 10000 }).catch(() => {});
                } catch(e) {}
            }
            
            // Tunggu H1 (Nama Tempat) muncul, karena VPS mungkin butuh waktu render elemen React-nya
            await detailPage.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 1500)); // Ekstra jeda
            
            const debugTitle = await detailPage.title();
            
            const data = await detailPage.evaluate(() => {
                // Fallback jika H1 tidak ada (karena versi UI Google Maps beda-beda)
                let name = document.querySelector('h1')?.innerText || document.title.split('- Google Maps')[0].split('- Google')[0].trim() || "";

                
                // 1. Coba berdasar tooltip bahasa Indo atau Inggris
                let phoneEl = document.querySelector('button[data-tooltip="Salin nomor telepon"]') || 
                              document.querySelector('button[data-tooltip="Copy phone number"]');
                
                // 2. Coba berdasar atribut data-item-id
                if (!phoneEl) {
                    phoneEl = document.querySelector('button[data-item-id^="phone:tel:"]');
                }
                
                // 3. Fallback pencarian teks mentah di semua button
                if (!phoneEl) {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    phoneEl = buttons.find(b => {
                        const text = (b.innerText || '').replace(/\D/g, '');
                        return text.length >= 10 && text.length <= 14 && (text.startsWith('0') || text.startsWith('8') || text.startsWith('62'));
                    });
                }

                if (phoneEl && name) {
                    let phoneRaw = phoneEl.innerText || '';
                    if (!phoneRaw && phoneEl.getAttribute('data-item-id')) {
                        phoneRaw = phoneEl.getAttribute('data-item-id').replace('phone:tel:', '');
                    }
                    
                    let cleanPhone = phoneRaw.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                    else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                    
                    if (cleanPhone.startsWith('628')) {
                        return { name, phone: cleanPhone };
                    }
                }
                return { debugName: name, hasPhoneEl: !!phoneEl }; // Return debug info jika gagal
            });
            
            if (data && data.phone && !visited.has(data.name)) {
                visited.add(data.name);
                results.push({
                    name: data.name,
                    phone: data.phone,
                    niche,
                    city,
                    status: 'PENDING'
                });
                console.log(`[SCRAPER] Found: ${data.name} | ${data.phone}`);
            } else if (data && !data.phone) {
                console.log(`[SCRAPER] Lewati (Tanpa WA): ${data.debugName} | Halaman: ${debugTitle}`);
            }
        } catch (err) {
            console.log(`[SCRAPER] Gagal memuat detail tempat, skip...`);
        } finally {
            if (detailBrowser) {
                await detailBrowser.close().catch(() => {});
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
    const newLeads = [];
    for (const r of results) {
        if (!existingPhones.has(r.phone)) {
            newLeads.push(r);
            existingPhones.add(r.phone);
        }
    }
    
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
