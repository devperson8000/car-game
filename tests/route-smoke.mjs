// Conservative autonomous driver used only for full-route physics validation.
// This is not a gameplay autopilot or a hardware rendering benchmark.
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Session} from '../src/sim/session.js';
const session=new Session('mountain'),v=session.vehicle,track=session.track;
const forward=new Vector3();let maxLateral=0,offroad=0,rollovers=0,seconds=0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
for(let frame=0;frame<60*700;frame++){
  const pose=track.poseAt(v.trackS+7+Math.abs(v.speed)*.55);
  forward.set(0,0,-1).applyQuaternion(v.quat);
  const dx=pose.x-v.pos.x,dz=pose.z-v.pos.z,d=Math.hypot(dx,dz)||1;
  const sinAngle=clamp((forward.x*dz-forward.z*dx)/d,-1,1);
  const steer=clamp(Math.atan2(2*2.46*sinAngle,d)/v.maxSteerAngle(),-1,1);
  const error=15-v.speed;
  session.advance(1/60,{steer,throttle:clamp(error*.35,0,1),brake:clamp(-error*.35,0,1)});
  maxLateral=Math.max(maxLateral,Math.abs(v.trackD));
  if(!v.onTrack)offroad++;
  if(v.rollover){rollovers++;break;}
  seconds=(frame+1)/60;
  if(v.distAccum>track.total+20)break;
}
assert.ok(v.distAccum>track.total,'must complete the entire route');
assert.equal(rollovers,0);assert.equal(offroad,0);assert.ok(Number.isFinite(v.pos.x));
console.log(JSON.stringify({routeMeters:track.total,distanceMeters:v.distAccum,simulationSeconds:seconds,maxLateralMeters:maxLateral,offroadFrames:offroad,rollovers}));
