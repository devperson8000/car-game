import * as THREE from 'three';
import {CarView} from '../vehicle.js';
import {getCar} from '../sim/cars.js';
import {Vehicle} from '../vendor/physics.js';
import {applyVehicleState} from './state.js';
export class RemoteCars{
 constructor(view){this.view=view;this.cars=new Map();this.clockOffset=null;}
 sync(players,selfId,serverTime,members=[]){
  const now=performance.now();this.clockOffset=this.clockOffset===null?serverTime-now:this.clockOffset*.9+(serverTime-now)*.1;
  const ids=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id));for(const [id,entry] of this.cars)if(!ids.has(id)){entry.removed=true;this.dispose(entry);this.cars.delete(id);}
  for(const player of players){if(player.id===selfId||!player.state)continue;let entry=this.cars.get(player.id);
   if(!entry){const definition=getCar(player.car);entry={id:player.id,removed:false,samples:[],car:null,v:new Vehicle(this.view.session.track,definition.spec)};this.cars.set(player.id,entry);entry.label=document.createElement('div');entry.label.className='remote-driver-name';entry.label.textContent=members.find(m=>m.id===player.id)?.name||'Driver';entry.label.hidden=true;document.body.append(entry.label);
    new CarView().load({...definition,model:definition.remoteModel||definition.model}).then(car=>{if(entry.removed){this.dispose({car});return;}entry.car=car;car.setQuality('low');car.setPaint(player.paint||'#b8172e');car.group.traverse(o=>{if(o.isMesh)o.castShadow=false;});this.view.scene.add(car.group);}).catch(error=>{console.warn('Remote car unavailable:',error.message);});
   }
   entry.samples.push({time:serverTime,state:player.state});if(entry.samples.length>12)entry.samples.shift();
  }
 }
 render(){
  if(this.clockOffset===null)return;const target=performance.now()+this.clockOffset-100;
  for(const entry of this.cars.values()){if(!entry.car||!entry.samples.length)continue;const samples=entry.samples;let a=samples[0],b=samples.at(-1);for(let i=0;i<samples.length-1;i++)if(samples[i].time<=target&&samples[i+1].time>=target){a=samples[i];b=samples[i+1];break;}
   if(target>=b.time)a=b;const t=a===b?0:THREE.MathUtils.clamp((target-a.time)/(b.time-a.time),0,1);applyVehicleState(entry.v,b.state);
   entry.v.pos.fromArray(a.state.pos).lerp(new THREE.Vector3().fromArray(b.state.pos),t);entry.v.quat.fromArray(a.state.quat).slerp(new THREE.Quaternion().fromArray(b.state.quat),t);
   // Wheel centers must follow the interpolated chassis, not the newest packet.
   const rawPos=new THREE.Vector3().fromArray(b.state.pos),rawInverse=new THREE.Quaternion().fromArray(b.state.quat).invert();
   for(const w of entry.v.wheels)w.worldPos.sub(rawPos).applyQuaternion(rawInverse).applyQuaternion(entry.v.quat).add(entry.v.pos);
   entry.car.update(entry.v);entry.car.group.visible=entry.v.pos.distanceTo(this.view.session.vehicle.pos)<350;
   const screen=entry.v.pos.clone().add(new THREE.Vector3(0,1.6,0)).project(this.view.camera);entry.label.hidden=!entry.car.group.visible||screen.z< -1||screen.z>1;if(!entry.label.hidden){entry.label.style.left=`${(screen.x*.5+.5)*innerWidth}px`;entry.label.style.top=`${(-screen.y*.5+.5)*innerHeight}px`;}
  }
 }
 dispose(entry){entry.label?.remove();if(!entry.car)return;entry.car.group.removeFromParent();const geometries=new Set(),materials=new Set(),textures=new Set();entry.car.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 clear(){for(const entry of this.cars.values()){entry.removed=true;this.dispose(entry);}this.cars.clear();}
}
