import {Vector3,Quaternion} from 'three';
import {INPUT_DT,restoreSession,applyInputFrame} from '../sim/network-state.js';
const idle=()=>({steer:0,throttle:0,brake:0,handbrake:false});
const copyPose=p=>({position:p.position.clone(),quaternion:p.quaternion.clone()});
/** Fixed input-frame history. Only acknowledged frames are discarded. */
export class LocalPrediction{
 constructor(session,{sample,auto,assists}){Object.assign(this,{session,sample,auto,assists});this.previousPosition=new Vector3();this.currentPosition=new Vector3();this.previousQuaternion=new Quaternion();this.currentQuaternion=new Quaternion();this.poseValue={position:new Vector3(),quaternion:new Quaternion()};this.reset();}
 reset(){this.ready=false;this.epoch=null;this.pending=[];this.nextSequence=0;this.sentThrough=-1;this.lastAck=-1;this.carry=0;this.lastTime=null;this.lastStepTime=0;this.shifts=[];this.lastControls=idle();this.syncPose();}
 syncPose(){const v=this.session.vehicle;this.previousPosition.copy(v.pos);this.currentPosition.copy(v.pos);this.previousQuaternion.copy(v.quat);this.currentQuaternion.copy(v.quat);}
 queueShift(direction){if(['up','down'].includes(direction)&&this.shifts.length<2)this.shifts.push(direction);}
 get blocked(){return this.pending.length>=120;}
 advance(now,active){if(this.lastTime===null){this.lastTime=now;return;}const elapsed=Math.max(0,Math.min(.25,(now-this.lastTime)/1000));this.lastTime=now;
  if(!active||!this.ready){this.carry=0;this.shifts=[];return;}
  this.carry+=elapsed;
  while(this.carry+1e-10>=INPUT_DT&&!this.blocked){const v=this.session.vehicle,frame={seq:this.nextSequence++,controls:{...this.sample(INPUT_DT,v)},auto:!!this.auto(),...this.assists(),shifts:this.shifts.splice(0,2)};this.previousPosition.copy(v.pos);this.previousQuaternion.copy(v.quat);applyInputFrame(this.session,frame);this.currentPosition.copy(v.pos);this.currentQuaternion.copy(v.quat);this.pending.push(frame);this.lastControls=frame.controls;this.carry-=INPUT_DT;}
  if(this.blocked)this.carry=0;this.lastStepTime=now-this.carry*1000;
 }
 batch(){return this.pending.filter(f=>f.seq>this.sentThrough).slice(0,15);}
 markSent(frames){if(frames?.length)this.sentThrough=Math.max(this.sentThrough,frames.at(-1).seq);}
 pose(now){const alpha=this.ready?Math.max(0,Math.min(1,(now-this.lastStepTime)/(INPUT_DT*1000))):1;this.poseValue.position.copy(this.previousPosition).lerp(this.currentPosition,alpha);this.poseValue.quaternion.copy(this.previousQuaternion).slerp(this.currentQuaternion,alpha);return this.poseValue;}
 reconcile(simulation,ack,now){if(!ack||!Number.isInteger(ack.epoch)||!Number.isInteger(ack.frame)||ack.frame< -1||this.epoch!==null&&ack.epoch<this.epoch)return null;const epochChanged=this.epoch!==ack.epoch,first=!this.ready;if(!epochChanged&&ack.frame<this.lastAck)return null;const before=copyPose(this.pose(now));if(!restoreSession(this.session,simulation))return null;
  if(epochChanged){this.epoch=ack.epoch;this.pending=[];this.nextSequence=ack.frame+1;this.sentThrough=ack.frame;this.carry=0;this.lastTime=now;this.lastStepTime=now;this.shifts=[];}
  else this.pending=this.pending.filter(f=>f.seq>ack.frame);
  this.lastAck=ack.frame;this.ready=true;this.syncPose();
  for(const frame of this.pending){this.previousPosition.copy(this.session.vehicle.pos);this.previousQuaternion.copy(this.session.vehicle.quat);applyInputFrame(this.session,frame);this.currentPosition.copy(this.session.vehicle.pos);this.currentQuaternion.copy(this.session.vehicle.quat);}
  if(this.nextSequence<=ack.frame)this.nextSequence=ack.frame+1;
  return{before,after:copyPose(this.pose(now)),epochChanged,first,reason:ack.reason};
 }
}
