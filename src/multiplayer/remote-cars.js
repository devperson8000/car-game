import * as THREE from 'three';
import {CarView} from '../vehicle.js';
import {getCar} from '../sim/cars.js';
import {Vehicle} from '../vendor/physics.js';
import {RemoteClock,RemoteTimeline} from './remote-timeline.js';
export class RemoteCars{
 constructor(view,{now=()=>performance.now()}={}){this.view=view;this.cars=new Map();this.now=now;this.clock=new RemoteClock();this.screen=new THREE.Vector3();}
 sync(players,selfId,serverTime,members=[]){
  if(!this.clock.observe(serverTime,this.now()))return;
  const ids=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id));for(const [id,entry] of this.cars)if(!ids.has(id)){entry.removed=true;this.dispose(entry);this.cars.delete(id);}
  for(const player of players){if(player.id===selfId||!player.state)continue;let entry=this.cars.get(player.id);
   if(entry&&entry.definition.id!==getCar(player.car).id){entry.removed=true;this.dispose(entry);this.cars.delete(player.id);entry=null;}
   if(!entry){const definition=getCar(player.car);entry={id:player.id,definition,removed:false,timeline:new RemoteTimeline(),car:null,v:new Vehicle(this.view.session.track,definition.spec)};this.cars.set(player.id,entry);entry.label=document.createElement('div');entry.label.className='remote-driver-name';entry.label.hidden=true;document.body.append(entry.label);
    new CarView().load({...definition,model:definition.remoteModel||definition.model}).then(car=>{if(entry.removed){car.dispose();return;}entry.car=car;car.setQuality('low');car.setPaint(entry.paint);car.group.traverse(o=>{if(o.isMesh)o.castShadow=false;});this.view.scene.add(car.group);}).catch(error=>{console.warn('Remote car unavailable:',error.message);});
   }
   const paint=player.paint||'#b8172e';if(entry.paint!==paint){entry.paint=paint;entry.car?.setPaint(paint);}
   const name=members.find(m=>m.id===player.id)?.name||'Driver';if(entry.label.textContent!==name)entry.label.textContent=name;
   entry.timeline.push(serverTime,player.state,player.epoch??0);
  }
 }
 render(){
  const target=this.clock.time(this.now());if(target===null)return;
  for(const entry of this.cars.values()){
   if(!entry.car||!entry.timeline.sample(target,entry.v))continue;
   entry.car.group.visible=entry.v.pos.distanceToSquared(this.view.session.vehicle.pos)<350*350;
   entry.label.hidden=true;if(!entry.car.group.visible)continue;
   entry.car.update(entry.v);

  }
 }
 labels(){for(const entry of this.cars.values()){if(!entry.car?.group.visible){entry.label.hidden=true;continue;}
   const screen=this.screen.copy(entry.v.pos);screen.y+=1.6;screen.project(this.view.camera);
   entry.label.hidden=screen.z< -1||screen.z>1||Math.abs(screen.x)>1||Math.abs(screen.y)>1;
   if(!entry.label.hidden){entry.label.style.left=`${(screen.x*.5+.5)*innerWidth}px`;entry.label.style.top=`${(-screen.y*.5+.5)*innerHeight}px`;}
 }}
 dispose(entry){entry.label?.remove();entry.car?.dispose();}
 clear(){for(const entry of this.cars.values()){entry.removed=true;this.dispose(entry);}this.cars.clear();this.clock=new RemoteClock();}
}
