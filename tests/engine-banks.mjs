// Real browser decoding/rendering for the added engine-sim banks. Requires Vite.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.TEST_URL||'http://127.0.0.1:5173'}/credits.html`);
 const rendered=await page.evaluate(async()=>{
  const {SampleEngine}=await import('/src/engine-samples.js'),results=[];
  for(const bank of ['boxer4','race-v8'])for(const rpm of [900,3500,7800])for(const throttle of [0,1]){
   const ctx=new OfflineAudioContext(1,48000,48000),engine=await SampleEngine.create(ctx,ctx.destination,bank);
   engine.update({rpm,ctrl:{throttle},tcCut:0,shiftTimer:0},0);
   const buffer=await ctx.startRendering(),data=buffer.getChannelData(0);
   let peak=0,energy=0;for(const sample of data){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
   results.push({bank,selectedBank:engine.bank,rpm,throttle,bands:engine.layers.length,peak,rms:Math.sqrt(energy/data.length),cutoff:engine.filter.frequency.value});
  }
  return results;
 });
 for(const result of rendered){assert.equal(result.selectedBank,result.bank);assert.equal(result.bands,8);assert.ok(result.peak>.03&&result.peak<.98,JSON.stringify(result));assert.ok(result.rms>.015,JSON.stringify(result));assert.equal(result.cutoff,result.throttle?9000:3600);}
 const boxer=rendered.find(r=>r.bank==='boxer4'&&r.rpm===3500&&r.throttle===1),race=rendered.find(r=>r.bank==='race-v8'&&r.rpm===3500&&r.throttle===1);
 assert.ok(Math.abs(boxer.rms-race.rms)>.005,'Distinct banks must produce different rendered audio');
 for(const bank of ['boxer4','race-v8']){
  const selected=await page.evaluate(async bank=>{
   const {DrivingAudio}=await import('/src/audio.js'),{SPEC}=await import('/src/sim/spec.js'),audio=new DrivingAudio();
   await audio.start({...SPEC,audioBank:bank});const result=audio.sampleEngine?.bank;await audio.ctx.close();return result;
  },bank);
  assert.equal(selected,bank);
 }
 await page.route('**/audio/boxer4/*.ogg',route=>route.abort());
 const fallback=await page.evaluate(async()=>{
  const {DrivingAudio}=await import('/src/audio.js'),{SPEC}=await import('/src/sim/spec.js'),audio=new DrivingAudio();
  await audio.start({...SPEC,audioBank:'boxer4'});const result={ready:audio.ready,samples:!!audio.sampleEngine,worklet:audio.engine instanceof AudioWorkletNode};await audio.ctx.close();return result;
 });
 assert.deepEqual(fallback,{ready:true,samples:false,worklet:true});assert.deepEqual(errors,[]);
 console.log('Additional engine banks decoded and rendered:',rendered);
}finally{await browser.close();}
