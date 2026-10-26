import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RemoteClock,RemoteTimeline} from '../src/multiplayer/remote-timeline.js';
import {CarView,loadCarPrefab,cloneCarPrefab} from '../src/vehicle.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function vehicle(){return {pos:new THREE.Vector3(),quat:new THREE.Quaternion(),vel:new THREE.Vector3(),ctrl:{},wheels:Array.from({length:4},()=>({x:1,z:2,attachY:.2,restLen:.3,worldPos:new THREE.Vector3()}))};}
function state(x,{spinAngle=0,omega=0,steer=0,comp=0}={}){return {pos:[x,2,3],quat:[0,0,0,1],vel:[10,0,0],angVel:[0,0,0],speed:10,rpm:2000,gear:2,ctrl:{brake:.5},wheels:Array.from({length:4},()=>({spinAngle,omega,steer,comp,contact:true}))};}

test('adaptive injected arrival/render clock stays monotonic across jitter and packet gaps',()=>{
 const clock=new RemoteClock();let arrival=0,server=1000,last=-Infinity;
 for(const interval of [50,50,50,200,1,1,48,50,400,1,1,50]){
  arrival+=interval;server+=50;clock.observe(server,arrival);
  assert.ok(clock.delay>=100&&clock.delay<=220);
  for(let n=0;n<4;n++){const target=clock.time(arrival+n*5);assert.ok(target>=last);last=target;}
 }
 assert.ok(clock.delay>100);assert.equal(clock.observe(server-1,arrival+10),false);
});
test('linear buffered pose and wheel state derive compact wheel centers and slerp orientation',()=>{
 const timeline=new RemoteTimeline(),v=vehicle(),a=state(0),b=state(1,{steer:.4,comp:.1});b.quat=[0,1,0,0];
 timeline.push(0,a);timeline.push(100,b);timeline.sample(50,v);
 near(v.pos.x,.5);near(v.quat.y,Math.SQRT1_2);near(v.wheels[0].steer,.2);near(v.wheels[0].comp,.05);
 const expected=new THREE.Vector3(1,-.05,2).applyQuaternion(v.quat).add(v.pos);near(v.wheels[0].worldPos.distanceTo(expected),0);
});
test('short extrapolation decays into a bounded hold and never rewinds render time',()=>{
 const timeline=new RemoteTimeline(),v=vehicle();timeline.push(100,state(1));
 timeline.sample(150,v);const first=v.pos.x;timeline.sample(1000,v);const held=v.pos.x;
 assert.ok(held>first&&held<1.8);timeline.sample(5000,v);near(v.pos.x,held);
 timeline.sample(125,v);near(v.pos.x,held);
});
test('epoch reset snaps immediately, rejects old epochs and out of order packets',()=>{
 const timeline=new RemoteTimeline(),v=vehicle();timeline.push(100,state(1),0);timeline.sample(200,v);
 assert.equal(timeline.push(90,state(-10),0),false);
 timeline.push(300,state(100),1);timeline.sample(200,v);near(v.pos.x,100);
 assert.equal(timeline.push(400,state(-1),0),false);timeline.sample(200,v);near(v.pos.x,100);
});
test('wheel phase unwrap uses omega, including more than one revolution per packet',()=>{
 const timeline=new RemoteTimeline(),v=vehicle();timeline.push(0,state(0,{spinAngle:6.2,omega:80}));
 const end=6.2+8;timeline.push(100,state(1,{spinAngle:end%(Math.PI*2),omega:80}));timeline.sample(50,v);near(v.wheels[0].spinAngle,10.2);
});
test('one shared prefab load has private paint materials and shared geometry/textures',async()=>{
 const source=new THREE.Group(),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture}),geometry=new THREE.BoxGeometry();
 source.add(new THREE.Mesh(geometry,material));let loads=0;const load=async()=>{loads++;return {scene:source};};
 const [a,b]=await Promise.all([loadCarPrefab('test://shared-car',load),loadCarPrefab('test://shared-car',load)]);assert.equal(loads,1);assert.equal(a,b);
 const first=cloneCarPrefab(a.scene),second=cloneCarPrefab(b.scene),m1=first.model.children[0],m2=second.model.children[0];
 assert.equal(m1.geometry,m2.geometry);assert.equal(m1.material.map,m2.material.map);assert.notEqual(m1.material,m2.material);
 m1.material.color.set('red');assert.notEqual(m1.material.color.getHex(),m2.material.color.getHex());
 let geometryDisposed=false,textureDisposed=false,materialDisposed=false;
 geometry.addEventListener('dispose',()=>geometryDisposed=true);texture.addEventListener('dispose',()=>textureDisposed=true);m1.material.addEventListener('dispose',()=>materialDisposed=true);
 const car=new CarView();car.privateMaterials=first.materials;car.group.add(first.model);car.dispose();assert.equal(materialDisposed,true);assert.equal(geometryDisposed,false);assert.equal(textureDisposed,false);
});
test('presentation pose moves chassis while preserving physical wheel local coordinates',()=>{
 const car=new CarView(),v=vehicle();car.wheels=v.wheels.map(()=>({steer:new THREE.Group(),spin:new THREE.Group()}));
 v.pos.set(10,2,3);v.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),.5);
 for(const w of v.wheels){w.steer=0;w.spinAngle=0;w.worldPos.set(1,-.1,2).applyQuaternion(v.quat).add(v.pos);}
 const position=new THREE.Vector3(11,2,3),quaternion=new THREE.Quaternion();car.update(v,{position,quaternion});
 near(car.group.position.distanceTo(position),0);near(car.wheels[0].steer.position.distanceTo(new THREE.Vector3(1,-.1,2)),0);assert.equal(car.group.quaternion.angleTo(quaternion),0);
});
test('late gap recovery preserves pose and wheel phase at the same render time then catches up',()=>{
 const timeline=new RemoteTimeline(),v=vehicle();
 const packet=(x,spinAngle)=>{const s=state(x,{spinAngle,omega:30});s.vel=[30,0,0];return s;};
 timeline.push(0,packet(0,0));timeline.push(100,packet(3,3));timeline.sample(250,v);
 const held=v.pos.clone(),phase=v.wheels[0].spinAngle;
 timeline.push(300,packet(9,9));timeline.sample(250,v);
 near(v.pos.distanceTo(held),0);near(v.wheels[0].spinAngle,phase);
 timeline.sample(266,v);assert.ok(v.pos.x>held.x);assert.ok(v.pos.x-held.x<1);
 const correction=7.98-v.pos.x;assert.ok(correction>0&&correction<2.4681);
 // Keep receiving ordinary samples; correction decays without resetting each packet.
 for(let time=300;time<=1200;time+=50){timeline.push(time+100,packet((time+100)*.03,(time+100)*.03));timeline.sample(time,v);}
 assert.ok(Math.abs(v.pos.x-36)<.01);assert.ok(Math.abs(v.wheels[0].spinAngle-36)<.01);
 timeline.push(1400,packet(100,0),1);timeline.sample(1300,v);near(v.pos.x,100);near(v.wheels[0].spinAngle,0);
});
test('gap recovery also holds orientation, steering and suspension until render time advances',()=>{
 const timeline=new RemoteTimeline(),v=vehicle();timeline.push(0,state(0));timeline.push(100,state(1));timeline.sample(250,v);
 const orientation=v.quat.clone(),wheel=v.wheels[0].worldPos.clone();
 const incoming=state(3,{steer:.4,comp:.1});incoming.quat=[0,1,0,0];timeline.push(300,incoming);timeline.sample(250,v);
 near(v.quat.angleTo(orientation),0);near(v.wheels[0].steer,0);near(v.wheels[0].comp,0);near(v.wheels[0].worldPos.distanceTo(wheel),0);
 timeline.sample(266,v);assert.ok(v.quat.angleTo(orientation)>0);assert.ok(v.wheels[0].steer>0);assert.ok(v.wheels[0].comp>0);
});
