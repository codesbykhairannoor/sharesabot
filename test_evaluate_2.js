const puppeteer = require('puppeteer');

async function testEvaluate2() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    await page.setViewport({ width: 1280, height: 800 });
    
    console.log("Navigasi ke GMaps...");
    await page.goto("https://www.google.com/maps/search/Make+Up+Artist+di+Malang", { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 5000));
    await page.waitForSelector('div[role="feed"]', { timeout: 60000 });
    
    console.log("Mulai ekstrak dalam evaluate...");
    const leads = await page.evaluate(async () => {
        const results = [];
        const visited = new Set();
        const delay = ms => new Promise(r => setTimeout(r, ms));
        
        let scrollAttempts = 0;
        while (results.length < 5 && scrollAttempts < 10) {
            let feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollBy(0, 3000);
            await delay(2000);
            scrollAttempts++;
            
            let items = Array.from(document.querySelectorAll('div[role="article"]'));
            
            for (let i = 0; i < items.length; i++) {
                if (results.length >= 5) break;
                
                // Refresh items list because DOM gets recreated when going back
                items = Array.from(document.querySelectorAll('div[role="article"]'));
                let item = items[i];
                if (!item) continue;
                
                const name = item.getAttribute('aria-label');
                if (!name || visited.has(name)) continue;
                visited.add(name);
                
                // Buka detail
                item.click();
                await delay(3000);
                
                // Cari nomor
                const phoneEl = document.querySelector('button[data-tooltip="Salin nomor telepon"]');
                if (phoneEl) {
                    let phoneRaw = phoneEl.innerText || '';
                    let cleanPhone = phoneRaw.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                    else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                    if (cleanPhone.startsWith('628')) {
                        results.push({ name, phone: cleanPhone });
                    }
                }
                
                // Kembali ke list
                const backBtn = document.querySelector('button[aria-label="Kembali"], button[aria-label="Back"]');
                if (backBtn) {
                    backBtn.click();
                    await delay(2000);
                }
            }
        }
        return results;
    });
    
    console.log("Leads found:", leads);
    await browser.close();
}

testEvaluate2();
