import test from 'node:test';
import assert from 'node:assert/strict';
import * as audio from '../src/audio.js';
const car=(overrides={})=>({speed:20,onTrack:true,wheels:Array.from({length:4},()=>({contact:true,slipAngle:0,slipRatio:0,omega:60,radius:.33,surf:0})),...overrides});

test('airborne tires have no road rumble or tire squeal',()=>{
 const v=car();for(const w of v.wheels){w.contact=false;w.slipAngle=.4;w.slipRatio=1;}
 const mix=audio.tireSoundState(v);
 assert.equal(mix.road,0);assert.equal(mix.scrub,0);assert.equal(mix.squeal,0);
});
test('straight wheelspin and locked braking are audible without lateral slip',()=>{
 const rolling=audio.tireSoundState(car());
 for(const slip of [-1,1]){
  const v=car();for(const w of v.wheels)w.slipRatio=slip;
  const mix=audio.tireSoundState(v);assert.ok(mix.scrub>rolling.scrub);assert.ok(mix.squeal>rolling.squeal);
 }
 const burnout=car({speed:0});for(const w of burnout.wheels)w.slipRatio=2;
 assert.ok(audio.tireSoundState(burnout).squeal>0,'spinning tires remain audible near standstill');
});
test('contact surfaces and grounded tire count control road noise independently of body center',()=>{
 const road=car(),grass=car();for(const w of grass.wheels)w.surf=2;
 assert.ok(audio.tireSoundState(grass).road>audio.tireSoundState(road).road);
 road.wheels[0].contact=false;road.wheels[1].contact=false;
 assert.ok(audio.tireSoundState(road).road<audio.tireSoundState(car()).road);
});
