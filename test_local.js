const puppeteer = require('puppeteer');

async function testLocal() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Blokir resource berat
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    console.log("Navigasi ke Google Local Search...");
    // Menggunakan tbm=lcl (Local Search)
    await page.goto("https://www.google.com/search?q=Make+Up+Artist+di+Malang&tbm=lcl", { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Di halaman ini, biasanya ada list kotak-kotak bisnis.
    await new Promise(r => setTimeout(r, 5000));
    
    const leads = await page.evaluate(async () => {
        const results = [];
        // selector hasil tbm=lcl: elemen dengan class yg mengandung data-cid atau V0MxL
        const items = document.querySelectorAll('div[data-cid], a.yYlJEf');
        if (!items) return [];
        
        for (const item of items) {
            if (results.length >= 10) break;
            
            // Klik untuk memunculkan panel kanan
            item.click();
            await new Promise(r => setTimeout(r, 2000));
            
            // Cari nomor telepon di panel kanan
            const textContent = document.body.innerText;
            const phoneMatch = textContent.match(/(?:0|\+?62)\s*(?:\d\s*){8,12}/);
            let name = item.innerText.split('\n')[0];
            
            if (phoneMatch) {
                results.push({ name, phone: phoneMatch[0] });
            }
        }
        return results;
    });
    
    console.log("Leads found via Local Search:", leads);
    await browser.close();
}

testLocal();
