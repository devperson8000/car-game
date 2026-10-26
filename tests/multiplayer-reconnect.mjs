import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createMultiplayerServer} from '../server/index.js';

// Exercise the real browser controller/transport and authoritative service without
// spending the test's timing budget on software WebGL rendering.
const service=await createMultiplayerServer({port:0,host:'127.0.0.1'});
const fixture=new URL('../test-results/multiplayer-reconnect.html',import.meta.url);
await fs.mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
await fs.writeFile(fixture,'<!doctype html><html><body><footer><nav></nav></footer></body></html>');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url=process.env.TEST_URL||'http://127.0.0.1:5191';
  await page.goto(`${url}/test-results/multiplayer-reconnect.html`);
  await page.evaluate(async serverURL=>{
    for(const [id,value] of [['car-select','apex'],['route','mountain'],['lighting','day'],['paint','#112233'],['gearbox','auto']]){
      const select=document.createElement('select');select.id=id;select.add(new Option(value,value));document.body.append(select);
    }
    document.getElementById('gearbox').add(new Option('manual','manual'));
    const {MultiplayerController}=await import('/src/multiplayer/controller.js');
    const {Session}=await import('/src/sim/session.js');
    window.driving=false;window.session=new Session('mountain');
    window.controller=new MultiplayerController({
      session,view:{weather:'day'},input:{clear(){},sample:()=>({steer:0,throttle:.4,brake:0,handbrake:false})},
      storage:null,car:{id:'apex'},paint:'#112233',callbacks:{
        isDriving:()=>driving,pause(){driving=false;},resume(){driving=true;},enter(){driving=true;},leave(){driving=false;}
      }
    });
    controller.setAssists(false,true);
    controller.url=controller.client.url=serverURL;
    await controller.connect();
    controller.send({type:'create',name:'Reconnect driver',lobbyName:'Reconnect test',mode:'free',route:'mountain',weather:'day',laps:1,...controller.identity()});
  },`ws://127.0.0.1:${service.address().port}`);
  await page.waitForFunction(()=>controller.joined&&controller.prediction.ready).catch(async error=>{console.error(await page.evaluate(()=>({joined:controller.joined,protocol:controller.protocol,ready:controller.prediction.ready,error:controller.ui.error.textContent,status:controller.ui.status.textContent})));console.error(errors);throw error;});
  const original=await page.evaluate(()=>({id:controller.selfId,epoch:controller.prediction.epoch,protocol:controller.protocol}));
  assert.equal(original.protocol,2);
  await page.evaluate(()=>controller.enter());
  await page.waitForFunction(()=>session.vehicle.speedKmh>10);
  await page.evaluate(()=>{document.getElementById('gearbox').value='manual';controller.setTransmission(false);controller.action('KeyE');});
  await page.waitForFunction(()=>!session.vehicle.auto&&session.vehicle.gear===2&&controller.prediction.pending.length<30);
  assert.equal([...service.engine.rooms.values()][0].players.values().next().value.session.vehicle.tc,false,'assists chosen before joining flow into acknowledged inputs');
  await page.evaluate(()=>{window.oldToken=controller.token;controller.client._socket.close();});
  await page.waitForFunction(()=>controller.client.connected&&controller.token!==oldToken&&controller.prediction.ready&&controller.prediction.epoch>0);
  assert.equal(await page.evaluate(()=>controller.selfId),original.id,'resume must retain the approved membership');
  assert.ok(await page.evaluate(()=>controller.prediction.epoch)>original.epoch,'resume must start a new acknowledged input epoch');
  assert.equal(await page.evaluate(()=>driving),false,'reconnect stays safely paused until the driver enters again');
  await page.evaluate(()=>controller.enter());
  await page.waitForFunction(()=>session.vehicle.speedKmh>15&&controller.prediction.lastAck>10);
  assert.ok(await page.evaluate(()=>controller.prediction.pending.length)<60,'resumed history remains bounded and acknowledged');
  assert.equal(service.engine.rooms.size,1);
  assert.equal([...service.engine.rooms.values()][0].players.size,1,'reconnect must not duplicate drivers');
  await page.evaluate(()=>{controller.leave();controller.inputPump.stop();clearInterval(controller.predictionTimer);controller.client.disconnect();});
  assert.deepEqual(errors,[]);
  console.log('Browser reconnect passed: v2 negotiation, approved membership resume, fresh input epoch, safe pause, assists/manual input, resumed driving and bounded acknowledgements.');
}finally{
  await browser.close();await service.close();await fs.unlink(fixture);
}
