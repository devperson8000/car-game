// Responsive synthesised V8-style engine, tyres and airflow.
// No third-party audio recording is redistributed.
export class EngineAudio{
 constructor(){this.context=null;this.volume=.65;this.nodes=[];this.initialized=false;this.muted=false;}
 async start(){
  if(!this.context){
   const ctx=new (window.AudioContext||window.webkitAudioContext)();this.context=ctx;
   const master=ctx.createGain();master.gain.value=.23*this.volume;
   const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-21;compressor.knee.value=14;compressor.ratio.value=3.5;compressor.attack.value=.008;compressor.release.value=.2;
   master.connect(compressor);compressor.connect(ctx.destination);this.master=master;
   const engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=700;engineFilter.Q.value=.78;engineFilter.connect(master);this.engineFilter=engineFilter;
   const sub=ctx.createOscillator();sub.type='sawtooth';const subGain=ctx.createGain();subGain.gain.value=.22;sub.connect(subGain);subGain.connect(engineFilter);sub.start();
   const growl=ctx.createOscillator();growl.type='triangle';const growlGain=ctx.createGain();growlGain.gain.value=.35;growl.connect(growlGain);growlGain.connect(engineFilter);growl.start();
   const harmonics=ctx.createOscillator();harmonics.type='sawtooth';const harmonicGain=ctx.createGain();harmonicGain.gain.value=.07;harmonics.connect(harmonicGain);harmonicGain.connect(engineFilter);harmonics.start();
   this.sub=sub;this.growl=growl;this.harmonics=harmonics;this.subGain=subGain;this.growlGain=growlGain;this.harmonicGain=harmonicGain;
   const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),channel=buf.getChannelData(0);
   let last=0;for(let i=0;i<channel.length;i++){const white=Math.random()*2-1;last=(last+.04*white)/1.04;channel[i]=white*.56+last*.7;}
   const noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;
   const noiseFilter=ctx.createBiquadFilter();noiseFilter.type='bandpass';noiseFilter.Q.value=.7;noiseFilter.frequency.value=480;
   const noiseGain=ctx.createGain();noiseGain.gain.value=0;
   noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(master);noise.start();
   this.noiseFilter=noiseFilter;this.noiseGain=noiseGain;this.initialized=true;
  }
  if(this.context.state!=='running')await this.context.resume();
 }
 update(physics,weather,paused=false){
  if(!this.context||!this.initialized)return;
  const t=this.context.currentTime, rpm=Math.max(840,physics.rpm),v=Math.abs(physics.speed);
  const firing=rpm/60*4;
  const set=(param,value,time=.085)=>param.setTargetAtTime(value,t,time);
  set(this.sub.frequency,Math.max(30,firing*.5));set(this.growl.frequency,firing);set(this.harmonics.frequency,firing*2);
  set(this.engineFilter.frequency,Math.min(2900,330+rpm*.22+physics.throttle*680));
  set(this.subGain.gain,.18+physics.throttle*.1);
  set(this.growlGain.gain,.14+physics.throttle*.27);
  set(this.harmonicGain.gain,.025+physics.throttle*.14);
  const noise=clamp(v/85,0,1)*.19+physics.slip*.35+(weather==='rain'?.028:0);
  set(this.noiseGain.gain,noise);
  set(this.noiseFilter.frequency,Math.min(2800,300+v*25+physics.slip*950));
  set(this.master.gain,(paused?.09:1)*this.volume*.22,.16);
 }
 setVolume(volume){this.volume=Math.max(0,Math.min(1,volume));if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume*.22,this.context.currentTime,.09);}
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
