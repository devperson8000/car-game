// Real Web Audio decoding/rendering; run against Vite dev (npm run dev).
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.TEST_URL||'http://127.0.0.1:5173'}/credits.html`);
 const rendered=await page.evaluate(async()=>{
  const {SampleEngine}=await import('/src/engine-samples.js');const results=[];
  for(const rpm of [900,2500,4500,8500]){
   const ctx=new OfflineAudioContext(1,48000,48000),engine=await SampleEngine.create(ctx,ctx.destination);
   engine.update({rpm,ctrl:{throttle:.8},tcCut:0,shiftTimer:0},0);const rendered=await ctx.startRendering(),data=rendered.getChannelData(0);let peak=0,energy=0;
   for(const sample of data){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
   results.push({rpm,peak,rms:Math.sqrt(energy/data.length),bands:engine.layers.length});
  }
  return results;
 });
 for(const result of rendered){assert.equal(result.bands,8);assert.ok(result.peak<.98&&result.peak>.03,JSON.stringify(result));assert.ok(result.rms>.015,JSON.stringify(result));}console.log('Rendered V8:',rendered);
 await page.evaluate(async()=>{const {DrivingAudio}=await import('/src/audio.js'),{SPEC}=await import('/src/sim/spec.js');window.audio=new DrivingAudio();await audio.start(SPEC);audio.setActive(true);audio.update({rpm:3000,spec:SPEC,shiftTimer:0,tcCut:0,ctrl:{throttle:.5},speed:10,wheels:[],onTrack:true,scrape:0,gear:2},'day');});
 assert.equal(await page.evaluate(()=>!!audio.sampleEngine),true);
 await page.evaluate(()=>{
  const v={rpm:3000,tcCut:0,ctrl:{throttle:0},speed:20,wheels:Array.from({length:4},()=>({contact:true,slipAngle:0,slipRatio:-1,omega:0,radius:.33,surf:0})),gear:2,scrape:0};
  window.tireFixture=v;audio.update(v,'day');
 });
 await page.waitForFunction(()=>audio.road.gain.gain.value>.01&&audio.scrub.gain.gain.value>.03&&audio.squealGain.gain.value>.005);
 await page.evaluate(()=>{for(const w of tireFixture.wheels)w.contact=false;audio.update(tireFixture,'day');});
 await page.waitForFunction(()=>audio.road.gain.gain.value<.001&&audio.scrub.gain.gain.value<.001&&audio.squealGain.gain.value<.001);
 await page.evaluate(async()=>{const first=audio.sampleEngine;audio.setActive(false);await audio.ctx.suspend();if(audio.ctx.state!=='suspended')throw Error('pause did not suspend');await audio.start({});audio.setActive(true);if(audio.sampleEngine!==first)throw Error('resume duplicated sample engine');audio.muted=true;audio.update({rpm:3000,tcCut:0,ctrl:{throttle:1},speed:0,wheels:[],gear:2,scrape:0},'day');});
 await page.waitForFunction(()=>audio.master.gain.value<.001);await page.evaluate(()=>audio.ctx.close());
 await page.route('**/audio/v8/*.ogg',route=>route.abort());
 const fallback=await page.evaluate(async()=>{const {DrivingAudio}=await import('/src/audio.js'),{SPEC}=await import('/src/sim/spec.js');const a=new DrivingAudio();await a.start(SPEC);const result={ready:a.ready,samples:!!a.sampleEngine,worklet:a.engine instanceof AudioWorkletNode};await a.ctx.close();return result;});
 assert.deepEqual(fallback,{ready:true,samples:false,worklet:true});assert.deepEqual(errors,[]);
 console.log('Audio browser checks passed: eight decoded loops, audible unclipped rendering across RPM, grounded straight-slip sound, airborne silence, mute, pause/resume and missing-sample fallback.');
}finally{await browser.close();}
