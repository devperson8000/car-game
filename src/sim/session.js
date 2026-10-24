import { Track } from '../vendor/track.js';
import { routeData } from './routes.js';
import { Vehicle, DT } from '../vendor/physics.js';
import { SPEC } from './spec.js';

export class LapTimer {
  constructor(length, start=0) { this.length=length;this.completed=0;this.last=null;this.best=null;this.reset(start); }
  reset(start) { this.previous=start;this.progress=0;this.current=0;this.armed=start<.1; }
  update(s,dt) {
    this.current+=dt;
    const previous=this.previous;let d=s-previous;
    if(d>this.length/2)d-=this.length;
    if(d<-this.length/2)d+=this.length;
    this.previous=s;
    // Teleports do not contribute. Ordinary reverse motion subtracts progress.
    if(Math.abs(d)>150){this.reset(s);this.armed=false;return;}
    this.progress+=d;
    if(previous<this.length/2&&s>this.length/2&&d<0){this.armed=false;this.progress=0;this.current=0;}
    if(previous>this.length/2&&s<this.length/2&&d>0){
      if(this.armed&&this.progress>=this.length*.98){
        this.last=this.current;this.best=this.best===null?this.last:Math.min(this.best,this.last);this.completed++;
      }
      this.armed=true;this.progress=0;this.current=0;
    }
  }
}

export class Session {
  constructor(route='nordschleife') {
    this.route=route;this.track=new Track(routeData(route));this.vehicle=new Vehicle(this.track,SPEC);
    this.start=180;this.vehicle.reset(this.start);this.paused=false;
    this.accumulator=0;this.elapsed=0;this.reverseHold=0;this.laps=new LapTimer(this.track.total,this.vehicle.trackS);
  }
  advance(dt,controls={}) {
    if(this.paused){this.accumulator=0;return;}
    const frame=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    this.accumulator+=frame;
    const finite=(x,lo,hi)=>Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):0;
    Object.assign(this.vehicle.ctrl,{
      steer:finite(controls.steer,-1,1),throttle:finite(controls.throttle,0,1),
      brake:finite(controls.brake,0,1),handbrake:controls.handbrake===true,
    });
    const v=this.vehicle,c=v.ctrl;
    if(v.auto){
      if(v.gear!==-1){
        this.reverseHold=c.brake>.3&&c.throttle<.05&&Math.abs(v.speed)<.6?this.reverseHold+frame:0;
        if(this.reverseHold>.55){v.gear=-1;this.reverseHold=0;}
      }
      if(v.gear===-1){
        if(c.throttle>.05){
          if(Math.abs(v.speed)<.7){v.gear=1;}
          else {c.brake=c.throttle;c.throttle=0;}
        }else {c.throttle=c.brake;c.brake=0;}
      }
    }
    while(this.accumulator+1e-9>=DT){
      this.vehicle.step(DT);this.elapsed+=DT;this.laps.update(this.vehicle.trackS,DT);this.accumulator-=DT;
    }
  }
  reset() {
    this.vehicle.reset(this.vehicle.trackS);this.vehicle.ctrl={steer:0,throttle:0,brake:0,handbrake:false};
    this.accumulator=0;this.reverseHold=0;this.laps.reset(this.vehicle.trackS);
  }
}
