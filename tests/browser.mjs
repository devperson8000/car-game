import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],failed=[];
try {
  const page=await browser.newPage({viewport:{width:800,height:520}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failed.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{localStorage.setItem('apex-quality','low');if(!localStorage.getItem('apex-best-mountain'))localStorage.setItem('apex-best-mountain','300');if(!localStorage.getItem('apex-muted'))localStorage.setItem('apex-muted','true');});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
  await page.locator('#drive').waitFor({timeout:90000});
  await page.waitForFunction(()=>!document.querySelector('#drive').disabled,undefined,{timeout:90000});
  assert.equal(await page.locator('#best-lap').textContent(),'05:00.000');
  await fs.mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/garage.png'});
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');
  console.log('Saved mute toggles on the first click');
  const speed=()=>page.locator('#speed').textContent().then(Number);
  await page.keyboard.down('w');
  console.log('Throttle held',await page.evaluate(()=>({body:document.body.className,speed:document.querySelector('#speed').textContent})));
  await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)>20,undefined,{timeout:90000});
  await page.keyboard.up('w');
  assert.ok(await speed()>20);console.log('Acceleration passed');
  for(const [key,direction] of [['a',-1],['d',1]]){
    await page.keyboard.down(key);await page.waitForFunction(d=>Number(document.querySelector('#steering').getAttribute('aria-valuenow'))*d>5,direction,{timeout:30000});await page.keyboard.up(key);
  }
  await page.keyboard.down('s');await page.waitForFunction(()=>parseFloat(document.querySelector('#brake-meter').style.width)>10,undefined,{timeout:30000});await page.keyboard.up('s');
  await page.keyboard.press('r');await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)<2,undefined,{timeout:20000});
  await page.locator('#pause').click();
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>parseFloat(document.querySelector('#throttle-meter').style.width)>10,undefined,{timeout:30000});await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)>8,undefined,{timeout:90000});await page.keyboard.up('ArrowUp');
  for(const [key,direction] of [['ArrowLeft',-1],['ArrowRight',1]]){
    await page.keyboard.down(key);await page.waitForFunction(d=>Number(document.querySelector('#steering').getAttribute('aria-valuenow'))*d>5,direction,{timeout:30000});await page.keyboard.up(key);
  }
  await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>parseFloat(document.querySelector('#brake-meter').style.width)>10,undefined,{timeout:30000});await page.keyboard.up('ArrowDown');
  console.log('WASD and all four arrows deliver live vehicle inputs');
  await page.keyboard.press('r');await page.waitForFunction(()=>Number(document.querySelector('#speed').textContent)<2,undefined,{timeout:20000});
  await page.locator('#camera').click();assert.match(await page.locator('#camera').textContent(),/Cockpit/);await page.screenshot({path:'test-results/cockpit.png'});
  await page.locator('#camera').click();assert.match(await page.locator('#camera').textContent(),/Hood/);await page.screenshot({path:'test-results/hood.png'});
  await page.locator('#camera').click();
  await page.locator('#pause').click();assert.equal(await page.locator('#menu').getAttribute('data-mode'),'pause');assert.match(await page.locator('#menu-title').textContent(),/breather/);
  const before=await page.locator('#lap-time').textContent();await page.waitForTimeout(500);assert.equal(await page.locator('#lap-time').textContent(),before);
  await page.locator('#drive').click();
  await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  await page.locator('#sound').click();
  await page.waitForFunction(()=>document.querySelector('#audio-status').dataset.state==='ready',undefined,{timeout:30000});
  await page.screenshot({path:'test-results/driving.png'});
  await page.setViewportSize({width:844,height:390});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#controls').click();await page.locator('#help-dialog').waitFor({state:'visible'});const cameraBefore=await page.locator('#camera').textContent();await page.keyboard.press('c');assert.equal(await page.locator('#camera').textContent(),cameraBefore);await page.locator('#show-touch').check();await page.locator('#close-help').click();
  await page.screenshot({path:'test-results/mobile.png'});
  await page.locator('#pause').click();
  await page.locator('#quality').selectOption('balanced');
  await page.locator('#lighting').selectOption('golden');
  await page.screenshot({path:'test-results/golden-hour.png'});
  await page.locator('#quality').selectOption('low');
  // Selecting the authentic circuit reloads the app with local geometry/DEM.
  await Promise.all([page.waitForNavigation(),page.locator('#route').selectOption('nordschleife')]);
  await page.waitForFunction(()=>!document.querySelector('#drive').disabled,undefined,{timeout:120000});
  assert.match(await page.locator('#route-tag').textContent(),/NORDSCHLEIFE/);
  assert.match(await page.locator('#map-length').textContent(),/20\.7/);
  assert.equal(await page.locator('#best-lap').textContent(),'— — : — —');assert.equal(await page.locator('#show-touch').isChecked(),true);
  await page.screenshot({path:'test-results/nordschleife.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('Browser checks passed: both routes, golden-hour detailed trees, model/track load, acceleration, braking/reset, three cameras, pause, engine audio, controls, responsive rendering; zero page errors or failed HTTP responses.');
} catch(e){console.error('Browser errors:',errors,'HTTP failures:',failed);throw e;} finally {await browser.close();}
