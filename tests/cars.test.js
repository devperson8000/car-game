import {test} from 'node:test';import assert from 'node:assert/strict';
test('car choices have separate models, physics and engine timbres',async()=>{
 const {CARS,getCar}=await import('../src/sim/cars.js');assert.equal(CARS.length,3);assert.equal(getCar('missing').id,'apex');
 const brz=getCar('brz'),bmw=getCar('m3');assert.notEqual(brz.model,bmw.model);assert.ok(brz.spec.mass<bmw.spec.mass);assert.ok(Math.max(...brz.spec.engine.nm)<Math.max(...bmw.spec.engine.nm));assert.notEqual(brz.spec.audioBank,bmw.spec.audioBank);assert.notEqual(brz.spec.wheels,bmw.spec.wheels);
});

import {Session} from '../src/sim/session.js';
test('each selectable car settles on its tires and drives using its own torque curve',()=>{
 for(const id of ['apex','brz','m3']){const s=new Session('mountain',id);for(let i=0;i<180;i++)s.advance(1/60,{});assert.ok(s.vehicle.wheels.filter(w=>w.contact).length>=3,id);for(let i=0;i<240;i++)s.advance(1/60,{throttle:.8});assert.ok(s.vehicle.speedKmh>25,`${id}: ${s.vehicle.speedKmh}`);assert.ok(Number.isFinite(s.vehicle.pos.y));assert.equal(s.car.id,id);}
});

import fs from 'node:fs';
test('new car physical axles and cockpit match normalized model metadata',async()=>{
 const {getCar}=await import('../src/sim/cars.js');
 for(const id of ['brz','m3']){const car=getCar(id),geometry=JSON.parse(fs.readFileSync(`public/models/${id}-dimensions.json`)),w=car.spec.wheels;
 assert.equal(w.fz,geometry.wheelHubs[0][2]);assert.equal(w.rz,geometry.wheelHubs[2][2]);assert.equal(w.htF,geometry.frontTrack/2);assert.equal(w.htR,geometry.rearTrack/2);assert.equal(w.radius,geometry.wheelRadius);assert.deepEqual(car.cockpitEye,geometry.cockpitEye);
 const bytes=fs.readFileSync(`public/models/${id}.glb`),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));for(const n of ['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR'])assert.ok(json.nodes.some(x=>x.name===n),`${id} ${n}`);assert.ok((json.images||[]).every(x=>x.bufferView!==undefined),`${id} textures must be embedded`);
 }
});
