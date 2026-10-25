import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session, LapTimer } from '../src/sim/session.js';

test('a parked sports car settles without creeping or nonfinite state', () => {
  const s = new Session(); const p = s.vehicle.pos.clone();
  for (let i=0;i<600;i++) s.advance(1/60, {});
  assert.ok(s.vehicle.pos.distanceTo(p) < 1);
  assert.ok(s.vehicle.speedKmh < 1);
  assert.ok(Number.isFinite(s.vehicle.rpm));
});
test('throttle accelerates and braking dissipates speed', () => {
  const s = new Session();
  for(let i=0;i<360;i++) s.advance(1/60,{throttle:1});
  assert.ok(s.vehicle.speedKmh > 70, `launch: ${s.vehicle.speedKmh}`);
  const fast=s.vehicle.speedKmh;
  for(let i=0;i<180;i++) s.advance(1/60,{brake:1});
  assert.ok(s.vehicle.speedKmh < fast * .6);
});
test('steering changes heading and guardrails keep the car in the corridor', () => {
  const s=new Session();
  for(let i=0;i<150;i++) s.advance(1/60,{throttle:.5});
  const q=s.vehicle.quat.clone();
  for(let i=0;i<90;i++) s.advance(1/60,{throttle:.3,steer:.7});
  assert.ok(q.angleTo(s.vehicle.quat)>.05);
  assert.ok(Math.abs(s.vehicle.trackD)<10);
});
test('pause ignores input and long frame times cannot fast-forward the car', () => {
  const s=new Session();s.paused=true; const p=s.vehicle.pos.clone();
  s.advance(10,{throttle:1});assert.equal(s.vehicle.pos.distanceTo(p),0);
  assert.equal(s.elapsed,0);s.paused=false;s.advance(10,{throttle:1});
  assert.ok(s.elapsed<=.101);
});
test('reset clears speed and invalidates lap progress',()=>{
  const s=new Session();for(let i=0;i<60;i++)s.advance(1/60,{throttle:1});
  s.reset();assert.equal(s.vehicle.vel.length(),0);assert.equal(s.laps.completed,0);
});
test('only a complete forward circuit counts as a lap',()=>{
  const t=new LapTimer(1000,0);
  t.update(990,1);t.update(10,1);assert.equal(t.completed,0);
  t.reset(0);for(let s=10;s<=1000;s+=10)t.update(s%1000,.5);
  assert.equal(t.completed,1);assert.equal(t.last,50);
});
test('reverse start-line crossings and resets cannot set best lap',()=>{
  const t=new LapTimer(1000,10);t.update(990,1);t.update(10,1);
  assert.equal(t.completed,0);assert.equal(t.best,null);
  t.reset(500);t.update(0,1);assert.equal(t.completed,0);
});

test('manual holds the selected gear instead of automatically upshifting',()=>{
 const s=new Session();s.vehicle.auto=false;for(let i=0;i<360;i++)s.advance(1/60,{throttle:1});assert.equal(s.vehicle.gear,1);
 s.vehicle.shiftUp();assert.equal(s.vehicle.gear,2);for(let i=0;i<60;i++)s.advance(1/60,{});s.vehicle.shiftDown();assert.equal(s.vehicle.gear,1);
});
