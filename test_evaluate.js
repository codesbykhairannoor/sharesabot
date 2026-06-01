const puppeteer = require('puppeteer');

async function testEvaluate() {
    console.log("Memulai simulasi...");
    const browser = await puppeteer.launch({
        headless: 'new',
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
    });
    
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        console.log("Navigasi ke GMaps...");
        await page.goto("https://www.google.com/maps/search/Make+Up+Artist+di+Malang", { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        await new Promise(r => setTimeout(r, 5000));
        await page.waitForSelector('div[role="feed"]', { timeout: 60000 });
        
        console.log("Menjalankan logika ekstraksi di dalam evaluate()...");
        const leads = await page.evaluate(async () => {
            const results = [];
            const visited = new Set();
            const delay = ms => new Promise(r => setTimeout(r, ms));
            
            // disable animations to save CPU
            const style = document.createElement('style');
            style.innerHTML = '* { transition: none !important; animation: none !important; scroll-behavior: auto !important; }';
            document.head.appendChild(style);
            
            let scrollAttempts = 0;
            while (results.length < 5 && scrollAttempts < 10) {
                const feed = document.querySelector('div[role="feed"]');
                if (feed) feed.scrollBy(0, 3000);
                await delay(2000);
                scrollAttempts++;
                
                const items = document.querySelectorAll('div[role="article"]');
                if (!items || items.length === 0) break;
                
                for (const item of items) {
                    if (results.length >= 5) break;
                    
                    const name = item.getAttribute('aria-label');
                    if (!name || visited.has(name)) continue;
                    visited.add(name);
                    
                    item.click();
                    await delay(3000);
                    
                    const phoneEl = document.querySelector('button[data-tooltip="Salin nomor telepon"]');
                    if (phoneEl) {
                        let phoneRaw = phoneEl.innerText || '';
                        if (phoneRaw && phoneRaw !== '-') {
                            let cleanPhone = phoneRaw.replace(/\D/g, '');
                            if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                            else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                            if (cleanPhone.startsWith('628')) {
                                results.push({ name, phone: cleanPhone });
                            }
                        }
                    }
                    
                    // klik tombol back
                    const backBtn = document.querySelector('button[aria-label="Kembali"]');
                    if (backBtn) {
                        backBtn.click();
                        await delay(2000);
                    }
                }
            }
            return results;
        });
        
        console.log("Leads found:", leads);
        
    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        await browser.close();
    }
}

testEvaluate();
