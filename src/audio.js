import {SampleEngine} from './engine-samples.js';
// Engine worklet adapted by bwchoi from Antonio-R1's MIT waveguide model.
// Each car selects a CC BY 4.0 multi-RPM engine-sim sample bank.
// Tire/road/wind/shift/impact layers and the fallback engine are synthesized.
export class DrivingAudio{
  constructor(){this.ctx=null;this.muted=false;this.active=false;this.ready=false;this.lastGear=null;this.lastScrape=0;}
  async start(spec){
    if(this.ready){await this.ctx.resume();return;}
    if(this.initializing)return this.initializing;
    this.initializing=this.initialize(spec);
    try{await this.initializing;}catch(e){await this.ctx?.close();this.ctx=null;throw e;}finally{this.initializing=null;}
  }
  async initialize(spec){
    const ctx=this.ctx=new AudioContext();
    this.master=ctx.createGain();this.master.gain.value=0;
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=8;
    this.master.connect(limiter);limiter.connect(ctx.destination);
    const buf=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=buf.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    this.noiseBuffer=buf;
    const noise=(type,freq,q=1)=>{
      const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
      const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=freq;filter.Q.value=q;
      const gain=ctx.createGain();gain.gain.value=0;src.connect(filter);filter.connect(gain);gain.connect(this.master);src.start();return {filter,gain};
    };
    this.wind=noise('lowpass',700);this.road=noise('lowpass',240);this.scrub=noise('bandpass',650);this.rain=noise('highpass',1000);
    this.squeal=ctx.createOscillator();this.squeal.type='triangle';this.squeal.frequency.value=1400;
    this.squealGain=ctx.createGain();this.squealGain.gain.value=0;this.squeal.connect(this.squealGain);this.squealGain.connect(this.master);this.squeal.start();
    try{this.sampleEngine=await SampleEngine.create(ctx,this.master,spec.audioBank);}
    catch(e){console.warn('Engine samples unavailable; using synthesized engine:',e.message);}
    if(!this.sampleEngine){
      await ctx.audioWorklet.addModule(new URL('./vendor/engine-processor.js',import.meta.url));
      this.engine=new AudioWorkletNode(ctx,'engine-processor',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],processorOptions:spec.engine_model});
      this.engineGain=ctx.createGain();this.engineGain.gain.value=.75;this.engine.connect(this.engineGain);this.engineGain.connect(this.master);
    }
    this.ready=true;
    await ctx.resume();
  }
  setActive(active){this.active=active;if(!this.ctx)return;if(active)this.ctx.resume();else this.ctx.suspend();}
  burst(frequency,amount,duration){
    const c=this.ctx,g=c.createGain(),f=c.createBiquadFilter(),n=c.createBufferSource();
    n.buffer=this.noiseBuffer;f.type='bandpass';f.frequency.value=frequency;g.gain.setValueAtTime(amount,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);
    n.connect(f);f.connect(g);g.connect(this.master);n.start();n.stop(c.currentTime+duration);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();};
  }
  update(v,weather,cameraMode=0){
    if(!this.ctx||!this.ready||!this.active)return;
    const t=this.ctx.currentTime,set=(p,value,rate=.06)=>p.setTargetAtTime(value,t,rate);
    set(this.master.gain,this.muted?0:.48);
    if(this.sampleEngine)this.sampleEngine.update(v,cameraMode);
    else{
      set(this.engine.parameters.get('rpm'),v.rpm,.025);set(this.engine.parameters.get('throttle'),v.ctrl.throttle,.025);this.engine.parameters.get('redline').value=v.spec.engine.redline;
      set(this.engineGain.gain,.65+v.ctrl.throttle*.25);
    }
    const speed=Math.abs(v.speed),slip=Math.max(...v.wheels.filter(w=>w.contact).map(w=>Math.abs(w.slipAngle)),0);
    set(this.wind.gain.gain,Math.min(.22,(speed/70)**2*.2));set(this.wind.filter.frequency,400+speed*12);
    set(this.road.gain.gain,Math.min(.13,speed*.0015)*(v.onTrack?1:1.8));
    set(this.scrub.gain.gain,Math.min(.2,Math.max(0,slip-.04)*.7)*Math.min(1,speed/8));
    set(this.squealGain.gain,Math.min(.035,Math.max(0,slip-.08)*.15)*Math.min(1,speed/10));set(this.squeal.frequency,1100+Math.min(1800,slip*2400));
    set(this.rain.gain.gain,weather==='rain'?.05:0);
    if(this.lastGear!==null&&v.gear!==this.lastGear)this.burst(750,.16,.08);
    if(v.scrape>.2&&this.lastScrape<.1)this.burst(180,.3,.2);
    this.lastGear=v.gear;this.lastScrape=v.scrape;
  }
}
