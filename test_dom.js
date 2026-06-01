const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'shell' });
    const page = await browser.newPage();
    
    // Set cookie
    await page.setCookie({
        name: 'CONSENT',
        value: 'YES+cb.20230501-14-p0.en+FX+410',
        domain: '.google.com'
    });

    await page.goto('https://www.google.com/maps/search/Make+Up+Artist+di+Medan', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('div[role="feed"]');
    
    // Get first link
    const url = await page.evaluate(() => {
        return document.querySelector('div[role="article"] a').href;
    });
    
    console.log("First URL:", url);
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    const h1s = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('h1')).map(h => h.innerText);
    });
    console.log("H1 elements:", h1s);
    
    const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => b.innerText);
    });
    console.log("Buttons containing digits:", buttons.filter(b => /\d/.test(b)));
    
    await browser.close();
}
run();
