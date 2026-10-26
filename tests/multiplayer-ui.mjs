import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const url = process.env.TEST_URL || 'http://127.0.0.1:4181';
  await page.route('**/multiplayer-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#141b1d;font-family:Arial;color:#fff"><footer><nav></nav></footer></body></html>' }));
  await page.goto(`${url}/multiplayer-test`);
  await page.evaluate(async () => {
    const { LobbyUI } = await import('/src/multiplayer/lobby-ui.js');
    window.events = [];
    window.ui = new LobbyUI(Object.fromEntries(['onOpen','onClose','onCreate','onRequest','onApprove','onLeave','onReady','onStart','onCancel','onKick','onConfigure','onEnter'].map(name => [name, data => events.push({ name, data })])));
  });
  await page.locator('#multiplayer-open').click();
  assert.equal(await page.locator('#multiplayer-dialog').evaluate(d => d.open), true);
  await page.locator('input[name=name]').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Create lobby' }).click();
  const created = await page.evaluate(() => events.find(event => event.name === 'onCreate'));
  assert.equal(created.data.mode, 'free'); assert.equal(created.data.laps, 3);
  await page.evaluate(() => ui.setLobbies([{ code: 'ABC123', name: '<img src=x>', players: 1, maxPlayers: 8, mode: 'free', route: 'mountain', phase: 'running' }]));
  assert.equal(await page.locator('.mp-browser img').count(), 0);
  await page.locator('.mp-lobby button').click();
  assert.equal((await page.evaluate(() => events.at(-1))).data.code, 'ABC123');
  const room = { code: 'ABC123', name: 'Weekend drivers', ownerId: 'one', config: { mode: 'race', route: 'mountain', weather: 'rain', laps: 3 }, phase: 'lobby', players: [{ id: 'one', name: '<b>Host</b>', car: 'apex', connected: true, ready: true }, { id: 'two', name: 'Guest', car: 'm3', connected: true, ready: false }], pendingRequests: [{ id: 'pending', name: 'Third driver', car: 'brz' }] };
  await page.evaluate(room => ui.setRoom(room, 'one'), room);
  assert.equal(await page.locator('.mp-player b').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Start race', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  assert.deepEqual((await page.evaluate(() => events.at(-1))).data, { requestId: 'pending', accept: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('#multiplayer-dialog').evaluate(d => d.scrollWidth <= d.clientWidth), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#multiplayer-dialog').evaluate(d => d.open), false);
  assert.equal(await page.evaluate(() => events.at(-1).name), 'onClose');
  await page.evaluate(() => { ui.setAvailable(false); ui.open(); });
  assert.match(await page.locator('.mp-content').innerText(), /not connected to a live multiplayer server/);
  await page.evaluate(async()=>{
    ui.dialog.remove();ui.openButton.remove();
    for(const id of ['car-select','route','lighting','paint','gearbox']){const input=document.createElement('select');input.id=id;document.body.append(input);}
    const {MultiplayerController}=await import('/src/multiplayer/controller.js');const {Session}=await import('/src/sim/session.js');
    let leaves=0;const controller=new MultiplayerController({session:new Session('mountain'),view:{},input:{clear(){}},storage:null,car:{id:'apex'},paint:'#112233',callbacks:{isDriving:()=>false,pause(){},resume(){},enter(){},leave(){leaves++;}}});
    controller.message({type:'rejected',message:'Declined'});if(leaves!==0)throw Error('Rejected guest must keep solo session');
    controller.joined=true;controller.message({type:'left'});if(leaves!==1)throw Error('Accepted member must return to solo');
    controller.joined=true;controller.message({type:'error',message:'Session expired'});if(controller.joined||leaves!==2)throw Error('Expired reconnect must restore solo controls');
    controller.inputPump.stop();clearInterval(controller.predictionTimer);controller.client.disconnect();
  });
  console.log('Multiplayer UI passed: create/join payloads, safe names, host approval, ready gate, mobile overflow, Escape and offline state.');
} finally { await browser.close(); }
