import './style.css';
import {LoadingScreen} from './loading.js';
import {Session} from './sim/session.js';
import {DrivingScene} from './scene.js';
import {Controls,MOVEMENT_KEYS} from './input.js';
import {DrivingAudio} from './audio.js';
import {HUD,formatTime} from './hud.js';
import {loadPreferences,savePreference,readBestLap,saveBestLap} from './preferences.js';
import {setWeatherGrip} from './vendor/physics.js';

const $=id=>document.getElementById(id);
const loadingScreen=new LoadingScreen($('boot-screen'));
const launchRegions=[document.querySelector('header'),document.querySelector('main'),document.querySelector('footer')];
let storage;try{storage=localStorage;}catch{/* The game also works without browser storage. */}
const preferences=loadPreferences(storage),save=(key,value)=>savePreference(storage,key.replace(/^apex-/,''),value);
const route=preferences.route;$('route').value=route;
$('boot-route').textContent=route==='mountain'?'ALPINE PASS / THE SCENIC ROUTE':'NORDSCHLEIFE / THE GREEN HELL';
const session=new Session(route),audio=new DrivingAudio();let view,hud,loaded=false,started=false,paused=true,last=performance.now(),toastTimer,helpResume=false;
session.paused=true;session.laps.best=readBestLap(storage,route);audio.muted=preferences.muted;
$('sound').setAttribute('aria-pressed',String(audio.muted));$('sound').textContent=audio.muted?'Sound off':'Sound on';
const launchTitle=$('menu-title').innerHTML,launchIntro=$('menu-intro').innerHTML;let completedLaps=0;
function notify(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2300);}
function pause(value,showMenu=true){
  if(!started)return;paused=value;session.paused=value;input.clear();audio.setActive(!value);
  document.body.classList.toggle('paused',value);document.body.classList.toggle('driving',!value);
  $('menu').hidden=!value||!showMenu;$('menu').dataset.mode=value?'pause':'start';$('hud').hidden=value;
  $('menu-title').innerHTML=value?'Take a<br><em>breather.</em>':launchTitle;$('menu-intro').innerHTML=value?'Your drive is paused. Adjust your setup, then pick up where you left off.':launchIntro;
  $('drive').querySelector('span').textContent='RESUME DRIVE';$('pause').textContent=value?'Resume':'Pause';last=performance.now();
  if(view)view.snap=true;
  if(!value)view?.renderer.domElement.focus({preventScroll:true});
}
const input=new Controls(code=>{
  if(!loaded||$('help-dialog').open)return;
  if(MOVEMENT_KEYS.has(code)&&loaded&&(!started||paused)){startDrive(code);return;}
  if(code==='KeyF')toggleFullscreen();
  if(code==='KeyC')changeCamera();
  if(code==='KeyR'&&loaded){session.reset();input.clear();view.snap=true;notify('Recovered to the circuit · lap restarted');}
  if(['Escape','KeyP'].includes(code)&&started&&!$('help-dialog').open)pause(!paused);
  if(code==='KeyM'){session.vehicle.auto=!session.vehicle.auto;notify(session.vehicle.auto?'Automatic gearbox':'Manual · E upshift / Q downshift');}
  if(code==='KeyE')session.vehicle.shiftUp();if(code==='KeyQ')session.vehicle.shiftDown();
});
function changeCamera(){if(!view||!loaded)return;view.cameraMode=(view.cameraMode+1)%3;view.snap=true;save('apex-camera',view.cameraMode);$('camera').innerHTML=`${['Chase','Cockpit','Hood'][view.cameraMode]} <small>C</small>`;}
async function enableAudio(){
  try{await audio.start(session.vehicle.spec);audio.setActive(!paused);$('audio-status').dataset.state='ready';$('audio-status').textContent='V8 AUDIO';}
  catch(e){$('audio-status').dataset.state='failed';$('audio-status').textContent='AUDIO UNAVAILABLE';notify('Audio unavailable. Press Sound to retry.');console.warn('Audio initialization:',e.message);}
}
function startDrive(triggerKey){
  if(!loaded)return;
  if(!started){started=true;document.body.classList.add('started');$('load-percent').textContent='';}
  pause(false);
  // Resuming clears stale inputs, but keep the key that started this drive.
  if(triggerKey)input.keys.add(triggerKey);
  enableAudio();
}
$('drive').addEventListener('click',()=>startDrive());
$('camera').onclick=changeCamera;$('pause').onclick=()=>pause(!paused);
$('reset').onclick=()=>{if(!loaded)return;session.reset();view.snap=true;input.clear();notify('Recovered to the circuit · lap restarted');};
$('sound').onclick=()=>{audio.muted=!audio.muted;save('apex-muted',audio.muted);$('sound').setAttribute('aria-pressed',String(audio.muted));$('sound').textContent=audio.muted?'Sound off':'Sound on';if(!audio.ready&&!audio.muted)enableAudio();};
$('tc').onclick=()=>session.vehicle.tc=!session.vehicle.tc;$('abs').onclick=()=>session.vehicle.abs=!session.vehicle.abs;
$('quality').value=preferences.quality;$('quality').onchange=e=>{save('apex-quality',e.target.value);view?.setQuality(e.target.value);};
$('paint').value=preferences.paint;$('paint').oninput=e=>{save('apex-paint',e.target.value);view?.car?.setPaint(e.target.value);};
$('lighting').innerHTML+='<option value="rain">Wet road</option>';
$('lighting').value=preferences.light;
$('lighting').onchange=e=>{save('apex-light',e.target.value);view?.setWeather(e.target.value);setWeatherGrip(e.target.value==='rain'?.7:1);$('weather-text').textContent=e.target.value==='rain'?'12°C · WET TARMAC':'18°C · DRY TARMAC';};
$('route').onchange=e=>{save('apex-route',e.target.value);location.reload();};
$('retry').onclick=()=>location.reload();
$('controls').onclick=()=>{helpResume=started&&!paused;if(helpResume)pause(true,false);$('help-dialog').showModal();};
$('close-help').onclick=()=>$('help-dialog').close();$('help-dialog').addEventListener('close',()=>{if(helpResume)pause(false);helpResume=false;});
$('show-touch').onchange=e=>{document.body.classList.toggle('touch',e.target.checked);save('apex-touch',e.target.checked);};
const touch=preferences.touch??matchMedia('(pointer: coarse)').matches;document.body.classList.toggle('touch',touch);$('show-touch').checked=touch;
async function toggleFullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{notify('Fullscreen is unavailable in this browser.');}
}
$('fullscreen').onclick=toggleFullscreen;
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';$('fullscreen').setAttribute('aria-pressed',String(!!document.fullscreenElement));});
if(!document.fullscreenEnabled)$('fullscreen').hidden=true;
addEventListener('blur',()=>{if(started&&!paused)pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)pause(true);});

