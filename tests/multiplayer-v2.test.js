import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomEngine } from '../server/engine.js';
import { INPUT_DT, captureSession, restoreSession, applyInputFrame } from '../src/sim/network-state.js';
import { Session } from '../src/sim/session.js';
const controls={steer:.1,throttle:.7,brake:0,handbrake:false};
const frame=seq=>({seq,controls:{...controls},auto:true,tc:true,abs:true,shifts:[]});
function setup(mode='free'){
 let now=1000;const messages=[];const engine=new RoomEngine({now:()=>now});const id=engine.connect(m=>messages.push(m));
 engine.message(id,{type:'protocol',version:2});engine.message(id,{type:'create',name:'Owner',lobbyName:'V2',mode,route:'mountain',weather:'day',laps:1,car:'apex',auto:true,paint:'#112233'});
 const room=[...engine.rooms.values()][0],p=[...room.players.values()][0];let seq=0;
 return{engine,id,room,p,messages,last:type=>messages.filter(m=>m.type===type).at(-1),send(m){engine.message(id,m);},input(frames,extra={}){engine.message(id,{type:'input',seq:seq++,epoch:p.inputEpoch,controls,auto:true,parked:false,frames,...extra});},tick(dt=INPUT_DT){now+=dt*1000;engine.tick(dt);},advance(ms){now+=ms;},snapshot(){engine.snapshots();return messages.filter(m=>m.type==='snapshot').at(-1);}};
}
test('negotiated v2 waits for frames and sends complete own state plus compact remote cars',()=>{
 const s=setup(),before=captureSession(s.p.session);s.tick();s.tick();assert.deepEqual(captureSession(s.p.session),before);
 const legacyMessages=[],legacy=s.engine.connect(m=>legacyMessages.push(m));s.engine.message(legacy,{type:'request',code:s.room.code,name:'Guest',car:'brz',auto:true,paint:'#123456'});s.send({type:'approve',requestId:[...s.room.pending.keys()][0],accept:true});
 const packet=s.snapshot();assert.equal(packet.version,2);assert.equal(packet.self.ack.frame,-1);assert.equal(packet.self.ack.reason,'join');assert.equal(packet.self.simulation.vehicle.wheels.length,4);assert.equal(packet.players.length,1);assert.equal(packet.players[0].state.wheels[0].worldPos,undefined);assert.equal(packet.players[0].state.tc,undefined);assert.ok(legacyMessages.at(-1).players[0].laps);
 s.advance(100);assert.equal(s.snapshot().standings,undefined);s.advance(400);assert.ok(s.snapshot().standings);s.send({type:'configure',mode:'free',route:'mountain',weather:'rain',laps:1});assert.equal(s.snapshot().standings,undefined);s.send({type:'configure',mode:'race',route:'mountain',weather:'day',laps:1});assert.ok(s.snapshot().standings);
});
test('jittered fixed-frame batches catch up to exactly the acknowledged deterministic replay',()=>{
 const s=setup(),replay=new Session('mountain','apex');assert.ok(restoreSession(replay,captureSession(s.p.session)));
 s.input([frame(0)]);s.tick();applyInputFrame(replay,frame(0));let next=1;for(const delay of [4,2,6,3,5,1,4,6,2,5]){for(let n=0;n<delay;n++)s.tick();const frames=Array.from({length:delay},()=>frame(next++));s.input(frames);s.tick();for(const f of frames)applyInputFrame(replay,f);assert.equal(s.p.lastProcessedFrame,next-1);assert.deepEqual(captureSession(s.p.session),captureSession(replay));}
 assert.equal(s.snapshot().self.ack.frame,next-1);
});
test('invalid frame batches are atomic and queue, sequence, epoch and wall clock budgets are bounded',()=>{
 const s=setup();s.input([frame(0),frame(2)]);assert.equal(s.p.lastReceivedFrame,-1);assert.equal(s.p.pendingFrames.length,0);assert.equal(s.p.seq,-1);
 s.input(Array.from({length:16},(_,i)=>frame(i)));assert.equal(s.p.pendingFrames.length,0);
 s.input([frame(0),{...frame(1),controls:{...controls,steer:Infinity}}]);assert.equal(s.p.lastReceivedFrame,-1);
 for(let batch=0;batch<8;batch++)s.input(Array.from({length:15},(_,i)=>frame(batch*15+i)));
 assert.equal(s.p.pendingFrames.length,120);s.input([frame(120)]);assert.equal(s.p.pendingFrames.length,120);
 const errors=s.messages.filter(m=>m.type==='error').length;s.input([frame(120)],{epoch:s.p.inputEpoch-1});assert.equal(s.messages.filter(m=>m.type==='error').length,errors);
 s.engine.tick(10);assert.equal(s.p.lastProcessedFrame,6);assert.ok(s.p.pendingFrames.length>=113);assert.ok(s.p.simulationBudget<INPUT_DT);
 const processed=s.p.lastProcessedFrame;for(let i=0;i<6;i++)s.tick();assert.ok(s.p.lastProcessedFrame-processed<=6);
});
test('client supplied timing and transforms cannot fast forward a frame',()=>{
 const s=setup(),before=s.p.session.elapsed;s.input([{...frame(0),dt:99,time:999999,pos:[0,0,0],laps:{completed:99}}],{dt:99,pos:[0,0,0]});s.tick();assert.ok(Math.abs(s.p.session.elapsed-before-INPUT_DT)<1e-10);assert.equal(s.p.session.laps.completed,0);assert.ok(s.p.session.vehicle.pos.length()>1);
 s.send({type:'input',seq:s.p.seq,epoch:s.p.inputEpoch,frames:[frame(1)],controls,auto:true,parked:false});assert.equal(s.p.lastReceivedFrame,0);
});
test('safety epochs change once, heartbeats stay fresh, stale braking never auto reverses',()=>{
 const s=setup();s.input([frame(0)]);s.tick();const epoch=s.p.inputEpoch;
 s.input([],{parked:true});s.tick();assert.equal(s.p.inputEpoch,epoch+1);assert.equal(s.snapshot().self.ack.reason,'safety');assert.equal(s.p.lastProcessedFrame,-1);assert.equal(s.p.pendingFrames.length,0);
 for(let i=0;i<120;i++){if(i%10===0)s.input([],{parked:true});s.tick();}assert.equal(s.p.inputEpoch,epoch+1);assert.notEqual(s.p.session.vehicle.gear,-1);
 s.input([frame(0)]);s.tick();assert.equal(s.p.lastProcessedFrame,0);s.input([]);for(let i=0;i<20;i++)s.tick();assert.equal(s.p.inputEpoch,epoch+1);
 for(let i=0;i<160;i++)s.tick();assert.equal(s.p.inputEpoch,epoch+2);assert.notEqual(s.p.session.vehicle.gear,-1);assert.equal(s.p.session.vehicle.ctrl.throttle,0);
});
test('recover and resume discard queued frames and restart sequence in new epochs',()=>{
 const s=setup();s.input([frame(0),frame(1)]);const epoch=s.p.inputEpoch;s.send({type:'recover'});assert.equal(s.snapshot().self.ack.reason,'recover');assert.equal(s.p.inputEpoch,epoch+1);assert.equal(s.p.pendingFrames.length,0);
 s.input([frame(0)]);s.tick();const token=s.p.token;s.engine.disconnect(s.id);const epochAtDisconnect=s.p.inputEpoch;
 const messages=[],id=s.engine.connect(m=>messages.push(m));s.engine.message(id,{type:'protocol',version:2});s.engine.message(id,{type:'resume',token});assert.equal(s.p.inputEpoch,epochAtDisconnect+1);assert.equal(s.p.lastReceivedFrame,-1);
 s.engine.message(id,{type:'input',seq:0,epoch:s.p.inputEpoch,frames:[frame(0)],controls,auto:true,parked:false});s.tick();assert.equal(s.p.lastProcessedFrame,0);assert.equal(messages.some(m=>m.type==='error'),false);
});
test('race lobby and countdown stay stationary; running clears countdown frames with a new epoch',()=>{
 const s=setup('race'),guest=s.engine.connect(()=>{});s.engine.message(guest,{type:'request',code:s.room.code,name:'Guest',car:'brz',auto:true,paint:'#123456'});s.send({type:'approve',requestId:[...s.room.pending.keys()][0],accept:true});
 const before=captureSession(s.p.session);s.input([frame(0)]);s.tick();assert.deepEqual(captureSession(s.p.session),before);
 s.send({type:'ready',ready:true});s.engine.message(guest,{type:'ready',ready:true});s.send({type:'start'});const epoch=s.p.inputEpoch,grid=captureSession(s.p.session);s.input([frame(0)]);s.tick();assert.deepEqual(captureSession(s.p.session),grid);s.advance(5000);s.tick();assert.equal(s.room.phase,'running');assert.equal(s.p.inputEpoch,epoch+1);assert.equal(s.p.lastProcessedFrame,-1);assert.equal(s.p.pendingFrames.length,0);
});

