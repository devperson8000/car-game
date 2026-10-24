import {test} from 'node:test';import assert from 'node:assert/strict';
import {readGamepadInput} from '../src/input.js';
test('gamepad mapping preserves partial trigger and steering values',()=>{
 const buttons=Array.from({length:16},()=>({pressed:false,value:0}));buttons[7].value=.25;buttons[6].value=.75;buttons[0]={pressed:true,value:1};
 const input=readGamepadInput({connected:true,axes:[.54,0,0,0],buttons});
 assert.ok(Math.abs(input.steer-.5)<1e-10);assert.equal(input.throttle,.25);assert.equal(input.brake,.75);assert.equal(input.handbrake,true);
});
test('a disconnected gamepad clears held controls',()=>{
 assert.deepEqual(readGamepadInput(null),{steer:0,throttle:0,brake:0,handbrake:false});
});

import {normalizeKey} from '../src/input.js';
test('WASD and arrows work for both native code events and key-only input',()=>{
 for(const [key,code] of [['w','KeyW'],['s','KeyS'],['a','KeyA'],['d','KeyD'],['ArrowUp','ArrowUp'],['ArrowDown','ArrowDown'],['ArrowLeft','ArrowLeft'],['ArrowRight','ArrowRight']]){
  assert.equal(normalizeKey({key}),code);assert.equal(normalizeKey({code}),code);
 }
 assert.equal(normalizeKey({key:'W'}),'KeyW');assert.equal(normalizeKey({keyCode:38}),'ArrowUp');assert.equal(normalizeKey({key:'Unidentified'}),null);
});

import {Controls} from '../src/input.js';
test('keyboard driving wins over a connected controller with held pedals',t=>{
 const previous=new Map(['document','addEventListener','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const events=new EventTarget(),buttons=Array.from({length:16},()=>({pressed:false,value:0}));buttons[6].value=1;
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelectorAll:()=>[]}});
 Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:events.addEventListener.bind(events)});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[{connected:true,axes:[.5,0],buttons}]}});
 t.after(()=>{for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const controls=new Controls(()=>{}),event=new Event('keydown',{cancelable:true});Object.defineProperties(event,{key:{value:'w'},code:{value:'KeyW'}});events.dispatchEvent(event);
 const input=controls.sample(.1,{speed:0});assert.ok(input.throttle>0);assert.equal(input.brake,0);assert.equal(input.steer,0);
});
test('an idle frame never poisons later keyboard steering or pedals',t=>{
 const previous=new Map(['document','addEventListener','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const events=new EventTarget();
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelectorAll:()=>[]}});Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:events.addEventListener.bind(events)});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[]}});
 t.after(()=>{for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const controls=new Controls(()=>{});assert.deepEqual(controls.sample(.1,{speed:0}),{steer:0,throttle:0,brake:0,handbrake:false});
 const press=key=>{const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value:key});events.dispatchEvent(event);};
 press('w');press('a');let input=controls.sample(.1,{speed:0});assert.ok(input.throttle>0);assert.ok(input.steer<0);assert.equal(input.brake,0);
 controls.clear();press('ArrowUp');press('ArrowRight');input=controls.sample(.1,{speed:0});assert.ok(input.throttle>0);assert.ok(input.steer>0);
 controls.clear();press('ArrowDown');assert.ok(controls.sample(.1,{speed:0}).brake>0);
});
test('held-key auto-repeat does not dispatch another start or resume action',t=>{
 const previous=new Map(['document','addEventListener'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const events=new EventTarget();
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelectorAll:()=>[]}});Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:events.addEventListener.bind(events)});
 t.after(()=>{for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const actions=[];new Controls(code=>actions.push(code));
 for(const repeat of [false,true,true]){const event=new Event('keydown',{cancelable:true});Object.defineProperties(event,{key:{value:'w'},repeat:{value:repeat}});events.dispatchEvent(event);}
 assert.deepEqual(actions,['KeyW']);
});
