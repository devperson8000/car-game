const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function readGamepadInput(gp){
  if(!gp?.connected)return {steer:0,throttle:0,brake:0,handbrake:false};
  const finite=(v)=>Number.isFinite(v)?v:0,axis=clamp(finite(gp.axes[0]),-1,1);
  return {steer:Math.abs(axis)>.08?Math.sign(axis)*(Math.abs(axis)-.08)/.92:0,
    throttle:clamp(finite(gp.buttons[7]?.value),0,1),brake:clamp(finite(gp.buttons[6]?.value),0,1),handbrake:!!gp.buttons[0]?.pressed};
}
export class Controls{
  constructor(onAction){
    this.keys=new Set();this.touch={};this.steer=0;this.throttle=0;this.brake=0;this.padButtons=[];
    addEventListener('keydown',e=>{
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);if(!e.repeat)onAction(e.code);
    });
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>this.clear());
    document.querySelectorAll('[data-control]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.touch[button.dataset.control]=true;button.classList.add('active');});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{this.touch[button.dataset.control]=false;button.classList.remove('active');});
    });
  }
  clear(){this.keys.clear();this.touch={};this.steer=0;this.throttle=0;this.brake=0;document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('active'));}
  sample(dt,vehicle){
    const down=(...k)=>k.some(c=>this.keys.has(c));
    let steer=Number(down('KeyD','ArrowRight')||this.touch.right)-Number(down('KeyA','ArrowLeft')||this.touch.left);
    let throttle=Number(down('KeyW','ArrowUp')||this.touch.throttle),brake=Number(down('KeyS','ArrowDown')||this.touch.brake),handbrake=down('Space');
    const gp=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);
    let analog=false;
    if(gp){
      const pad=readGamepadInput(gp);
      if(pad.steer!==0){steer=pad.steer;analog=true;}
      throttle=Math.max(throttle,pad.throttle);brake=Math.max(brake,pad.brake);handbrake ||= pad.handbrake;
    }
    const rate=analog?12:(steer===0?7:3.4/(1+Math.abs(vehicle.speed)*.022));
    this.steer+=clamp(steer-this.steer,-dt*rate,dt*rate);
    this.throttle+=clamp(throttle-this.throttle,-dt*8,dt*4);this.brake+=clamp(brake-this.brake,-dt*10,dt*7);
    return {steer:this.steer,throttle:this.throttle,brake:this.brake,handbrake};
  }
}
