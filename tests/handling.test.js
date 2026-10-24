import {test} from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {Vehicle,DT,setWeatherGrip} from '../src/vendor/physics.js';import {SPEC} from '../src/sim/spec.js';
// Infinite flat test surface isolates tire/driver-assist behavior from route geometry.
const track={poseAt:()=>({x:0,y:0,z:0,tx:0,ty:0,tz:-1}),query:(x,z,o={})=>Object.assign(o,{y:0,nx:0,ny:1,nz:0,surf:0,d:0,s:-z,rx:1,rz:0}),total:1e6};
function poweredCorner(tc=true,steer=.3){const v=new Vehicle(track,SPEC);v.reset();v.tc=tc;for(let i=0;i<480;i++)v.step(DT);v.vel.set(0,0,-20);for(const w of v.wheels)w.omega=20/w.radius;let maxSlip=0;const f=new Vector3(),r=new Vector3();for(let i=0;i<720;i++){v.ctrl={steer,throttle:1,brake:0,handbrake:false};v.step(DT);f.set(0,0,-1).applyQuaternion(v.quat);r.set(1,0,0).applyQuaternion(v.quat);maxSlip=Math.max(maxSlip,Math.abs(Math.atan2(v.vel.dot(r),Math.abs(v.vel.dot(f)))));}return {v,maxSlip};}
test('traction control keeps a powered 72 km/h corner within recoverable sideslip',()=>{const {v,maxSlip}=poweredCorner();assert.ok(maxSlip<12*Math.PI/180,`body sideslip ${(maxSlip*180/Math.PI).toFixed(1)} deg`);assert.ok(v.speedKmh>45);});
test('disabling traction control still allows deliberate power oversteer',()=>{const on=poweredCorner(),off=poweredCorner(false);assert.ok(off.maxSlip>on.maxSlip+.1);});

test('a stronger keyboard turn remains recoverable with traction control',()=>{const {maxSlip}=poweredCorner(true,.6);assert.ok(maxSlip<12*Math.PI/180,`body sideslip ${maxSlip*180/Math.PI}`);});

test('wet tarmac and grass retain longer braking distances than dry tarmac',()=>{
 function brakingDistance(weather,surface){setWeatherGrip(weather);const testTrack={...track,query:(x,z,o={})=>({...track.query(x,z,o),surf:surface})},v=new Vehicle(testTrack,SPEC);v.reset();for(let i=0;i<480;i++)v.step(DT);v.vel.set(0,0,-20);for(const w of v.wheels)w.omega=20/w.radius;const start=v.pos.clone();for(let i=0;i<480;i++){v.ctrl={steer:0,throttle:0,brake:.8,handbrake:false};v.step(DT);}return v.pos.distanceTo(start);}
 try{const dry=brakingDistance(1,0),wet=brakingDistance(.7,0),grass=brakingDistance(1,2);assert.ok(wet>dry+2,`${dry} dry, ${wet} wet`);assert.ok(grass>dry+4,`${dry} dry, ${grass} grass`);}finally{setWeatherGrip(1);}
});
