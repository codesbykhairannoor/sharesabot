const puppeteer = require('puppeteer');

async function testEvaluate3() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // forward console
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
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
            console.log("Scroll attempt:", scrollAttempts);
            
            let items = Array.from(document.querySelectorAll('div[role="article"]'));
            console.log("Items found:", items.length);
            
            for (let i = 0; i < items.length; i++) {
                if (results.length >= 5) break;
                
                items = Array.from(document.querySelectorAll('div[role="article"]'));
                let item = items[i];
                if (!item) {
                    console.log("Item " + i + " tidak ditemukan setelah refresh DOM");
                    continue;
                }
                
                const name = item.getAttribute('aria-label');
                if (!name || visited.has(name)) continue;
                visited.add(name);
                console.log("Memproses:", name);
                
                item.click();
                await delay(3000);
                
                const phoneEl = document.querySelector('button[data-tooltip="Salin nomor telepon"]');
                if (phoneEl) {
                    let phoneRaw = phoneEl.innerText || '';
                    console.log("Dapat nomor:", phoneRaw);
                    let cleanPhone = phoneRaw.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                    else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                    if (cleanPhone.startsWith('628')) {
                        results.push({ name, phone: cleanPhone });
                    }
                } else {
                    console.log("Nomor tidak ada");
                }
                
                const backBtn = document.querySelector('button[aria-label="Kembali"], button[aria-label="Back"]');
                if (backBtn) {
                    backBtn.click();
                    await delay(2000);
                } else {
                    console.log("Tombol kembali tidak ditemukan!");
                }
            }
        }
        return results;
    });
    
    console.log("Leads found:", leads);
    await browser.close();
}

testEvaluate3();
