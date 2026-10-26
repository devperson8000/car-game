import test from 'node:test';import assert from 'node:assert/strict';import {RoomEngine} from '../server/engine.js';import {Session} from '../src/sim/session.js';import {LocalPrediction} from '../src/multiplayer/local-prediction.js';import {PresentationPose} from '../src/multiplayer/presentation.js';
test('prediction stays aligned through 160–320 ms round trips and bursty ordered delivery',()=>{
 let now=1000,upDue=0,downDue=0,envelope=0,deliveries=0;const inbound=[],outbound=[],corrections=[];
 const local=new Session('mountain'),prediction=new LocalPrediction(local,{sample:()=>({steer:0,throttle:.45,brake:0,handbrake:false}),auto:()=>true,assists:()=>({tc:true,abs:true})}),presentation=new PresentationPose();
 const engine=new RoomEngine({now:()=>now}),peer=engine.connect(m=>{if(m.type==='snapshot'){const delay=[80,120,90,160,100][deliveries++%5];downDue=Math.max(downDue+1,now+delay);inbound.push({at:downDue,m});}});
 engine.message(peer,{type:'protocol',version:2});engine.message(peer,{type:'create',name:'Latency test',lobbyName:'Jitter',mode:'free',route:'mountain',weather:'day',laps:1,car:'apex',auto:true,paint:'#112233'});
 for(let tick=0;tick<600;tick++){
  now=1000+tick*1000/60;
  while(inbound[0]?.at<=now){const {m}=inbound.shift(),result=prediction.reconcile(m.self.simulation,m.self.ack,now);if(result){if(tick>120)corrections.push(result.before.position.distanceTo(result.after.position));presentation.update(result.before,0);const displayedBefore=presentation.position.clone();presentation.correct(result.before,result.after,{snap:result.first});presentation.update(result.after,0);if(!result.first)assert.ok(presentation.position.distanceTo(displayedBefore)<1e-6,'server reconciliation must preserve displayed position');}}
  prediction.advance(now,prediction.ready);
  if(tick%3===0&&prediction.ready){const frames=prediction.batch(),delay=[80,150,90,160][envelope%4];upDue=Math.max(upDue+1,now+delay);outbound.push({at:upDue,m:{type:'input',seq:envelope++,parked:false,auto:true,controls:prediction.lastControls,epoch:prediction.epoch,frames}});prediction.markSent(frames);}
  while(outbound[0]?.at<=now)engine.message(peer,outbound.shift().m);
  engine.tick(1/60);if(tick%3===0)engine.snapshots();presentation.update(prediction.pose(now),1/60);
 }
 assert.ok(corrections.length>100);assert.ok(Math.max(...corrections)<.001,`largest correction ${Math.max(...corrections)}m`);assert.ok(local.vehicle.speedKmh>30);assert.ok(prediction.pending.length<40);assert.ok(!prediction.blocked);
});
