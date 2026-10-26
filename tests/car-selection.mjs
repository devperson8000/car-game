import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [id,name,bank] of [['brz','Subaru BRZ Varis','boxer4'],['m3','BMW M3 Race','race-v8']]){
 const page=await browser.newPage({viewport:{width:800,height:520}});page.setDefaultTimeout(120000);const errors=[],failures=[],sounds=new Set();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());if(r.url().includes(`/audio/${bank}/`))sounds.add(r.url());});
 await page.addInitScript(id=>{localStorage.setItem('apex-car',id);localStorage.setItem('apex-quality','low');},id);
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4176');await page.waitForFunction(()=>!document.querySelector('#drive').disabled);assert.equal(await page.locator('#car-name').textContent(),name);assert.equal(await page.locator('#car-select').inputValue(),id);
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/${id}-garage.png`});await page.locator('#drive').click();await page.keyboard.down('w');await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)>10);await page.keyboard.up('w');await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready');assert.equal(sounds.size,8);
 await page.screenshot({path:`test-results/${id}-driving.png`});await page.keyboard.press('c');await page.screenshot({path:`test-results/${id}-cockpit.png`});await page.setViewportSize({width:390,height:844});await page.locator('#pause').click();assert.equal(await page.locator('.session-options').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log(`${name}: selected model, live driving, distinct engine bank, cockpit and mobile layout passed`);await page.close();
 }
}finally{await browser.close();}
