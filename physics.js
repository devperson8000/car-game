// APEX vehicle dynamics. Units: metres, seconds, radians and kilograms.
// Lightweight real-time bicycle model, not an engineering-certified simulator.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const move=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
export class DrivingPhysics{
 constructor(){
  this.mass=1510;this.wheelbase=2.73;this.radius=.35;
  this.gearRatios=[3.50,2.23,1.61,1.23,.98,.80];
  this.finalDrive=3.25;this.redline=7900;this.idle=850;
  this.reset();
 }
 reset(){
  this.x=0;this.y=0;this.z=0;this.yaw=0;this.headingRate=0;this.speed=0;this.lateral=0;this.rpm=900;
  this.gear=1;this.steer=0;this.steerAngle=0;this.throttle=0;this.brake=0;this.handbrake=0;
  this.slip=0;this.grip=1;this.offroad=false;this.nearest=0;this.distance=0;this.lap=0;this.wheelSpin=0;
  this.pitch=0;this.roll=0;this.shiftDelay=0;this.forwardSpeed=0;this.lastClosest=0;
 }
 spawn(track,index=0){
  const pts=track.points,i=((index%pts.length)+pts.length)%pts.length;
  const p=pts[i],q=pts[(i+3)%pts.length];
  this.reset();this.x=p[0];this.y=p[1];this.z=p[2];
  this.yaw=Math.atan2(q[0]-p[0],q[2]-p[2]);this.nearest=i;
  this.lastClosest=i;this.distance=i*track.step;
 }
 torque(rpm){
  const r=clamp(rpm/7900,0,1);
  return 350+260*Math.exp(-Math.pow((r-.63)/.34,2))-80*Math.pow(r,4);
 }
 nearestPoint(track,full=false){
  const points=track.points,n=points.length;let best=this.nearest,bd=Infinity;
  const scan=(i)=>{const p=points[(i+n)%n],dx=p[0]-this.x,dz=p[2]-this.z,d=dx*dx+dz*dz;if(d<bd){bd=d;best=(i+n)%n;}};
  if(full){for(let i=0;i<n;i+=3)scan(i);for(let i=best-5;i<=best+5;i++)scan(i);}
  else for(let k=-90;k<=90;k+=2)scan(this.nearest+k);
  for(let k=-3;k<=3;k++)scan(best+k);
  this.lastClosest=this.nearest;this.nearest=best;return Math.sqrt(bd);
 }
 step(dt,input,track,weather='clear',assist=true){
  dt=clamp(dt,.001,.04);
  const steerTarget=(input.right?1:0)-(input.left?1:0);
  this.steer=move(this.steer,steerTarget,8,dt);
  this.throttle=move(this.throttle,input.throttle?1:0,7,dt);
  this.brake=move(this.brake,input.brake?1:0,13,dt);
  this.handbrake=move(this.handbrake,input.handbrake?1:0,16,dt);
  const width=7.4;
  const dist=this.nearestPoint(track,Math.abs(this.speed)<3?false:Math.round(this.distance)%100===0);
  this.offroad=dist>width;
  const wet=weather==='rain';
  const surfaceMu=(this.offroad?.54:1)*(wet?.7:1);
  const mu=surfaceMu*(this.handbrake?.50:1);
  this.grip=clamp(surfaceMu,0,1);
  if(this.lastClosest>track.points.length-20&&this.nearest<20&&this.speed>2)this.lap++;
  this.distance=(this.nearest*track.step)+this.lap*track.total;
  const speedAbs=Math.abs(this.speed);
  const steerLimit=.55/(1+speedAbs/43);
  this.steerAngle=move(this.steerAngle,this.steer*steerLimit,9,dt);
  this.shiftDelay=Math.max(0,this.shiftDelay-dt);
  const ratio=this.gearRatios[this.gear-1]*this.finalDrive;
  const coupledRpm=Math.abs(this.speed)/this.radius*60/(2*Math.PI)*ratio;
  const targetRpm=Math.max(this.idle+this.throttle*550,coupledRpm);
  this.rpm=move(this.rpm,clamp(targetRpm,850,8000),this.throttle>0?.16*80:8,dt);
  if(this.shiftDelay===0&&this.speed>8){
    if(this.rpm>7200&&this.gear<6){this.gear++;this.shiftDelay=.24;this.rpm*=.73;}
    else if(this.rpm<2050&&this.gear>1){this.gear--;this.shiftDelay=.3;this.rpm*=1.38;}
  }
  const maxGripAcceleration=mu*9.81;
  const torque=this.torque(this.rpm);
  const force=(this.throttle*torque*ratio*.87/this.radius)/(this.mass);
  const effectiveForce=assist?Math.min(force,maxGripAcceleration*.82):force;
  const drag=(.5*1.225*.77*this.speed*speedAbs+this.speed*12)/this.mass;
  const rolling=(this.offroad?.7:.16)*Math.sign(this.speed);
  let accel=effectiveForce-drag-rolling;
  if(this.shiftDelay>0)accel-=effectiveForce*.72;
  const brakeMax=Math.min(this.brake*(this.offroad?5.8:10.5),maxGripAcceleration*1.14);
  if(speedAbs>.08)accel-=Math.sign(this.speed)*brakeMax;
  else if(this.brake>.4&&this.throttle<.1){this.speed=Math.max(-11,this.speed-dt*2.7);}
  if(this.handbrake>.1)accel-=Math.sign(this.speed)*this.handbrake*5;
  if(speedAbs<.15&&this.throttle<.03&&this.brake<.2){this.speed=0;accel=0;}
  this.speed=clamp(this.speed+accel*dt,-11,92);
  // Slip-angle response and lateral-force saturation with speed-sensitive steering.
  const idealYawRate=(this.speed/this.wheelbase)*Math.tan(this.steerAngle);
  const maxYaw=Math.min(2,mu*9.81/Math.max(3,speedAbs));
  this.headingRate=move(this.headingRate,clamp(idealYawRate,-maxYaw,maxYaw),this.offroad?3.1:5.6,dt);
  const idealLateral=this.headingRate*this.speed*.14;
  this.lateral=move(this.lateral,idealLateral,this.offroad?2.0:4.6,dt);
  const demand=Math.abs(idealYawRate)/Math.max(.01,maxYaw);
  this.slip=move(this.slip,clamp((demand-.7)*.6+this.handbrake*.5+(!assist?this.throttle*Math.max(0,force-maxGripAcceleration)*.06:0),0,1),4,dt);
  this.yaw+=this.headingRate*dt;
  const fx=Math.sin(this.yaw),fz=Math.cos(this.yaw);
  this.x+=(this.speed*fx+this.lateral*fz)*dt;
  this.z+=(this.speed*fz-this.lateral*fx)*dt;
  this.forwardSpeed=this.speed;
  this.wheelSpin+=this.speed/this.radius*dt;
  const p=track.points[this.nearest],prev=track.points[(this.nearest+track.points.length-4)%track.points.length],next=track.points[(this.nearest+4)%track.points.length];
  const dx=next[0]-prev[0],dz=next[2]-prev[2];
  const naturalPitch=Math.atan2(next[1]-prev[1],Math.hypot(dx,dz));
  this.pitch=move(this.pitch,naturalPitch*1.0,3.3,dt);
  this.roll=move(this.roll,clamp(-this.steerAngle*speedAbs*.010,-.10,.10),3.8,dt);
  this.y=move(this.y,p[1],Math.max(4,speedAbs*.4),dt);
  if(dist>19){ // guardrail bounce / recovery rather than disappearing across the terrain
   const n=track.points[this.nearest];this.x=move(this.x,n[0],1.0,dt);this.z=move(this.z,n[2],1,dt);
   this.speed*=1-.45*dt;
  }
 }
}
