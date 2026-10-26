import { randomBytes, randomUUID } from 'node:crypto';
import { Session, LapTimer } from '../src/sim/session.js';
import { setWeatherGrip } from '../src/vendor/physics.js';
import { setTrackWidth } from '../src/vendor/track.js';
import { routeData } from '../src/sim/routes.js';
import { CARS } from '../src/sim/cars.js';
import { INPUT_DT, captureSession, applyInputFrame } from '../src/sim/network-state.js';

const MAX_PLAYERS=8, GRACE=30000;
const token=()=>randomBytes(32).toString('base64url');
const idle=()=>({steer:0,throttle:0,brake:0,handbrake:false});
const braking=()=>({steer:0,throttle:0,brake:1,handbrake:true});
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\x00-\x1f\x7f]/.test(v)?v.trim():null;
const oneOf=(v,values)=>values.includes(v);
function config(m){if(!oneOf(m.mode,['free','race'])||!oneOf(m.route,['mountain','nordschleife'])||!oneOf(m.weather,['day','golden','overcast','rain'])||!Number.isInteger(m.laps)||m.laps<1||m.laps>5)throw Error('Invalid session settings');return{mode:m.mode,route:m.route,weather:m.weather,laps:m.laps};}
function driver(m){const name=text(m.name,24);if(!name||!CARS.some(c=>c.id===m.car)||typeof m.auto!=='boolean'||!/^#[\da-f]{6}$/i.test(m.paint))throw Error('Invalid driver settings');return{name,car:m.car,auto:m.auto,paint:m.paint.toLowerCase()};}
function vehicleState(v){const state={};for(const k of ['pos','quat','vel','angVel'])state[k]=v[k].toArray();for(const k of ['rpm','gear','auto','tc','abs','speed','trackS','trackD','onTrack','airborne','scrape'])state[k]=v[k];state.ctrl={...v.ctrl};state.wheels=v.wheels.map(w=>({worldPos:w.worldPos.toArray(),...Object.fromEntries(['omega','steer','spinAngle','contact','slipAngle','slipRatio','load','comp','prevComp','surf'].map(k=>[k,w[k]]))}));return state;}

function controls(c){if(!c||typeof c!=='object'||!['steer','throttle','brake'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k]))||typeof c.handbrake!=='boolean')throw Error('Invalid controls');return{steer:Math.max(-1,Math.min(1,c.steer)),throttle:Math.max(0,Math.min(1,c.throttle)),brake:Math.max(0,Math.min(1,c.brake)),handbrake:c.handbrake};}
function compactState(v){return{pos:v.pos.toArray(),quat:v.quat.toArray(),vel:v.vel.toArray(),angVel:v.angVel.toArray(),speed:v.speed,rpm:v.rpm,gear:v.gear,ctrl:{brake:v.ctrl.brake},wheels:v.wheels.map(w=>({spinAngle:w.spinAngle,omega:w.omega,steer:w.steer,comp:w.comp,contact:w.contact}))};}