async function bootstrap(){
  try{
    view=new DrivingScene($('viewport'),session);
    await view.load((percent,message)=>{loadingScreen.update(Math.min(percent,99),message);$('load-progress').style.width=`${percent}%`;$('load-percent').textContent=`${percent}%`;$('loading-status').textContent=message;});
    hud=new HUD(session);view.cameraMode=preferences.camera;$('camera').innerHTML=`${['Chase','Cockpit','Hood'][preferences.camera]} <small>C</small>`;view.setQuality($('quality').value);view.car.setPaint($('paint').value);$('lighting').onchange({target:$('lighting')});
    // Present the first real scene behind the fade, then enable driving inputs.
    view.update(0,false);
    await loadingScreen.finish();
    launchRegions.forEach(region=>region.inert=false);
    loaded=true;$('drive').disabled=false;$('drive').querySelector('span').textContent='START YOUR ENGINE';hud.update();
    $('loading-status').textContent='Ready. Press W / ↑ or click Start your engine.';
    view.renderer.domElement.addEventListener('pointerdown',()=>{if(!$('help-dialog').open&&(!started||paused))startDrive();});
  }catch(e){console.error(e);$('loading-status').textContent=/WebGL|context/i.test(e.message)?'WebGL 2 is required. Enable hardware acceleration or try another browser.':'Unable to load the simulator. Check your connection and retry.';$('loading-status').classList.add('error');$('retry').hidden=false;$('load-percent').textContent='';loadingScreen.fail($('loading-status').textContent);}
}
let hudElapsed=0,statsElapsed=0,frames=0;
function frame(now){
  requestAnimationFrame(frame);const realDt=Math.max(0,(now-last)/1000),dt=Math.min(.1,realDt);last=now;
  if(!loaded)return;
  if(started&&!paused){session.advance(dt,input.sample(dt,session.vehicle));audio.update(session.vehicle,view.weather);
    if(session.vehicle.rollover||session.vehicle.pos.y< -200){session.reset();view.snap=true;notify('Car recovered');}
  }
  if(session.laps.completed>completedLaps){
    completedLaps=session.laps.completed;session.laps.best=saveBestLap(storage,route,session.laps.best);
    notify(`${session.laps.last===session.laps.best?'Personal best':'Lap complete'} · ${formatTime(session.laps.last)}`);
  }
  view.update(dt,started&&!paused);
  hudElapsed+=dt;if(hudElapsed>.09){hud.update();hudElapsed=0;}
  statsElapsed+=realDt;frames++;if(statsElapsed>1){$('fps-label').textContent=`${Math.round(frames/statsElapsed)} FPS`;$('fps-label').title=`${view.renderer.info.render.calls} draw calls · ${view.renderer.info.render.triangles.toLocaleString()} triangles`;frames=0;statsElapsed=0;}
}
bootstrap();requestAnimationFrame(frame);
