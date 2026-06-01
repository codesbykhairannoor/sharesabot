const puppeteer = require('puppeteer');

async function testEvaluate5() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    console.log("Navigasi ke GMaps Search...");
    await page.goto("https://www.google.com/maps/search/Make+Up+Artist+di+Malang", { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise(r => setTimeout(r, 5000));
    await page.waitForSelector('div[role="feed"]', { timeout: 60000 });
    
    console.log("Extracting URLs...");
    const urls = await page.evaluate(async () => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 3000);
        await new Promise(r => setTimeout(r, 2000));
        
        const items = document.querySelectorAll('div[role="article"] a');
        return Array.from(items).map(a => a.href).filter(href => href && href.includes('/place/')).slice(0, 5);
    });
    
    console.log("URLs found:", urls.length);
    
    const leads = [];
    for (const url of urls) {
        console.log("Mengunjungi:", url.substring(0, 60) + "...");
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(r => setTimeout(r, 3000));
            const data = await page.evaluate(() => {
                let name = document.querySelector('h1')?.innerText || "Lead GMaps";
                const phoneEl = document.querySelector('button[data-tooltip="Salin nomor telepon"]');
                if (phoneEl) {
                    let phoneRaw = phoneEl.innerText || '';
                    let cleanPhone = phoneRaw.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
                    else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;
                    if (cleanPhone.startsWith('628')) {
                        return { name, phone: cleanPhone };
                    }
                }
                return null;
            });
            if (data) {
                leads.push(data);
                console.log("Dapat:", data.name, data.phone);
            } else {
                console.log("Tidak ada WA");
            }
        } catch(e) {
            console.log("Gagal memuat detail:", e.message);
        }
    }
    
    console.log("Leads final:", leads);
    await browser.close();
}
testEvaluate5();
