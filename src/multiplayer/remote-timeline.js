import {Quaternion,Vector3} from 'three';
// Server milliseconds and an injected monotonic arrival/render clock keep this
// independent of the DOM, timers, and the renderer.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;
const AXES=['x','y','z'],BODY_FIELDS=['speed','rpm'],WHEEL_FIELDS=['steer','comp','omega','spinAngle'],PRESENTATION_WHEEL_FIELDS=['steer','comp','spinAngle'];
export class RemoteClock {
 constructor(){this.offset=null;this.delay=100;this.jitter=0;this.lastArrival=null;this.lastServer=null;this.target=null;}
 observe(serverTime,arrival){
  if(this.lastServer!==null&&serverTime<=this.lastServer)return false;
  if(this.lastArrival!==null){const variation=Math.abs((arrival-this.lastArrival)-(serverTime-this.lastServer));this.jitter+=.15*(variation-this.jitter);}
  const offset=serverTime-arrival;
  this.offset=this.offset===null?offset:this.offset+.04*(offset-this.offset);
  this.delay=clamp(100+this.jitter*2,100,220);
  this.lastArrival=arrival;this.lastServer=serverTime;return true;
 }
 time(now){if(this.offset===null)return null;const desired=now+this.offset-this.delay;this.target=this.target===null?desired:Math.max(this.target,desired);return this.target;}
}
export class RemoteTimeline {
 constructor(){this.samples=[];this.epoch=null;this.lastTarget=null;this.quaternion=new Quaternion();this.lastPosition=new Vector3();this.positionOffset=new Vector3();this.lastQuaternion=new Quaternion();this.rotationOffset=new Quaternion();this.identity=new Quaternion();this.lastWheels=Array.from({length:4},()=>({steer:0,comp:0,spinAngle:0}));this.wheelOffsets=Array.from({length:4},()=>({steer:0,comp:0,spinAngle:0}));this.pendingRecovery=false;}
 push(time,state,epoch=0){
  if(this.epoch!==null&&epoch<this.epoch)return false;
  if(epoch!==this.epoch){this.samples.length=0;this.lastTarget=null;this.epoch=epoch;this.pendingRecovery=false;this.positionOffset.set(0,0,0);this.rotationOffset.identity();for(const w of this.wheelOffsets)for(const key of PRESENTATION_WHEEL_FIELDS)w[key]=0;}
  const previous=this.samples.at(-1);if(previous&&time<=previous.time)return false;
  if(!state?.pos||!state?.quat)return false;
  const wheels=(state.wheels||[]).map((w,i)=>{
   let spinAngle=w.spinAngle||0;
   const before=previous?.state.wheels[i];
   if(before){const expected=before.spinAngle+((before.omega||0)+(w.omega||0))*.5*(time-previous.time)/1000;spinAngle+=Math.round((expected-spinAngle)/TAU)*TAU;}
   return {...w,spinAngle};
  });
  if(previous&&this.lastTarget!==null&&this.lastTarget>previous.time)this.pendingRecovery=true;
  this.samples.push({time,state:{...state,wheels}});if(this.samples.length>32)this.samples.shift();return true;
 }
 sample(target,v){
  if(!this.samples.length)return false;
  target=this.lastTarget===null?target:Math.max(target,this.lastTarget);
  if(this.pendingRecovery&&this.lastTarget!==null){
   // Re-evaluate the old render instant against newly arrived history. Keep its
   // previously presented pose, then release that correction as time advances.
   this.evaluate(this.lastTarget,v);
   this.positionOffset.copy(this.lastPosition).sub(v.pos);
   this.rotationOffset.copy(v.quat).invert().premultiply(this.lastQuaternion);
   for(let i=0;i<v.wheels.length;i++)for(const key of PRESENTATION_WHEEL_FIELDS)this.wheelOffsets[i][key]=this.lastWheels[i][key]-v.wheels[i][key];
  }
  this.pendingRecovery=false;
  const decay=this.lastTarget===null?1:Math.exp(-(target-this.lastTarget)/150);
  this.positionOffset.multiplyScalar(decay);this.rotationOffset.slerp(this.identity,1-decay);
  this.evaluate(target,v);v.pos.add(this.positionOffset);v.quat.premultiply(this.rotationOffset);
  for(let i=0;i<v.wheels.length;i++){
   const w=v.wheels[i];
   for(const key of PRESENTATION_WHEEL_FIELDS){this.wheelOffsets[i][key]*=decay;w[key]+=this.wheelOffsets[i][key];this.lastWheels[i][key]=w[key];}
   w.worldPos.set(w.x,w.attachY-w.restLen+w.comp,w.z).applyQuaternion(v.quat).add(v.pos);
  }
  v.ctrl.steer=(v.wheels[0].steer+v.wheels[1].steer)*.5;
  this.lastPosition.copy(v.pos);this.lastQuaternion.copy(v.quat);this.lastTarget=target;return true;
 }
 evaluate(target,v){
  const samples=this.samples;
  while(samples.length>2&&samples[1].time<=target)samples.shift();
  let a=samples[0],b=samples[1]||a;
  if(target>=b.time)a=b;
  const t=a===b?0:clamp((target-a.time)/(b.time-a.time),0,1),s=a.state,e=b.state;
  // Exponential velocity decay eases into a bounded hold during a packet gap.
  const age=a===b?Math.max(0,target-a.time)/1000:0;
  const ahead=.08*(1-Math.exp(-Math.min(age,.32)/.08));
  for(let i=0;i<3;i++){const key=AXES[i];v.pos[key]=s.pos[i]+(e.pos[i]-s.pos[i])*t+(s.vel?.[i]||0)*ahead;v.vel[key]=(s.vel?.[i]||0)+((e.vel?.[i]||0)-(s.vel?.[i]||0))*t;}
  v.quat.fromArray(s.quat).normalize();v.quat.slerpQuaternions(v.quat,this.quaternion.fromArray(e.quat).normalize(),t);
  for(const key of BODY_FIELDS)v[key]=(s[key]||0)+((e[key]||0)-(s[key]||0))*t;
  v.gear=t<.5?s.gear:e.gear;v.ctrl.brake=(s.ctrl?.brake||0)+((e.ctrl?.brake||0)-(s.ctrl?.brake||0))*t;
  for(let i=0;i<v.wheels.length;i++){
   const w=v.wheels[i],wa=s.wheels[i],wb=e.wheels[i]||wa;if(!wa)continue;
   for(const key of WHEEL_FIELDS)w[key]=(wa[key]||0)+((wb[key]||0)-(wa[key]||0))*t;
   w.spinAngle+=(wa.omega||0)*ahead;w.contact=t<.5?wa.contact:wb.contact;
  }
  v.ctrl.steer=(v.wheels[0].steer+v.wheels[1].steer)*.5;return true;
 }
}
