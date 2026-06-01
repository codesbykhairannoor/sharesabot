const puppeteer = require('puppeteer');
async function run() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media', 'manifest', 'other'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });
    await page.goto('https://www.google.com/maps/search/Catering+Pernikahan+di+Yogyakarta');
    try {
        await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
        console.log("Feed found!");
    } catch(e) {
        console.log("Failed. HTML snippet:");
        const html = await page.content();
        console.log(html.substring(0, 500));
    }
    await browser.close();
}
run();
