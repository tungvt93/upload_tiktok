import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function testProxy() {
    const proxy = 'http://Proxyviet03082191:rveNsBJb@51.81.218.183:56788';
    const [auth, hostPort] = proxy.replace('http://', '').split('@');
    const [username, password] = auth.split(':');
    
    console.log(`Connecting via proxy: ${hostPort} with user ${username}`);

    const browser = await chromium.launch({
        proxy: {
            server: `http://${hostPort}`,
            username,
            password
        },
        headless: true
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('Navigating to TikTok upload page...');
        await page.goto('https://www.tiktok.com/tiktokstudio/upload', { 
            waitUntil: 'load',
            timeout: 60000 
        });

        console.log('Page loaded. Taking screenshot...');
        await page.screenshot({ path: 'scratch/tiktok_proxy_test.png' });
        
        const content = await page.content();
        fs.writeFileSync('scratch/tiktok_content.html', content);
        
        console.log('Success! Check scratch/tiktok_proxy_test.png and scratch/tiktok_content.html');
    } catch (e) {
        console.error('Failed:', e.message);
    } finally {
        await browser.close();
    }
}

testProxy();
