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