/** Owns all membership and physics state. Its clock is injectable for deterministic simulation. */
export class RoomEngine {
  constructor({now=Date.now,maxRooms=100,maxPeers=512}={}){this.now=now;this.maxRooms=maxRooms;this.maxPeers=maxPeers;this.peers=new Map();this.rooms=new Map();this.tokens=new Map();}
  connect(send){if(this.peers.size>=this.maxPeers)throw Error('Server is full');const id=randomUUID();this.peers.set(id,{id,send,member:null,pending:null,protocolVersion:1});this.send(id,{type:'hello',id,protocolVersion:2,serverTime:this.now()});return id;}
  send(id,m){const peer=this.peers.get(id);if(peer)peer.send(m);}
  globals(room){setTrackWidth(room.roadHalf);setWeatherGrip(room.config.weather==='rain'?.7:1);}
  roomState(room,self){return{code:room.code,name:room.name,ownerId:room.ownerId,config:{...room.config},phase:room.phase,countdownEndsAt:room.countdownEndsAt,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,car:p.car,paint:p.paint,ready:p.ready,connected:!!p.peer})),pendingRequests:self===room.ownerId?[...room.pending.values()].map(p=>({id:p.id,name:p.name,car:p.car})):[]};}
  resetInput(p,reason='safety'){p.resetReason=reason;p.inputEpoch=(p.inputEpoch??-1)+1;p.lastReceivedFrame=-1;p.lastProcessedFrame=-1;p.pendingFrames=[];p.simulationBudget=0;p.safety=true;}
  broadcast(room){const standingsKey=room.phase+'|'+[...room.players.values()].filter(p=>p.finished).map(p=>p.id).join(',');if(standingsKey!==room.standingsKey){room.standingsKey=standingsKey;room.standingsRevision=(room.standingsRevision??0)+1;}for(const p of room.players.values())if(p.peer)this.send(p.peer,{type:'room',room:this.roomState(room,p.id)});}
  join(room,peer,details){const p={...details,id:randomUUID(),token:token(),peer:peer.id,ready:false,seq:-1,lastInput:0,parked:true,controls:idle(),finished:false,finishTime:null,disconnectedAt:null};this.resetInput(p,'join');p.framed=false;this.globals(room);p.session=new Session(room.config.route,p.car);p.session.vehicle.auto=p.auto;
    const slot=room.players.size;p.session.vehicle.reset(180-slot*8);p.session.laps.reset(p.session.vehicle.trackS);
    for(let i=0;i<120;i++)p.session.vehicle.step(1/240);
    room.players.set(p.id,p);if(!room.ownerId)room.ownerId=p.id;peer.member={room,p};peer.pending=null;this.tokens.set(p.token,{room,p});this.send(peer.id,{type:'joined',selfId:p.id,token:p.token,room:this.roomState(room,p.id)});this.broadcast(room);return p;}
  ownerTransfer(room){const owner=room.players.get(room.ownerId);if(owner?.peer)return;room.ownerId=[...room.players.values()].find(p=>p.peer)?.id??room.players.keys().next().value??null;}
  remove(room,p){this.tokens.delete(p.token);room.players.delete(p.id);if(p.peer){const peer=this.peers.get(p.peer);if(peer)peer.member=null;this.send(p.peer,{type:'left'});}this.ownerTransfer(room);if(!room.players.size){for(const request of room.pending.values()){const peer=this.peers.get(request.peer);if(peer)peer.pending=null;this.send(request.peer,{type:'rejected',message:'Lobby closed'});}this.rooms.delete(room.code);}else this.broadcast(room);}
  clearPending(peer){if(!peer.pending)return;const room=this.rooms.get(peer.pending.code);room?.pending.delete(peer.pending.id);peer.pending=null;if(room)this.broadcast(room);}
  disconnect(id){const peer=this.peers.get(id);if(!peer)return;this.clearPending(peer);if(peer.member){const{room,p}=peer.member;if(room.phase==='countdown'&&room.countdownEntrants?.includes(p.id))room.countdownInterrupted=true;p.peer=null;p.disconnectedAt=this.now();p.controls=braking();p.parked=true;p.ready=false;if(p.framed&&!p.safety)this.resetInput(p);this.ownerTransfer(room);this.broadcast(room);}this.peers.delete(id);}
  grid(room){room.countdownInterrupted=false;room.countdownEntrants=null;this.globals(room);let i=0;for(const p of room.players.values()){this.resetInput(p,'grid');p.session=new Session(room.config.route,p.car);const v=p.session.vehicle;const s=room.config.mode==='free'?180-i*8:v.track.total-12-i*8;v.reset(s);v.auto=p.auto;p.session.laps=new LapTimer(v.track.total,v.trackS);p.session.laps.armed=false;p.controls=idle();p.parked=true;p.finished=false;p.finishTime=null;p.seq=-1;p.lastInput=0;p.ready=false;i++;}}
  message(id,m){const peer=this.peers.get(id);if(!peer)return;try{if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.type!=='string')throw Error('Invalid message');
    if(m.type==='protocol'){if(m.version!==2)throw Error('Unsupported protocol version');peer.protocolVersion=2;return;}
    if(m.type==='ping'){if(typeof m.clientTime!=='number'||!Number.isFinite(m.clientTime))throw Error('Invalid ping');this.send(id,{type:'pong',clientTime:m.clientTime,serverTime:this.now()});return;}
    if(m.type==='list'){this.send(id,{type:'lobbies',lobbies:[...this.rooms.values()].map(r=>({code:r.code,name:r.name,ownerName:r.players.get(r.ownerId)?.name??'',players:r.players.size,maxPlayers:MAX_PLAYERS,mode:r.config.mode,route:r.config.route,phase:r.phase}))});return;}
    if(m.type==='leave'){this.clearPending(peer);if(peer.member)this.remove(peer.member.room,peer.member.p);else this.send(id,{type:'left'});return;}
    if(m.type==='resume'){if(peer.member||peer.pending)throw Error('Leave your current lobby first');if(typeof m.token!=='string'||m.token.length>100)throw Error('Invalid resume token');const membership=this.tokens.get(m.token);if(!membership||membership.p.peer||this.now()-membership.p.disconnectedAt>=GRACE)throw Error('Session expired');const{room,p}=membership;this.tokens.delete(p.token);p.token=token();this.tokens.set(p.token,membership);p.peer=id;p.disconnectedAt=null;p.seq=-1;p.lastInput=0;p.parked=true;p.controls=idle();this.resetInput(p,'resume');p.framed=false;peer.member=membership;this.send(id,{type:'joined',selfId:p.id,token:p.token,room:this.roomState(room,p.id)});this.broadcast(room);return;}
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
      case 'start':{const players=[...room.players.values()];if(room.config.mode!=='race'||room.phase!=='lobby'||players.filter(p=>p.peer).length<2)throw Error('At least two connected, ready drivers are required');if(players.some(p=>!p.peer))throw Error('Wait for disconnected drivers to reconnect or remove them before starting');if(players.some(p=>!p.ready))throw Error('Every driver must be ready before starting');this.grid(room);room.countdownEntrants=players.map(p=>p.id);room.phase='countdown';room.countdownEndsAt=this.now()+5000;this.broadcast(room);return;}
      case 'cancel':if(room.config.mode!=='race')throw Error('No race to cancel');room.phase='lobby';room.countdownEndsAt=null;room.raceStartedAt=null;this.grid(room);this.broadcast(room);return;
      case 'input':{
        if(peer.protocolVersion===2&&Number.isSafeInteger(m.epoch)&&m.epoch!==p.inputEpoch)return;
        if(!Number.isSafeInteger(m.seq)||m.seq<0||m.seq<=p.seq)throw Error('Invalid input sequence');
        if(typeof m.parked!=='boolean'||typeof m.auto!=='boolean')throw Error('Invalid input');
        const c=controls(m.controls);let batch=null;
        if(peer.protocolVersion===2&&m.frames!==undefined){
          if(!Number.isSafeInteger(m.epoch)||m.epoch!==p.inputEpoch)throw Error('Invalid input epoch');
          if(!Array.isArray(m.frames)||m.frames.length>15||p.pendingFrames.length+m.frames.length>120)throw Error('Invalid frame batch');
          batch=m.frames.map((f,i)=>{if(!f||!Number.isSafeInteger(f.seq)||f.seq!==p.lastReceivedFrame+1+i||typeof f.auto!=='boolean'||typeof f.tc!=='boolean'||typeof f.abs!=='boolean'||!Array.isArray(f.shifts)||f.shifts.length>2||!f.shifts.every(s=>oneOf(s,['up','down'])))throw Error('Invalid input frame');return{seq:f.seq,controls:controls(f.controls),auto:f.auto,tc:f.tc,abs:f.abs,shifts:[...f.shifts]};});
        }else if(p.framed&&peer.protocolVersion===2)throw Error('Frame batch required');
        p.seq=m.seq;p.lastInput=this.now();p.parked=m.parked;p.auto=m.auto;p.controls=c;
        if(batch){if(batch.length){p.framed=true;p.pendingFrames.push(...batch);p.lastReceivedFrame=batch.at(-1).seq;}}else if(peer.protocolVersion!==2)p.session.vehicle.auto=m.auto;
        return;}
      case 'transmission':if(peer.protocolVersion===2&&p.framed)return;if(typeof m.auto!=='boolean')throw Error('Invalid gearbox');p.auto=m.auto;p.session.vehicle.auto=m.auto;return;
      case 'assists':if(peer.protocolVersion===2&&p.framed)return;if(typeof m.tc!=='boolean'||typeof m.abs!=='boolean')throw Error('Invalid assists');p.session.vehicle.tc=m.tc;p.session.vehicle.abs=m.abs;return;
      case 'shift':if(peer.protocolVersion===2&&p.framed)return;if(p.auto||room.phase==='countdown'||room.phase==='finished'||p.parked||!oneOf(m.direction,['up','down']))throw Error('Cannot shift now');p.session.vehicle[m.direction==='up'?'shiftUp':'shiftDown']();return;
      case 'recover':if(room.config.mode==='race'&&room.phase!=='lobby')throw Error('Recovery is disabled during races');this.globals(room);p.session.reset();p.controls=idle();this.resetInput(p,'recover');return;
      default:throw Error('Unknown message type');
    }
  }catch(error){this.send(id,{type:'error',message:error.message});}}
  tick(dt=1/60){const now=this.now();for(const room of this.rooms.values()){
    for(const p of [...room.players.values()])if(!p.peer&&now-p.disconnectedAt>=GRACE)this.remove(room,p);
    if(!this.rooms.has(room.code))continue;
    for(const request of [...room.pending.values()])if(now-request.createdAt>60000){room.pending.delete(request.id);const peer=this.peers.get(request.peer);if(peer)peer.pending=null;this.send(request.peer,{type:'rejected',message:'Request expired'});this.broadcast(room);}
    // The ready grid is valid only while every entrant remains connected.
    // Check before the deadline, including a leave on the final countdown tick.
    if(room.phase==='countdown'&&(room.countdownInterrupted||room.players.size<2||(room.countdownEntrants??[...room.players.keys()]).some(id=>!room.players.get(id)?.peer))){room.phase='lobby';room.countdownEndsAt=null;room.raceStartedAt=null;this.grid(room);this.broadcast(room);}
    if(room.phase==='countdown'&&now>=room.countdownEndsAt){room.phase='running';room.raceStartedAt=room.countdownEndsAt;room.countdownEndsAt=null;room.countdownEntrants=null;for(const p of room.players.values())this.resetInput(p,'running');this.broadcast(room);}
    this.globals(room);
    for(const p of room.players.values()){
      const race=room.config.mode==='race',v2=p.framed||this.peers.get(p.peer)?.protocolVersion===2;
      const safe=!p.peer||p.parked||now-p.lastInput>500||p.finished;
      if(v2){
        if(safe&&!p.safety)this.resetInput(p);
        if(safe){p.pendingFrames=[];p.simulationBudget=0;}
        p.safety=safe;
        if(room.phase==='countdown'||room.phase==='finished'||(race&&room.phase==='lobby')){p.pendingFrames=[];p.simulationBudget=0;continue;}
        if(!safe&&p.framed){p.simulationBudget=Math.min(.12,p.simulationBudget+Math.max(0,Math.min(.12,Number.isFinite(dt)?dt:0)));while(p.pendingFrames.length&&p.simulationBudget+1e-10>=INPUT_DT){const f=p.pendingFrames.shift();applyInputFrame(p.session,f);p.lastProcessedFrame=f.seq;p.simulationBudget=Math.max(0,p.simulationBudget-INPUT_DT);}}
        else if(safe&&p.framed){const v=p.session.vehicle,auto=v.auto;v.auto=false;p.session.reverseHold=0;if(v.gear===-1)v.gear=1;p.session.advance(Math.max(0,Math.min(.12,dt)),braking());v.auto=auto;}
      }else{
        if(room.phase==='countdown'||room.phase==='finished'||(race&&room.phase==='lobby'))continue;
        if(safe&&(!race||room.phase==='lobby')){p.session.vehicle.ctrl=idle();p.session.vehicle.vel.set(0,0,0);p.session.vehicle.angVel.set(0,0,0);p.session.vehicle.rpm=p.session.vehicle.spec.engine.idle;for(const w of p.session.vehicle.wheels)w.omega=0;p.session.accumulator=0;continue;}
        const v=p.session.vehicle;
        if(safe){const auto=v.auto;v.auto=false;p.session.reverseHold=0;if(v.gear===-1)v.gear=1;p.session.advance(dt,braking());v.auto=auto;}else p.session.advance(dt,p.controls);
      }
      const session=p.session;
      if(race&&room.phase==='running'&&!p.finished&&session.laps.completed>=room.config.laps){p.finished=true;p.finishTime=(now-room.raceStartedAt)/1000;this.broadcast(room);}
    }
    if(room.config.mode==='race'&&room.phase==='running'&&[...room.players.values()].length&&[...room.players.values()].every(p=>p.finished)){room.phase='finished';this.broadcast(room);}
  }}
  snapshots(){for(const room of this.rooms.values()){
    const players=[...room.players.values()],connected=players.filter(p=>p.peer),hasLegacy=connected.some(p=>this.peers.get(p.peer)?.protocolVersion!==2),hasModern=connected.some(p=>this.peers.get(p.peer)?.protocolVersion===2);
    const standings=players.map(p=>({id:p.id,name:p.name,lap:p.session.laps.completed,progress:p.session.laps.progress,finished:p.finished,time:p.finishTime})).sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.time-b.time:(b.lap-a.lap)||b.progress-a.progress)).map((p,i)=>({...p,position:i+1}));
    const common={type:'snapshot',serverTime:this.now(),code:room.code,phase:room.phase,countdownEndsAt:room.countdownEndsAt};
    // Build shared remote state once, and skip legacy full-state work entirely
    // when every member has negotiated prediction-aware snapshots.
    const compact=hasModern?players.map(p=>({id:p.id,car:p.car,paint:p.paint,epoch:p.inputEpoch,state:compactState(p.session.vehicle)})):null;
    const legacy=hasLegacy?{...common,players:players.map(p=>({id:p.id,car:p.car,paint:p.paint,state:vehicleState(p.session.vehicle),laps:{completed:p.session.laps.completed,current:p.session.laps.current,last:p.session.laps.last,best:p.session.laps.best,progress:p.session.laps.progress,armed:p.session.laps.armed},finished:p.finished,finishTime:p.finishTime})),standings}:null;
    for(const p of connected){const peer=this.peers.get(p.peer);if(peer.protocolVersion!==2){this.send(p.peer,legacy);continue;}
      const packet={...common,version:2,self:{id:p.id,ack:{epoch:p.inputEpoch,frame:p.lastProcessedFrame,reason:p.resetReason},simulation:captureSession(p.session),finished:p.finished,finishTime:p.finishTime},players:compact.filter(other=>other.id!==p.id)};
      if(peer.standingsRevision!==room.standingsRevision||peer.lastStandingsAt===undefined||this.now()-peer.lastStandingsAt>=500){packet.standings=standings;peer.standingsRevision=room.standingsRevision;peer.lastStandingsAt=this.now();}this.send(p.peer,packet);
    }
  }}
}