test('framed driver gearbox and assists cannot be changed outside acknowledged input frames',()=>{
 const s=setup();s.input([frame(0)]);s.tick();const before=captureSession(s.p.session);
 s.send({type:'transmission',auto:false});s.send({type:'assists',tc:false,abs:false});s.send({type:'shift',direction:'up'});assert.deepEqual(captureSession(s.p.session),before);
 s.input([{...frame(1),auto:false,tc:false,abs:false,shifts:['up']}]);s.tick();assert.equal(s.p.session.vehicle.auto,false);assert.equal(s.p.session.vehicle.tc,false);assert.equal(s.p.session.vehicle.abs,false);
});

test('eight-player v2 snapshot transmits substantially less state than the legacy snapshot',t=>{const s=setup();let legacy;for(let i=0;i<7;i++){const messages=[],id=s.engine.connect(m=>messages.push(m));s.engine.message(id,{type:'request',code:s.room.code,name:`Guest ${i}`,car:'brz',auto:true,paint:'#3366ff'});s.send({type:'approve',requestId:[...s.room.pending.keys()][0],accept:true});legacy=messages;}const modern=s.snapshot(),old=legacy.filter(m=>m.type==='snapshot').at(-1),bytes=JSON.stringify(modern).length,oldBytes=JSON.stringify(old).length;assert.ok(bytes<oldBytes*.65,`${bytes} vs ${oldBytes} bytes`);t.diagnostic(`${bytes} vs ${oldBytes} bytes for eight players`);});
