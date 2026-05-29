import asyncio
import urllib.parse
import json
import sys
import os
from playwright.async_api import async_playwright

async def scrape_headless(search_query, city_name, total_leads=10):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        full_query = f"{search_query} di {city_name}"
        query_encoded = urllib.parse.quote(full_query)
        search_url = f"https://www.google.com/maps/search/{query_encoded}"
        
        print(f"[SCRAPER] Navigasi ke: {search_url}")
        
        try:
            await page.goto(search_url, timeout=90000)
            await asyncio.sleep(5)
            await page.wait_for_selector('div[role="feed"]', timeout=30000)
        except Exception as e:
            print(f"[SCRAPER] Gagal memuat halaman: {e}")
            await browser.close()
            return
            
        results = []
        visited = set()
        scroll_attempts = 0
        
        while len(results) < total_leads and scroll_attempts < 15:
            await page.mouse.wheel(0, 3000)
            await asyncio.sleep(3)
            scroll_attempts += 1
            
            items = await page.query_selector_all('div[role="article"]')
            if not items:
                break
                
            for item in items:
                try:
                    name = await item.get_attribute('aria-label')
                    if name in visited or not name: continue
                    visited.add(name)
                    
                    await item.click()
                    await asyncio.sleep(3)
                    
                    phone = "-"
                    phone_el = await page.query_selector('button[data-tooltip="Salin nomor telepon"]')
                    if phone_el:
                        phone = await phone_el.inner_text()
                        
                    clean_phone = "-"
                    if phone != "-":
                        clean_phone = "".join(filter(str.isdigit, phone))
                        if clean_phone.startswith("0"):
                            clean_phone = "62" + clean_phone[1:]
                        elif clean_phone.startswith("8"):
                            clean_phone = "62" + clean_phone
                        
                        if clean_phone.startswith("628"):
                            results.append({
                                "name": name,
                                "niche": search_query,
                                "city": city_name,
                                "phone": clean_phone,
                                "status": "PENDING"
                            })
                            print(f"[SCRAPER] Found: {name} | {clean_phone}")
                    
                    if len(results) >= total_leads: break
                except Exception:
                    continue
                    
        await browser.close()
        
        # Save to JSON
        filename = "database.json"
        existing_data = []
        if os.path.exists(filename):
            try:
                with open(filename, 'r') as f:
                    existing_data = json.load(f)
            except:
                pass
                
        # Append only new numbers
        existing_phones = {item['phone'] for item in existing_data}
        new_leads = [r for r in results if r['phone'] not in existing_phones]
        
        final_data = existing_data + new_leads
        with open(filename, 'w') as f:
            json.dump(final_data, f, indent=4)
            
        print(f"[SCRAPER] Selesai. Disimpan {len(new_leads)} lead baru ke {filename}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python backend_scraper.py <niche> <city> [total]")
        sys.exit(1)
        
    niche = sys.argv[1]
    city = sys.argv[2]
    total = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    
    asyncio.run(scrape_headless(niche, city, total))
