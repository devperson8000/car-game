import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('apex-quality','low'));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4176');await page.waitForFunction(()=>!document.querySelector('#drive').disabled);
 await page.locator('#gearbox').selectOption('manual');await page.locator('#drive').click();await page.waitForFunction(()=>document.querySelector('#transmission').textContent.includes('MANUAL'));
 await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#gear').textContent==='2');await page.waitForTimeout(4000);await page.keyboard.press('q');await page.waitForFunction(()=>document.querySelector('#gear').textContent==='1');
 await page.keyboard.press('m');assert.equal(await page.locator('#gearbox').inputValue(),'auto');await page.keyboard.press('m');assert.equal(await page.locator('#gearbox').inputValue(),'manual');
 assert.equal(await page.evaluate(()=>localStorage.getItem('apex-transmission')),'manual');
 await page.locator('#pause').click();await page.keyboard.press('e');await page.locator('#drive').click();assert.equal(await page.locator('#gear').textContent(),'1');
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#drive').disabled);assert.equal(await page.locator('#gearbox').inputValue(),'manual');assert.deepEqual(errors,[]);
 console.log('Manual mode passed: visible selector, E/Q shifts, M toggle, paused input isolation, saved choice after reload.');
}finally{await browser.close();}
