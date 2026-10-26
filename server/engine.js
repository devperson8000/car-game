import { randomBytes, randomUUID } from 'node:crypto';
import { Session, LapTimer } from '../src/sim/session.js';
import { setWeatherGrip } from '../src/vendor/physics.js';
import { setTrackWidth } from '../src/vendor/track.js';
import { routeData } from '../src/sim/routes.js';
import { CARS } from '../src/sim/cars.js';

const MAX_PLAYERS=8, GRACE=30000;
const token=()=>randomBytes(32).toString('base64url');
const idle=()=>({steer:0,throttle:0,brake:0,handbrake:false});
const braking=()=>({steer:0,throttle:0,brake:1,handbrake:true});
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\x00-\x1f\x7f]/.test(v)?v.trim():null;
const oneOf=(v,values)=>values.includes(v);
function config(m){if(!oneOf(m.mode,['free','race'])||!oneOf(m.route,['mountain','nordschleife'])||!oneOf(m.weather,['day','golden','overcast','rain'])||!Number.isInteger(m.laps)||m.laps<1||m.laps>5)throw Error('Invalid session settings');return{mode:m.mode,route:m.route,weather:m.weather,laps:m.laps};}
function driver(m){const name=text(m.name,24);if(!name||!CARS.some(c=>c.id===m.car)||typeof m.auto!=='boolean'||!/^#[\da-f]{6}$/i.test(m.paint))throw Error('Invalid driver settings');return{name,car:m.car,auto:m.auto,paint:m.paint.toLowerCase()};}
function vehicleState(v){const state={};for(const k of ['pos','quat','vel','angVel'])state[k]=v[k].toArray();for(const k of ['rpm','gear','auto','tc','abs','speed','trackS','trackD','onTrack','airborne','scrape'])state[k]=v[k];state.ctrl={...v.ctrl};state.wheels=v.wheels.map(w=>({worldPos:w.worldPos.toArray(),...Object.fromEntries(['omega','steer','spinAngle','contact','slipAngle','slipRatio','load','comp','prevComp','surf'].map(k=>[k,w[k]]))}));return state;}

/** Owns all membership and physics state. Its clock is injectable for deterministic simulation. */
export class RoomEngine {
  constructor({now=Date.now,maxRooms=100,maxPeers=512}={}){this.now=now;this.maxRooms=maxRooms;this.maxPeers=maxPeers;this.peers=new Map();this.rooms=new Map();this.tokens=new Map();}
  connect(send){if(this.peers.size>=this.maxPeers)throw Error('Server is full');const id=randomUUID();this.peers.set(id,{id,send,member:null,pending:null});this.send(id,{type:'hello',id,serverTime:this.now()});return id;}
  send(id,m){const peer=this.peers.get(id);if(peer)peer.send(m);}
  globals(room){setTrackWidth(room.roadHalf);setWeatherGrip(room.config.weather==='rain'?.7:1);}
  roomState(room,self){return{code:room.code,name:room.name,ownerId:room.ownerId,config:{...room.config},phase:room.phase,countdownEndsAt:room.countdownEndsAt,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,car:p.car,paint:p.paint,ready:p.ready,connected:!!p.peer})),pendingRequests:self===room.ownerId?[...room.pending.values()].map(p=>({id:p.id,name:p.name,car:p.car})):[]};}
  broadcast(room){for(const p of room.players.values())if(p.peer)this.send(p.peer,{type:'room',room:this.roomState(room,p.id)});}
  join(room,peer,details){const p={...details,id:randomUUID(),token:token(),peer:peer.id,ready:false,seq:-1,lastInput:0,parked:true,controls:idle(),finished:false,finishTime:null,disconnectedAt:null};this.globals(room);p.session=new Session(room.config.route,p.car);p.session.vehicle.auto=p.auto;
    const slot=room.players.size;p.session.vehicle.reset(180-slot*8);p.session.laps.reset(p.session.vehicle.trackS);
    for(let i=0;i<120;i++)p.session.vehicle.step(1/240);
    room.players.set(p.id,p);if(!room.ownerId)room.ownerId=p.id;peer.member={room,p};peer.pending=null;this.tokens.set(p.token,{room,p});this.send(peer.id,{type:'joined',selfId:p.id,token:p.token,room:this.roomState(room,p.id)});this.broadcast(room);return p;}
  ownerTransfer(room){const owner=room.players.get(room.ownerId);if(owner?.peer)return;room.ownerId=[...room.players.values()].find(p=>p.peer)?.id??room.players.keys().next().value??null;}
  remove(room,p){this.tokens.delete(p.token);room.players.delete(p.id);if(p.peer){const peer=this.peers.get(p.peer);if(peer)peer.member=null;this.send(p.peer,{type:'left'});}this.ownerTransfer(room);if(!room.players.size){for(const request of room.pending.values()){const peer=this.peers.get(request.peer);if(peer)peer.pending=null;this.send(request.peer,{type:'rejected',message:'Lobby closed'});}this.rooms.delete(room.code);}else this.broadcast(room);}
  clearPending(peer){if(!peer.pending)return;const room=this.rooms.get(peer.pending.code);room?.pending.delete(peer.pending.id);peer.pending=null;if(room)this.broadcast(room);}
  disconnect(id){const peer=this.peers.get(id);if(!peer)return;this.clearPending(peer);if(peer.member){const{room,p}=peer.member;p.peer=null;p.disconnectedAt=this.now();p.controls=braking();p.parked=true;p.ready=false;this.ownerTransfer(room);this.broadcast(room);}this.peers.delete(id);}
  grid(room){this.globals(room);let i=0;for(const p of room.players.values()){p.session=new Session(room.config.route,p.car);const v=p.session.vehicle;const s=room.config.mode==='free'?180-i*8:v.track.total-12-i*8;v.reset(s);v.auto=p.auto;p.session.laps=new LapTimer(v.track.total,v.trackS);p.session.laps.armed=false;p.controls=idle();p.parked=true;p.finished=false;p.finishTime=null;p.seq=-1;p.lastInput=0;p.ready=false;i++;}}
  message(id,m){const peer=this.peers.get(id);if(!peer)return;try{if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.type!=='string')throw Error('Invalid message');
    if(m.type==='ping'){if(typeof m.clientTime!=='number'||!Number.isFinite(m.clientTime))throw Error('Invalid ping');this.send(id,{type:'pong',clientTime:m.clientTime,serverTime:this.now()});return;}
    if(m.type==='list'){this.send(id,{type:'lobbies',lobbies:[...this.rooms.values()].map(r=>({code:r.code,name:r.name,ownerName:r.players.get(r.ownerId)?.name??'',players:r.players.size,maxPlayers:MAX_PLAYERS,mode:r.config.mode,route:r.config.route,phase:r.phase}))});return;}
    if(m.type==='leave'){this.clearPending(peer);if(peer.member)this.remove(peer.member.room,peer.member.p);else this.send(id,{type:'left'});return;}
    if(m.type==='resume'){if(peer.member||peer.pending)throw Error('Leave your current lobby first');if(typeof m.token!=='string'||m.token.length>100)throw Error('Invalid resume token');const membership=this.tokens.get(m.token);if(!membership||membership.p.peer||this.now()-membership.p.disconnectedAt>=GRACE)throw Error('Session expired');const{room,p}=membership;this.tokens.delete(p.token);p.token=token();this.tokens.set(p.token,membership);p.peer=id;p.disconnectedAt=null;p.seq=-1;p.lastInput=0;p.parked=true;p.controls=idle();peer.member=membership;this.send(id,{type:'joined',selfId:p.id,token:p.token,room:this.roomState(room,p.id)});this.broadcast(room);return;}
    if(m.type==='create'||m.type==='request'){if(peer.member||peer.pending)throw Error('Leave your current lobby first');const details=driver(m);if(m.type==='create'){const cfg=config(m),name=text(m.lobbyName,40);if(!name)throw Error('Invalid lobby name');if(this.rooms.size>=this.maxRooms)throw Error('Server lobby limit reached');let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(this.rooms.has(code));const room={code,name,config:cfg,roadHalf:routeData(cfg.route).roadHalf??4.5,ownerId:null,players:new Map(),pending:new Map(),phase:cfg.mode==='free'?'running':'lobby',countdownEndsAt:null,raceStartedAt:null};this.rooms.set(code,room);this.join(room,peer,details);return;}
      const room=typeof m.code==='string'?this.rooms.get(m.code.trim().toUpperCase()):null;if(!room||room.players.size>=MAX_PLAYERS||(room.config.mode==='race'&&['countdown','running'].includes(room.phase))){this.send(id,{type:'rejected',message:'Lobby unavailable, full, or racing'});return;}if(room.pending.size>=32)throw Error('Too many pending requests');const request={...details,id:randomUUID(),peer:id,createdAt:this.now()};room.pending.set(request.id,request);peer.pending={code:room.code,id:request.id};this.send(id,{type:'pending',code:room.code});this.broadcast(room);return;
    }
    if(!peer.member)throw Error('Join a lobby first');const{room,p}=peer.member;const owner=room.ownerId===p.id;
    if(['approve','kick','configure','start','cancel'].includes(m.type)&&!owner)throw Error('Only the owner can do that');
    switch(m.type){
      case 'approve':{if(typeof m.accept!=='boolean')throw Error('Invalid approval');const request=room.pending.get(m.requestId);if(!request)throw Error('Request expired');room.pending.delete(request.id);const target=this.peers.get(request.peer);if(target)target.pending=null;if(!m.accept){this.send(request.peer,{type:'rejected',message:'The owner declined your request'});this.broadcast(room);return;}if(room.players.size>=MAX_PLAYERS||(room.config.mode==='race'&&['countdown','running'].includes(room.phase))){this.send(request.peer,{type:'rejected',message:'Lobby is full or racing'});this.broadcast(room);return;}if(target)this.join(room,target,request);return;}
      case 'kick':{const target=room.players.get(m.playerId);if(!target||target===p)throw Error('Invalid player');this.remove(room,target);return;}
      case 'configure':{if(room.config.mode==='race'&&['countdown','running'].includes(room.phase))throw Error('Cancel the race before configuring');const next=config(m),preserve=room.config.mode==='free'&&next.mode==='free'&&room.config.route===next.route;room.config=next;room.roadHalf=routeData(room.config.route).roadHalf??4.5;room.phase=room.config.mode==='free'?'running':'lobby';room.countdownEndsAt=null;room.raceStartedAt=null;if(!preserve)this.grid(room);this.broadcast(room);return;}
      case 'ready':if(room.config.mode!=='race'||room.phase!=='lobby'||typeof m.ready!=='boolean')throw Error('Cannot change readiness now');p.ready=m.ready;this.broadcast(room);return;
      case 'start':{const players=[...room.players.values()];if(room.config.mode!=='race'||room.phase!=='lobby'||players.filter(p=>p.peer).length<2||players.some(p=>!p.peer||!p.ready))throw Error('At least two connected, ready drivers are required');this.grid(room);room.phase='countdown';room.countdownEndsAt=this.now()+5000;this.broadcast(room);return;}
      case 'cancel':if(room.config.mode!=='race')throw Error('No race to cancel');room.phase='lobby';room.countdownEndsAt=null;room.raceStartedAt=null;this.grid(room);this.broadcast(room);return;
      case 'input':{if(!Number.isSafeInteger(m.seq)||m.seq<0||m.seq<=p.seq)throw Error('Invalid input sequence');if(typeof m.parked!=='boolean'||typeof m.auto!=='boolean'||!m.controls||typeof m.controls!=='object')throw Error('Invalid input');const c=m.controls;if(!['steer','throttle','brake'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k]))||typeof c.handbrake!=='boolean')throw Error('Invalid controls');p.seq=m.seq;p.lastInput=this.now();p.parked=m.parked;p.auto=m.auto;p.session.vehicle.auto=m.auto;p.controls={steer:Math.max(-1,Math.min(1,c.steer)),throttle:Math.max(0,Math.min(1,c.throttle)),brake:Math.max(0,Math.min(1,c.brake)),handbrake:c.handbrake};return;}
      case 'transmission':if(typeof m.auto!=='boolean')throw Error('Invalid gearbox');p.auto=m.auto;p.session.vehicle.auto=m.auto;return;
      case 'assists':if(typeof m.tc!=='boolean'||typeof m.abs!=='boolean')throw Error('Invalid assists');p.session.vehicle.tc=m.tc;p.session.vehicle.abs=m.abs;return;
      case 'shift':if(p.auto||room.phase==='countdown'||room.phase==='finished'||p.parked||!oneOf(m.direction,['up','down']))throw Error('Cannot shift now');p.session.vehicle[m.direction==='up'?'shiftUp':'shiftDown']();return;
      case 'recover':if(room.config.mode==='race'&&room.phase!=='lobby')throw Error('Recovery is disabled during races');this.globals(room);p.session.reset();p.controls=idle();return;
      default:throw Error('Unknown message type');
    }
  }catch(error){this.send(id,{type:'error',message:error.message});}}
  tick(dt=1/60){const now=this.now();for(const room of this.rooms.values()){
    for(const p of [...room.players.values()])if(!p.peer&&now-p.disconnectedAt>=GRACE)this.remove(room,p);
    if(!this.rooms.has(room.code))continue;
    for(const request of [...room.pending.values()])if(now-request.createdAt>60000){room.pending.delete(request.id);const peer=this.peers.get(request.peer);if(peer)peer.pending=null;this.send(request.peer,{type:'rejected',message:'Request expired'});this.broadcast(room);}
    if(room.phase==='countdown'&&now>=room.countdownEndsAt){room.phase='running';room.raceStartedAt=room.countdownEndsAt;room.countdownEndsAt=null;this.broadcast(room);}
    this.globals(room);
    for(const p of room.players.values()){
      const race=room.config.mode==='race';if(room.phase==='countdown'||room.phase==='finished')continue;
      const safe=!p.peer||p.parked||now-p.lastInput>500||p.finished;
      if(safe&&(!race||room.phase==='lobby')){p.session.vehicle.ctrl=idle();p.session.vehicle.vel.set(0,0,0);p.session.vehicle.angVel.set(0,0,0);p.session.vehicle.rpm=p.session.vehicle.spec.engine.idle;for(const w of p.session.vehicle.wheels)w.omega=0;p.session.accumulator=0;continue;}
      const session=p.session,v=session.vehicle;
      if(safe){ // Bypass Session's automatic reverse gesture when safety braking.
        const auto=v.auto;v.auto=false;session.reverseHold=0;if(v.gear===-1)v.gear=1;session.advance(dt,braking());v.auto=auto;
      }else session.advance(dt,p.controls);
      if(race&&room.phase==='running'&&!p.finished&&session.laps.completed>=room.config.laps){p.finished=true;p.finishTime=(now-room.raceStartedAt)/1000;this.broadcast(room);}
    }
    if(room.config.mode==='race'&&room.phase==='running'&&[...room.players.values()].length&&[...room.players.values()].every(p=>p.finished)){room.phase='finished';this.broadcast(room);}
  }}
  snapshots(){for(const room of this.rooms.values()){
    const standings=[...room.players.values()].map(p=>({id:p.id,name:p.name,lap:p.session.laps.completed,progress:p.session.laps.progress,finished:p.finished,time:p.finishTime})).sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.time-b.time:(b.lap-a.lap)||b.progress-a.progress)).map((p,i)=>({...p,position:i+1}));
    const message={type:'snapshot',serverTime:this.now(),code:room.code,phase:room.phase,countdownEndsAt:room.countdownEndsAt,players:[...room.players.values()].map(p=>({id:p.id,car:p.car,paint:p.paint,state:vehicleState(p.session.vehicle),laps:{completed:p.session.laps.completed,current:p.session.laps.current,last:p.session.laps.last,best:p.session.laps.best,progress:p.session.laps.progress,armed:p.session.laps.armed},finished:p.finished,finishTime:p.finishTime})),standings};for(const p of room.players.values())if(p.peer)this.send(p.peer,message);
  }}
}
