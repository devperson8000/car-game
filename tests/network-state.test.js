import {test} from 'node:test';import assert from 'node:assert/strict';import {Session} from '../src/sim/session.js';
test('authoritative state updates preserve vector objects and reject poisoned transforms',async()=>{
 const {applyVehicleState}=await import('../src/multiplayer/state.js');const v=new Session('mountain').vehicle,position=v.pos;
 const state={pos:[3,4,5],quat:[0,0,0,1],vel:[0,0,-10],angVel:[0,0,0],speed:10,rpm:2000,gear:2,auto:true,ctrl:{steer:.2,throttle:0,brake:.6,handbrake:false},wheels:v.wheels.map(w=>({worldPos:[w.x,3,w.z],spinAngle:1,steer:0,omega:20,contact:true}))};
 assert.equal(applyVehicleState(v,state),true);assert.equal(v.pos,position);assert.deepEqual(v.pos.toArray(),[3,4,5]);assert.equal(v.gear,2);assert.equal(v.ctrl.brake,.6);assert.equal(applyVehicleState(v,{...state,pos:[NaN,0,0]}),false);assert.deepEqual(v.pos.toArray(),[3,4,5]);
});
