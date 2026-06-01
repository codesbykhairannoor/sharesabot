const puppeteer = require('puppeteer');

async function testNetwork() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Blokir resource berat
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    const leads = [];
    const visited = new Set();
    
    // Dengarkan respons network
    page.on('response', async (response) => {
        const url = response.url();
        // Google maps mengembalikan data via request ke URL yang mengandung "search" atau "batchexecute"
        if (url.includes('/search') && response.request().resourceType() === 'xhr' || url.includes('/batchexecute')) {
            try {
                const text = await response.text();
                // Parse text untuk mencari nomor telepon (biasanya format string JSON)
                // Kita bisa pakai regex untuk mencari nama tempat dan nomor telepon
                // Contoh: ["Nama Tempat", ... , ["+62 812-3456-7890"]]
                const matches = text.match(/\+?62[ \-\d]{8,15}/g);
                if (matches) {
                    matches.forEach(phoneRaw => {
                        let cleanPhone = phoneRaw.replace(/\D/g, '');
                        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                        else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                        if (cleanPhone.startsWith('628') && !visited.has(cleanPhone)) {
                            visited.add(cleanPhone);
                            leads.push({ name: "Lead Google Maps", phone: cleanPhone });
                            console.log("Found phone via network:", cleanPhone);
                        }
                    });
                }
            } catch (e) {}
        }
    });

    console.log("Navigasi ke GMaps...");
    await page.goto("https://www.google.com/maps/search/Make+Up+Artist+di+Malang", { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Scroll sebentar untuk memicu lebih banyak loading
    await new Promise(r => setTimeout(r, 5000));
    try {
        await page.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollBy(0, 3000);
        });
    } catch(e){}
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log("Leads found via network:", leads.length);
    await browser.close();
}

testNetwork();
