import {test} from 'node:test';import assert from 'node:assert/strict';
import {Session} from '../src/sim/session.js';import {createMountainRoute} from '../src/sim/routes.js';
function launch(throttle){const s=new Session('mountain');for(let i=0;i<120;i++)s.advance(1/60,{throttle});return s;}
test('analog throttle retains intermediate values and changes acceleration',()=>{
 const low=launch(.15),high=launch(.7);assert.ok(high.vehicle.speedKmh>low.vehicle.speedKmh+5);assert.equal(low.vehicle.ctrl.throttle,.15);
});
test('releasing handbrake removes brake input completely',()=>{
 const s=launch(.4);s.advance(.05,{handbrake:true});s.advance(.05,{handbrake:false});assert.equal(s.vehicle.ctrl.handbrake,false);
});
test('mountain circuit is closed, evenly sampled, and has drivable grades',()=>{
 const r=createMountainRoute();assert.ok(r.points.length>500);assert.ok(r.total>3000);
 let grade=0;for(let i=0;i<r.points.length;i++){const p=r.points[i],q=r.points[(i+1)%r.points.length];const d=Math.hypot(q[0]-p[0],q[2]-p[2]);assert.ok(d<6);grade=Math.max(grade,Math.abs(q[1]-p[1])/d);}
 assert.ok(grade<.18,`max grade ${grade}`);
});
test('mountain vehicle contacts match the road and barriers contain lateral impacts',()=>{
 const s=new Session('mountain');for(let i=0;i<120;i++)s.advance(1/60,{});
 assert.ok(s.vehicle.wheels.filter(w=>w.contact).length>=3);
 const p=s.track.poseAt(s.vehicle.trackS),q=s.track.query(p.x,p.z,{},p.y);
 s.vehicle.pos.x+=q.rx*7;s.vehicle.pos.z+=q.rz*7;s.vehicle.vel.set(q.rx*15,0,q.rz*15);
 for(let i=0;i<60;i++)s.advance(1/60,{});
 assert.ok(Math.abs(s.vehicle.trackD)<9);
});
test('nonfinite or out-of-range device controls never poison physics',()=>{
 const s=new Session('mountain');s.advance(.05,{throttle:NaN,brake:Infinity,steer:12});
 assert.ok(Number.isFinite(s.vehicle.pos.x));assert.equal(s.vehicle.ctrl.throttle,0);assert.equal(s.vehicle.ctrl.brake,0);assert.equal(s.vehicle.ctrl.steer,1);
});
test('holding brake at rest selects reverse and throttle restores forward drive',()=>{
 const s=new Session('mountain');for(let i=0;i<90;i++)s.advance(1/60,{brake:1});
 assert.equal(s.vehicle.gear,-1);assert.ok(s.vehicle.speed<0);
 for(let i=0;i<240;i++)s.advance(1/60,{throttle:.5});assert.ok(s.vehicle.gear>=1);
});

test('reverse travel before a timed lap cannot award a short lap',async()=>{
 const {LapTimer}=await import('../src/sim/session.js');const t=new LapTimer(1000,180);
 for(let s=170;s>=80;s-=10)t.update(s,1);
 for(let s=90;s<=1080;s+=10)t.update(s%1000,1);
 assert.equal(t.completed,0);assert.equal(t.best,null);
});
test('recovering mid-circuit starts timing at the real finish line',async()=>{
 const {LapTimer}=await import('../src/sim/session.js');const t=new LapTimer(1000,500);
 for(let s=510;s<=1000;s+=10)t.update(s%1000,1);
 assert.equal(t.completed,0);assert.equal(t.current,0);
 for(let s=10;s<=1000;s+=10)t.update(s%1000,1);
 assert.equal(t.completed,1);assert.equal(t.last,100);
});
