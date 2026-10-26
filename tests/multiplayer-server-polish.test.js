import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomEngine} from '../server/engine.js';
import {captureSession} from '../src/sim/network-state.js';

const controls={steer:0,throttle:1,brake:0,handbrake:false};
function race(){
 let now=1000;const messages=new Map(),engine=new RoomEngine({now:()=>now});
 const connect=()=>{const queue=[],id=engine.connect(m=>queue.push(m));messages.set(id,queue);return id;};
 const owner=connect();engine.message(owner,{type:'create',name:'Owner',lobbyName:'Race',mode:'race',route:'mountain',weather:'day',laps:1,car:'apex',auto:true,paint:'#112233'});
 const room=[...engine.rooms.values()][0],guest=connect();engine.message(guest,{type:'request',code:room.code,name:'Guest',car:'brz',auto:true,paint:'#334455'});engine.message(owner,{type:'approve',requestId:[...room.pending.keys()][0],accept:true});
 return {engine,room,owner,guest,messages,send:(id,m)=>engine.message(id,m),tick(ms=1000/60){now+=ms;engine.tick(ms/1000);},start(){engine.message(owner,{type:'ready',ready:true});engine.message(guest,{type:'ready',ready:true});engine.message(owner,{type:'start'});assert.equal(room.phase,'countdown');}};
}
test('legacy and framed drivers both remain stationary in the race lobby',()=>{
 const s=race(),p=s.engine.peers.get(s.owner).member.p,before=captureSession(p.session);
 for(let i=0;i<60;i++){s.send(s.owner,{type:'input',seq:i,auto:true,parked:false,controls});s.tick();}
 assert.deepEqual(captureSession(p.session),before,'ready-up lobby must not simulate a legacy driver');
});
test('disconnect during countdown returns to readiness instead of starting with a missing driver',()=>{
 const s=race();s.start();s.engine.disconnect(s.guest);s.tick();assert.equal(s.room.phase,'lobby');assert.equal(s.room.countdownEndsAt,null);assert.equal(s.room.raceStartedAt,null);assert.ok([...s.room.players.values()].every(p=>!p.ready));s.tick(6000);assert.equal(s.room.phase,'lobby');
});
test('leaving during countdown cannot start a one-driver race',()=>{
 const s=race();s.start();s.send(s.guest,{type:'leave'});s.tick(5001);assert.equal(s.room.phase,'lobby');assert.equal(s.room.countdownEndsAt,null);s.send(s.owner,{type:'ready',ready:true});s.send(s.owner,{type:'start'});assert.equal(s.room.phase,'lobby');
});
test('a countdown interrupted by reconnect requires fresh readiness and can restart normally',()=>{
 const s=race(),guestPlayer=s.engine.peers.get(s.guest).member.p,token=guestPlayer.token;s.start();const oldEpoch=guestPlayer.inputEpoch;s.engine.disconnect(s.guest);s.tick();
 const resumed=s.engine.connect(()=>{});s.send(resumed,{type:'protocol',version:2});s.send(resumed,{type:'resume',token});assert.equal(s.engine.peers.get(resumed).member.p.id,guestPlayer.id);assert.ok(guestPlayer.inputEpoch>oldEpoch);
 s.send(s.owner,{type:'start'});assert.equal(s.room.phase,'lobby');s.send(s.owner,{type:'ready',ready:true});s.send(resumed,{type:'ready',ready:true});s.send(s.owner,{type:'start'});assert.equal(s.room.phase,'countdown');s.tick(5001);assert.equal(s.room.phase,'running');assert.ok([...s.room.players.values()].every(p=>p.session.laps.completed===0));
});
test('a departure from a three-driver countdown requires fresh readiness from the remaining two',()=>{
 const s=race(),third=s.engine.connect(()=>{});s.send(third,{type:'request',code:s.room.code,name:'Third',car:'m3',auto:true,paint:'#445566'});s.send(s.owner,{type:'approve',requestId:[...s.room.pending.keys()][0],accept:true});s.send(third,{type:'ready',ready:true});s.start();
 s.send(third,{type:'leave'});assert.equal(s.room.players.size,2);s.tick();assert.equal(s.room.phase,'lobby');assert.ok([...s.room.players.values()].every(p=>!p.ready));
});
test('a retained disconnected driver gets a specific start explanation instead of entering countdown',()=>{
 const s=race(),third=s.engine.connect(()=>{});s.send(third,{type:'request',code:s.room.code,name:'Third',car:'m3',auto:true,paint:'#445566'});s.send(s.owner,{type:'approve',requestId:[...s.room.pending.keys()][0],accept:true});s.engine.disconnect(third);
 s.send(s.owner,{type:'ready',ready:true});s.send(s.guest,{type:'ready',ready:true});s.send(s.owner,{type:'start'});assert.equal(s.room.phase,'lobby');assert.match(s.messages.get(s.owner).filter(m=>m.type==='error').at(-1)?.message,/disconnected.*reconnect.*remove/i);
});
test('reconnecting between countdown ticks cannot erase an interrupted start',()=>{
 const s=race(),token=s.engine.peers.get(s.guest).member.p.token;s.start();s.engine.disconnect(s.guest);const resumed=s.engine.connect(()=>{});s.send(resumed,{type:'resume',token});
 // No physics tick observed the disconnected peer; its interruption still invalidates the grid.
 s.tick(5001);assert.equal(s.room.phase,'lobby');assert.equal(s.room.countdownEndsAt,null);assert.ok([...s.room.players.values()].every(p=>!p.ready));
 s.send(s.owner,{type:'ready',ready:true});s.send(resumed,{type:'ready',ready:true});s.send(s.owner,{type:'start'});assert.equal(s.room.phase,'countdown');s.tick(5001);assert.equal(s.room.phase,'running','fresh readiness clears the interrupted countdown');
});
