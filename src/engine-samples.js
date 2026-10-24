// CryHam's CC BY 4.0 V8 samples: separate engine-sim recordings at 1–8k RPM.
export const ENGINE_BANDS=Array.from({length:8},(_,i)=>({rpm:(i+1)*1000,url:`/audio/v8/${i+1}.ogg`}));
export function engineMix(value){
 const rpm=Math.max(600,Math.min(9500,Number.isFinite(value)?value:900));
 const band=Math.max(0,Math.min(7,rpm/1000-1)),lo=Math.floor(band),hi=Math.min(7,lo+1),blend=band-lo;
 return ENGINE_BANDS.map((sample,i)=>({...sample,rate:rpm/sample.rpm,gain:i===lo?Math.cos(blend*Math.PI/2):i===hi?Math.sin(blend*Math.PI/2):0}));
}
export class SampleEngine{
 static async create(ctx,destination){
  const buffers=await Promise.all(ENGINE_BANDS.map(async({url})=>{
   const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error(`Engine sample unavailable (${response.status})`);
   return ctx.decodeAudioData(await response.arrayBuffer());
  }));
  return new SampleEngine(ctx,destination,buffers);
 }
 constructor(ctx,destination,buffers){
  this.ctx=ctx;this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.5;this.filter.frequency.value=7000;
  this.output=ctx.createGain();this.output.gain.value=.62;this.filter.connect(this.output);this.output.connect(destination);
  const start=ctx.currentTime+.03;
  this.layers=buffers.map(buffer=>{const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.filter);source.start(start);return {source,gain};});
 }
 update(v,cameraMode=0){
  const t=this.ctx.currentTime,throttle=v.shiftTimer>0?0:v.ctrl.throttle*(1-v.tcCut);
  engineMix(v.rpm).forEach((mix,i)=>{const {source,gain}=this.layers[i];source.playbackRate.setTargetAtTime(mix.rate,t,.035);gain.gain.setTargetAtTime(mix.gain,t,.035);});
  // Lift-off softens the exhaust, while a loaded engine opens up. The cabin
  // naturally attenuates upper frequencies rather than changing engine pitch.
  this.filter.frequency.setTargetAtTime((cameraMode===1?1900:3600)+throttle*(cameraMode===1?2200:5400),t,.07);
  this.output.gain.setTargetAtTime(.32+throttle*.38,t,.045);
 }
}
