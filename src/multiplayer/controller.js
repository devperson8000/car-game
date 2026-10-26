import {LocalPrediction} from './local-prediction.js';
import {PresentationPose} from './presentation.js';
import {InputPump} from './input-pump.js';
import {LobbyClient} from './client.js';
import {LobbyUI} from './lobby-ui.js';
import {RemoteCars} from './remote-cars.js';
import {applyVehicleState} from './state.js';
import {savePreference} from '../preferences.js';
import {setWeatherGrip} from '../vendor/physics.js';
import './game.css';
const $=id=>document.getElementById(id);
const TOKEN_KEY='apex-online-session';
function readResume(){try{return JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null');}catch{return null;}}
function writeResume(value){try{if(value)sessionStorage.setItem(TOKEN_KEY,JSON.stringify(value));else sessionStorage.removeItem(TOKEN_KEY);}catch{/* Reconnection still works in memory. */}}
function serverURL(){const configured=import.meta.env.VITE_MULTIPLAYER_URL;if(configured)return configured;return ['localhost','127.0.0.1','[::1]'].includes(location.hostname)?`ws://${location.hostname}:3001`:null;}
export class MultiplayerController{
 constructor({session,view,input,storage,car,paint,callbacks}){
  Object.assign(this,{session,view,input,storage,car,paint,callbacks});this.joined=false;this.entered=false;this.room=null;this.selfId=null;this.pending=false;this.sendClock=0;this.seq=0;this.remote=new RemoteCars(view);this.lastControls={steer:0,throttle:0,brake:0,handbrake:false};
  this.protocol=1;this.desiredAssists={tc:session.vehicle.tc,abs:session.vehicle.abs};this.presentation=new PresentationPose();this.prediction=new LocalPrediction(session,{sample:(dt,v)=>input.sample(dt,v),auto:()=>$('gearbox').value==='auto',assists:()=>this.desiredAssists});
  this.predictionTimer=setInterval(()=>this.prediction.advance(performance.now(),this.protocol===2&&this.joined&&this.client?.connected&&this.entered&&callbacks.isDriving()&&this.snapshot?.phase==='running'&&!this.ownFinished),1000/60);
  this.url=serverURL();this.client=this.url?new LobbyClient(this.url):null;
  this.ui=new LobbyUI({onOpen:()=>this.open(),onClose:()=>{if(this.wasDriving&&!this.joined){this.wasDriving=false;callbacks.resume();}},onCreate:data=>this.send({type:'create',...data,laps:Number(data.laps),...this.identity()}),onRequest:data=>this.send({type:'request',...data,...this.identity()}),onApprove:data=>this.send({type:'approve',...data}),onReady:data=>this.send({type:'ready',...data}),onStart:()=>this.send({type:'start'}),onCancel:()=>this.send({type:'cancel'}),onKick:data=>this.send({type:'kick',...data}),onConfigure:data=>this.send({type:'configure',...data,laps:Number(data.laps)}),onLeave:()=>this.leave(),onEnter:()=>this.enter()});
  this.ui.setAvailable(!!this.client);this.hud=document.createElement('div');this.hud.id='online-hud';this.hud.hidden=true;this.hud.setAttribute('aria-label','Online session');document.body.append(this.hud);this.countdown=document.createElement('div');this.countdown.id='online-countdown';this.countdown.hidden=true;this.countdown.setAttribute('role','status');document.body.append(this.countdown);
  if(this.client){this.client.addEventListener('message',e=>this.message(e.detail));this.client.addEventListener('status',e=>{const {state,message}=e.detail;this.ui.setStatus(message||({connecting:'Connecting to live sessions…',connected:'Connected. Create a lobby or request to join.',reconnecting:'Connection interrupted. Rejoining your lobby…',disconnected:'Live multiplayer is disconnected. Solo driving is available.'})[state]);if(this.joined&&state!=='connected'){callbacks.pause();this.ui.open();}});
   const saved=readResume();if(saved?.url===this.url&&typeof saved.token==='string'){this.savedEntered=!!saved.entered;this.client.setResumeToken(saved.token);this.ui.open();this.connect();}
  }
  this.inputPump=new InputPump(()=>{if(!this.joined||!this.client?.connected)return null;const input={controls:this.protocol===2?this.prediction.lastControls:this.lastControls,parked:!this.entered||!this.callbacks.isDriving()||this.protocol===2&&this.prediction.blocked,auto:$('gearbox').value==='auto'};if(this.protocol===2&&this.prediction.ready){input.epoch=this.prediction.epoch;input.frames=this.prediction.batch();}return input;},message=>{if(this.send(message)&&message.frames)this.prediction.markSent(message.frames);});
 }
 identity(){return {car:this.car.id,auto:$('gearbox').value==='auto',paint:$('paint').value||this.paint};}
 async connect(){if(!this.client)return;try{await this.client.connect();if(!this.joined)this.client.send({type:'list'});}catch(e){this.ui.setError(e.message);}}
 open(){this.wasDriving=this.callbacks.isDriving();this.callbacks.pause();this.input.clear();if(this.client)this.connect();}
 send(message){if(!this.client?.connected){this.ui.setError('Connect to live multiplayer before continuing.');return false;}try{return this.client.send(message)!==false;}catch(e){this.ui.setError(e.message);return false;}}
 lock(value){for(const id of ['car-select','route','lighting','paint'])$(id).disabled=value;}
 remember(){if(this.token)writeResume({url:this.url,token:this.token,entered:this.entered});}
 settings(room){const config=room.config,self=room.players.find(p=>p.id===this.selfId);if(config.route!==this.session.route||self&&self.car!==this.car.id){savePreference(this.storage,'route',config.route);if(self)savePreference(this.storage,'car',self.car);this.remember();location.reload();return false;}
  if(this.view.weather!==config.weather){$('lighting').value=config.weather;this.view.setWeather(config.weather);setWeatherGrip(config.weather==='rain'?.7:1);$('weather-text').textContent=config.weather==='rain'?'12°C · WET TARMAC':'18°C · DRY TARMAC';}return true;}
 message(message){
  if(message.type==='hello'&&message.protocolVersion>=2){this.protocol=2;this.send({type:'protocol',version:2});}
  if(message.type==='lobbies')this.ui.setLobbies(message.lobbies||[]);
  if(message.type==='pending'){this.pending=true;this.ui.setPending(message.code);}
  if(message.type==='joined'){this.pending=false;this.prediction.reset();this.presentation.reset();this.joined=true;this.selfId=message.selfId;this.token=message.token;this.client.setResumeToken(this.token);this.entered=this.savedEntered||false;this.savedEntered=false;this.remember();this.lock(true);this.room=message.room;if(!this.settings(this.room))return;this.ui.setRoom(this.room,this.selfId);this.ui.setStatus('You are in. Enter the track when ready.');if(this.entered)this.enter();}
  if(message.type==='room'){const previous=this.room?.phase;this.room=message.room;if(!this.joined||!this.settings(this.room))return;this.ui.setRoom(this.room,this.selfId);if(this.room.phase==='countdown'&&previous!=='countdown'){this.view.snap=true;this.enter();}}
  if(message.type==='snapshot'&&this.joined){
   this.snapshot={...message,standings:message.standings||this.snapshot?.standings||[]};const own=message.players.find(p=>p.id===this.selfId);
   if(message.self?.simulation){this.protocol=2;this.ownFinished=!!message.self.finished;const correction=this.prediction.reconcile(message.self.simulation,message.self.ack,performance.now());if(correction){const snap=correction.first||correction.epochChanged&&['grid','recover','running','join'].includes(correction.reason);this.presentation.correct(correction.before,correction.after,{snap});if(snap)this.view.snap=true;}}
   else if(own&&this.protocol!==2){this.ownFinished=!!own.finished;const before={position:this.session.vehicle.pos.clone(),quaternion:this.session.vehicle.quat.clone()},active=this.entered&&this.callbacks.isDriving()&&message.phase==='running';applyVehicleState(this.session.vehicle,own.state,{blend:active});this.presentation.correct(before,{position:this.session.vehicle.pos,quaternion:this.session.vehicle.quat});if(own.laps)for(const key of ['completed','current','last','best','progress','armed'])if(own.laps[key]!==undefined)this.session.laps[key]=own.laps[key];}
   this.remote.sync(message.players,this.selfId,message.serverTime,this.room?.players||[]);if(this.ui.dialog.open&&performance.now()-(this.lastStandingsUpdate||0)>250){this.ui.setStandings(this.snapshot);this.lastStandingsUpdate=performance.now();}
  }
  if(message.type==='left'||message.type==='rejected'){this.clear();if(message.type==='rejected')this.ui.setError(message.message||'The lobby owner declined this request.');}
  if(message.type==='error'){if(['Session expired','Invalid resume token'].includes(message.message))this.clear();this.ui.setError(message.message||'Unable to complete this lobby action.');this.callbacks.notify?.(message.message||'Unable to complete this lobby action.');if(!this.joined&&readResume()){writeResume(null);this.client?.setResumeToken(null);}}
 }
 enter(){if(!this.joined||!this.client?.connected)return;this.entered=true;this.wasDriving=false;this.remember();this.ui.close();this.callbacks.enter();}
 setTransmission(auto){if(this.joined&&this.protocol!==2)this.send({type:'transmission',auto});}
 setAssists(tc,abs){this.desiredAssists={tc,abs};if(this.joined&&this.protocol!==2)this.send({type:'assists',tc,abs});}
 beginDriving(){if(this.joined){this.entered=true;this.remember();}}
 canDrive(){return !this.joined||!!this.client?.connected;}
 action(code){if(!this.joined)return false;if(code==='KeyE'||code==='KeyQ'){if($('gearbox').value==='auto'){this.callbacks.notify?.('Select Manual (M) to shift with Q / E.');return true;}if(this.callbacks.isDriving()){const direction=code==='KeyE'?'up':'down';if(this.protocol===2)this.prediction.queueShift(direction);else this.send({type:'shift',direction});}return true;}if(code==='KeyR'){this.send({type:'recover'});return true;}return false;}
 advance(dt,controls,parked){if(!this.joined)return false;if(this.protocol===2)return true;this.lastControls=controls;
  if(this.client?.connected&&this.entered&&!parked&&this.snapshot?.phase==='running'&&!this.ownFinished){this.session.paused=false;this.session.advance(dt,controls);}return true;}
 render(dt=1/60){this.remote.render();if(this.joined){const base=this.protocol===2&&this.prediction.ready?this.prediction.pose(performance.now()):{position:this.session.vehicle.pos,quaternion:this.session.vehicle.quat};this.view.presentationPose=this.presentation.update(base,dt);}this.hud.hidden=!this.joined;this.countdown.hidden=true;if(!this.joined||!this.room)return;const own=this.snapshot?.standings?.find(p=>p.id===this.selfId),mode=this.room.config.mode==='race'?'RACE':'FREE DRIVE';const caption=`${mode} · ${this.room.code} · ${this.room.players.length}/8${own&&this.room.config.mode==='race'?` · P${own.position} · LAP ${Math.min(this.room.config.laps,(own.lap||0)+1)}/${this.room.config.laps}`:''}${Number.isFinite(this.client?.latency)?` · ${this.client.latency} ms`:''}`;
  if(this.hud.textContent!==caption)this.hud.textContent=caption;const phase=this.snapshot?.phase||this.room.phase;if(phase==='countdown'){this.countdown.hidden=false;const offset=this.remote.clock?.offset||Date.now()-performance.now(),end=this.snapshot?.countdownEndsAt||this.room.countdownEndsAt;this.countdown.textContent=String(Math.max(1,Math.ceil((end-performance.now()-offset)/1000)));}else if(phase==='lobby'&&this.room.config.mode==='race'){this.countdown.hidden=false;this.countdown.textContent='READY UP IN THE LOBBY';}else if(phase==='finished'){this.countdown.hidden=false;this.countdown.textContent=own?.finished?`FINISHED · P${own.position}`:'RACE FINISHED';}
 }
 afterRender(){this.remote.labels();}
 leave(){if(this.client?.connected)this.send({type:'leave'});this.client?.setResumeToken(null);this.clear();}
 clear(){this.prediction.reset();this.presentation.reset();this.view.presentationPose=null;const wasJoined=this.joined;this.joined=false;this.entered=false;this.pending=false;this.token=null;this.room=null;this.snapshot=null;this.client?.setResumeToken(null);writeResume(null);this.lock(false);this.remote.clear();this.ui.setRoom(null);this.hud.hidden=true;this.countdown.hidden=true;if(wasJoined){this.wasDriving=false;this.callbacks.leave();}}
}
