import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {DrivingPhysics} from './physics.js';
import {createTrackWorld,loadTrack} from './track.js';
import {createCar} from './car.js';
import {EngineAudio} from './audio.js';

const $=id=>document.getElementById(id);
const clamp=(a,b,c)=>Math.max(b,Math.min(c,a));
const smooth=(rate,dt)=>1-Math.exp(-rate*dt);
const WEATHER=['clear','golden','rain','night'];
const CAMERAS=['CHASE','HOOD','COCKPIT'];
let track,world,car,physics=new DrivingPhysics(),audio=new EngineAudio();
let ready=false,playing=false,paused=false,requested=false,weather='clear',camMode=0,showMap=true,quality=localStorage.getItem('apex-quality')||(matchMedia('(pointer:coarse)').matches||navigator.hardwareConcurrency<=4?'low':'medium'),assist=true;
let lastFrame=performance.now(),accumulator=0,prevPadCamera=false,toastTimeout=0,lastHud=0,lastMap=0,showModel=false,cameraSnap=true;
const keys=new Set(),touch={left:false,right:false,throttle:false,brake:false};
let steerPad=0,throttlePad=0,brakePad=0,handbrakePad=false;
const renderer=new THREE.WebGLRenderer({antialias:quality==='high',powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?.8:quality==='medium'?1:1.4));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=quality==='high';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor(0x96bed4);
$('game').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x9fbbca,.00024);
const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.08,11500);
const hemi=new THREE.HemisphereLight(0xe5f3ff,0x596746,2.25);scene.add(hemi);
const ambient=new THREE.AmbientLight(0xb2cad5,.37);scene.add(ambient);
const sunlight=new THREE.DirectionalLight(0xfff4db,3.4);
sunlight.position.set(170,290,95);sunlight.castShadow=quality==='high';
sunlight.shadow.mapSize.set(quality==='high'?1024:512,quality==='high'?1024:512);
sunlight.shadow.camera.left=-95;sunlight.shadow.camera.right=95;
sunlight.shadow.camera.top=95;sunlight.shadow.camera.bottom=-95;
sunlight.shadow.camera.near=.5;sunlight.shadow.camera.far=950;
sunlight.shadow.bias=-.0003;sunlight.shadow.normalBias=.035;scene.add(sunlight,sunlight.target);
try{
 if(quality==='high'){const env=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.05);
 scene.environment=env.texture;scene.environmentIntensity=.56;}
}catch(err){console.warn('Reflections fallback:',err);}
const skyUniforms={top:{value:new THREE.Color('#548cac')},horizon:{value:new THREE.Color('#d7e5df')},bottom:{value:new THREE.Color('#829eae')},sunAngle:{value:.6}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(8200,32,16),new THREE.ShaderMaterial({
 uniforms:skyUniforms,
 vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
 fragmentShader:'varying vec3 vDir;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;void main(){float t=normalize(vDir).y;vec3 col=t>0.0?mix(horizon,top,pow(clamp(t,0.0,1.0),0.65)):mix(horizon,bottom,clamp(-t*2.0,0.0,1.0));gl_FragColor=vec4(col,1.0);}',
 side:THREE.BackSide,depthWrite:false
}));sky.renderOrder=-500;scene.add(sky);
const rainCount=540,rainGeo=new THREE.BufferGeometry(),rainPositions=new Float32Array(rainCount*6);
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xcde2e9,transparent:true,opacity:.28,depthWrite:false}));
rain.frustumCulled=false;rain.visible=false;scene.add(rain);
const drops=new Float32Array(rainCount*4);
for(let i=0;i<rainCount;i++){drops[i*4]=(Math.random()-.5)*58;drops[i*4+1]=Math.random()*23;drops[i*4+2]=(Math.random()-.5)*62;drops[i*4+3]=11+Math.random()*18;}
const gearBar=$('rpmBars');for(let i=0;i<25;i++){const b=document.createElement('i');gearBar.appendChild(b);}
const rpmSegments=[...gearBar.children];

function notify(message){
 const el=$('toast');el.textContent=message;el.style.opacity='1';
 clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.style.opacity='0',2050);
}
function progress(p,label){
 $('loadingFill').style.width=Math.min(100,p)+'%';$('loadingText').textContent=label||'LOADING';
 $('loadStatus').textContent=label||'LOADING';
 if(p>=100)setTimeout(()=>$('loading').classList.add('hidden'),700);
}
function applyWeather(){
 const configs={
  clear:['#638fac','#c5d9d4','#809bb0',0xa8bdca,.00024,1.30,3.4,2.25,0xfff2da,0],
  golden:['#d88f63','#f0c29c','#b69a82',0xd6ae8f,.00030,1.24,3.1,1.75,0xffba82,1],
  rain:['#435869','#9baeb6','#455565',0x8c9faa,.00063,.85,1.3,1.32,0xb8d7e6,2],
  night:['#071323','#1d2e45','#040c16',0x0c1b2d,.00039,.68,.16,.63,0x98b6e4,3]
 };
 const [top,mid,low,fog,density,exposure,sunPower,hemiPower,sunColor,index]=configs[weather];
 skyUniforms.top.value.set(top);skyUniforms.horizon.value.set(mid);skyUniforms.bottom.value.set(low);
 scene.fog.color.setHex(fog);scene.fog.density=density;
 renderer.toneMappingExposure=exposure;sunlight.intensity=sunPower;sunlight.color.setHex(sunColor);hemi.intensity=hemiPower;
 sunlight.position.set(index===1?-260:170,index===1?60:290,95);
 rain.visible=weather==='rain';
 $('weatherText').textContent=({clear:'CLEAR SKY',golden:'GOLDEN HOUR',rain:'WET TRACK',night:'NIGHT DRIVE'})[weather];
 notify($('weatherText').textContent);
}
function changeWeather(){weather=WEATHER[(WEATHER.indexOf(weather)+1)%WEATHER.length];applyWeather();}
function setCamera(i){camMode=(i+CAMERAS.length)%CAMERAS.length;cameraSnap=true;$('cameraName').textContent=CAMERAS[camMode];notify(CAMERAS[camMode]+' CAMERA');}
function reset(){if(!ready)return;physics.spawn(track,0);cameraSnap=true;notify('RETURNED TO THE START LINE');}
function setPause(value){
 if(!playing)return;paused=value;$('pause').classList.toggle('hidden',!paused);
 if(!paused)keys.clear();else {keys.clear();for(const k in touch)touch[k]=false;}
 if(ready)audio.update(physics,weather,paused);
}
function readGamepad(){
 const gp=[...navigator.getGamepads?.()||[]].find(p=>p&&p.connected);
 steerPad=0;throttlePad=0;brakePad=0;handbrakePad=false;
 if(!gp||paused||!playing)return;
 const d=gp.axes[0]||0;steerPad=Math.abs(d)>.1?d:0;
 throttlePad=Math.max(gp.buttons[7]?.value||0,Math.max(0,-(gp.axes[1]||0)));
 brakePad=Math.max(gp.buttons[6]?.value||0,Math.max(0,gp.axes[1]||0));
 handbrakePad=Boolean(gp.buttons[0]?.pressed);
 const camPress=Boolean(gp.buttons[3]?.pressed);if(camPress&&!prevPadCamera)setCamera(camMode+1);prevPadCamera=camPress;
}
function controls(){
 const left=keys.has('KeyA')||keys.has('ArrowLeft')||touch.left||steerPad<-.2;
 const right=keys.has('KeyD')||keys.has('ArrowRight')||touch.right||steerPad>.2;
 return {left,right,throttle:keys.has('KeyW')||keys.has('ArrowUp')||touch.throttle||throttlePad>.2,brake:keys.has('KeyS')||keys.has('ArrowDown')||touch.brake||brakePad>.2,handbrake:keys.has('Space')||handbrakePad};
}
function updateCamera(dt){
 const x=physics.x,y=physics.y,z=physics.z,yaw=physics.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw);
 const rightX=fz,rightZ=-fx;
 let cx,cy,cz,tx,ty,tz,desiredFov=64;
 if(!playing){
  const angle=performance.now()*.00010;
  cx=x+Math.sin(angle)*10+fx*2;cy=y+3.0;cz=z+Math.cos(angle)*10+fz*2;
  tx=x;ty=y+1.15;tz=z;desiredFov=58;
 }else if(camMode===0){
  const v=Math.abs(physics.speed);
  const back=8+Math.min(4,v*.05),height=3.5+v*.014;
  cx=x-fx*back+rightX*physics.steer*.12;
  const behind=(physics.nearest-Math.max(3,Math.round(back/track.step))+track.points.length)%track.points.length;
  cy=Math.max(y+height,track.points[behind][1]+2.3);
  cz=z-fz*back+rightZ*physics.steer*.12;
  tx=x+fx*(4+v*.025);ty=y+1.65;tz=z+fz*(4+v*.025);desiredFov=clamp(64+v*.18,64,80);
 }else if(camMode===1){
  // The bonnet camera is mounted to the vehicle, not smoothed through its body.
  car.suspension.updateWorldMatrix(true,false);
  const eye=car.suspension.localToWorld(new THREE.Vector3(0,1.44,2.04));
  const aim=car.suspension.localToWorld(new THREE.Vector3(0,1.38,32));
  cx=eye.x;cy=eye.y;cz=eye.z;tx=aim.x;ty=aim.y;tz=aim.z;desiredFov=71;
 }else{
  // Driver's eye below the roof, rigidly aligned to the moving cabin.
  car.suspension.updateWorldMatrix(true,false);
  const eye=car.suspension.localToWorld(new THREE.Vector3(0,1.34,.28));
  const aim=car.suspension.localToWorld(new THREE.Vector3(0,1.22,30));
  cx=eye.x;cy=eye.y;cz=eye.z;tx=aim.x;ty=aim.y;tz=aim.z;desiredFov=71;
 }
 const targetPosition=new THREE.Vector3(cx,cy,cz);
 // Snap between views and on respawn rather than flying through the model.
 if(cameraSnap||(playing&&camMode!==0)||camera.position.distanceToSquared(targetPosition)>28*28){
  camera.position.copy(targetPosition);cameraSnap=false;
 }else{
  camera.position.lerp(targetPosition,smooth(!playing?3:9.0,dt));
 }
 camera.lookAt(tx,ty,tz);
 // Body-mounted cameras already inherit pitch and roll.
 const fov=THREE.MathUtils.lerp(camera.fov,desiredFov,smooth(4,dt));
 if(Math.abs(camera.fov-fov)>.001){camera.fov=fov;camera.updateProjectionMatrix();}
 sky.position.copy(camera.position);
}
function updateRain(dt){
 if(!rain.visible)return;
 const arr=rainGeo.attributes.position.array;
 for(let i=0;i<rainCount;i++){
  let k=i*4;drops[k+1]-=drops[k+3]*dt;if(drops[k+1]<-1)drops[k+1]=22;
  const a=i*6,x=physics.x+drops[k],y=physics.y+drops[k+1],z=physics.z+drops[k+2];
  arr[a]=x;arr[a+1]=y;arr[a+2]=z;arr[a+3]=x-.08;arr[a+4]=y-.85;arr[a+5]=z-.16;
 }
 rainGeo.attributes.position.needsUpdate=true;
}
function drawMap(){
 if(!track||!world)return;const canvas=$('minimap'),ctx=canvas.getContext('2d');if(!ctx)return;
 const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
 const pts=track.points,b=world.bounds,dx=b.xmax-b.xmin,dz=b.zmax-b.zmin,scale=Math.min((W-30)/dx,(H-22)/dz);
 const mapx=x=>(x-(b.xmin+b.xmax)/2)*scale+W/2;
 const mapz=z=>(z-(b.zmin+b.zmax)/2)*scale+H/2;
 ctx.strokeStyle='rgba(225,240,232,.45)';ctx.lineWidth=2.7;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
 for(let i=0;i<pts.length;i+=3){const x=mapx(pts[i][0]),y=mapz(pts[i][2]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.stroke();
 ctx.strokeStyle='#defc6a';ctx.lineWidth=3.7;ctx.beginPath();const upto=Math.floor(physics.nearest/3)*3;
 for(let i=0;i<=upto;i+=3){const x=mapx(pts[i][0]),y=mapz(pts[i][2]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
 const x=mapx(physics.x),y=mapz(physics.z);
 ctx.fillStyle='#e9ff85';ctx.shadowColor='#dffc6a';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
}
function updateHUD(){
 const kmh=Math.round(Math.abs(physics.speed)*3.6);
 $('speedValue').textContent=String(kmh);$('rpmText').textContent=Math.round(physics.rpm/100)*100+' RPM';$('gearValue').textContent=physics.speed<-.3?'R':physics.speed===0&&physics.throttle===0?'N':physics.gear;
 $('lapProgress').textContent=((physics.nearest*track.step)/1000).toFixed(1)+' / '+(track.total/1000).toFixed(1)+' KM';
 const percent=Math.floor((physics.nearest/track.points.length)*100);$('trackPercent').textContent=percent+'%';
 const g=Math.round(physics.grip*100);$('gripFill').style.width=g+'%';$('gripText').textContent=g+'%';
 const t=Math.round(physics.throttle*100);$('throttleFill').style.width=t+'%';$('throttleText').textContent=t+'%';
 $('surfaceStatus').textContent=physics.offroad?'OFF ROAD':'ASPHALT';$('tcsStatus').textContent=assist?'TCS ON':'TCS OFF';
 $('speedTip').textContent=physics.offroad?'LOW GRIP — RETURN TO THE ROAD':physics.speed>15?'KEEP IT SMOOTH THROUGH THE CORNERS':'W / ↑ TO ACCELERATE';
 rpmSegments.forEach((el,i)=>{const active=i<Math.round(physics.rpm/7900*25);el.className=active?(i>20?'active red':'active'):'';});
}
function configureQuality(){
 renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?.8:quality==='medium'?1:1.4));
 renderer.shadowMap.enabled=quality==='high';sunlight.castShadow=quality==='high';
 $('qualitySelect').value=quality;localStorage.setItem('apex-quality',quality);
}
$('qualitySelect').addEventListener('change',e=>{quality=e.target.value;configureQuality();notify('GRAPHICS UPDATED — RELOAD FOR NEW TREE DENSITY');});
$('volumeInput').addEventListener('input',e=>audio.setVolume(+e.target.value/100));
$('assistSelect').addEventListener('change',e=>{assist=e.target.value==='on';notify(assist?'TRACTION CONTROL ON':'TRACTION CONTROL OFF');});
$('cameraBtn').addEventListener('click',()=>setCamera(camMode+1));
$('menuBtn').addEventListener('click',()=>setPause(!paused));
$('resumeBtn').addEventListener('click',()=>setPause(false));
$('resetBtn').addEventListener('click',()=>{reset();setPause(false);});
$('weatherBtn').addEventListener('click',changeWeather);
$('startBtn').addEventListener('click',()=>{requested=true;audio.start().catch(err=>console.warn('Audio unavailable:',err));if(ready)begin();else $('loadStatus').textContent='WAITING FOR CIRCUIT DATA…';});
function begin(){if(!ready)return;playing=true;paused=false;cameraSnap=true;$('splash').classList.add('hidden');$('hud').classList.remove('hidden');$('pause').classList.add('hidden');notify('WELCOME TO THE NORDSCHLEIFE');}
window.addEventListener('keydown',e=>{
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
 if(e.repeat&&['KeyC','KeyN','KeyR','KeyM','Escape'].includes(e.code))return;
 keys.add(e.code);
 if(e.code==='Escape')setPause(!paused);
 if(e.code==='KeyC'&&playing&&!paused)setCamera(camMode+1);
 if(e.code==='KeyN'&&playing)changeWeather();
 if(e.code==='KeyR'&&playing)reset();
 if(e.code==='KeyM'&&playing){showMap=!showMap;$('mapCard').classList.toggle('hidden',!showMap);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(playing)setPause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)setPause(true);});
document.querySelectorAll('.touch').forEach(el=>{
 const name=el.dataset.control;
 el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);touch[name]=true;el.classList.add('pressed');});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,e=>{touch[name]=false;el.classList.remove('pressed');});
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
configureQuality();
async function bootstrap(){
 progress(8,'CONNECTING TO NORDSCHLEIFE');
 track=await loadTrack();
 progress(38,track.authentic?'BUILDING THE 20.7 KM CIRCUIT':'BUILDING FALLBACK CIRCUIT');
 await new Promise(r=>setTimeout(r,50));
 world=createTrackWorld(scene,track,quality);progress(77,'SPAWNING SPORTS CAR');
 car=createCar(scene);physics.spawn(track,0);
 ready=true;
 if(!track.authentic){$('loadStatus').textContent='BACKUP TRACK LOADED — ORIGINAL DATA UNAVAILABLE';}
 progress(100,'SIMULATION READY');
 if(requested)begin();
 const report=await Promise.race([car.loadedPromise,new Promise(r=>setTimeout(()=>r(false),15000))]);
 showModel=report;if(report&&playing)notify('HIGH-DEFINITION CAR READY');
 else if(!report)console.info('Using procedural GT while model loads');
}
bootstrap().catch(err=>{console.error(err);$('loadStatus').textContent='UNABLE TO INITIALISE GAME. PLEASE RELOAD.';progress(0,'INITIALISATION ERROR');});
function frame(now){
 requestAnimationFrame(frame);
 const elapsed=clamp((now-lastFrame)/1000,0,.5);lastFrame=now;
 readGamepad();
 if(ready&&!paused&&playing){
  accumulator=Math.min(.55,accumulator+elapsed);
  let steps=0;const input=controls();
  // fixed 90Hz physics updates for a consistent, responsive feel
  while(accumulator>=1/90&&steps<46){physics.step(1/90,input,track,weather,assist);accumulator-=1/90;steps++;}
  car.update(physics,elapsed,weather);audio.update(physics,weather,false);
 }else if(ready){car.update(physics,0,weather);audio.update(physics,weather,true);accumulator=0;}
 if(ready){
  updateCamera(elapsed);updateRain(elapsed);
  sunlight.position.set(camera.position.x+(weather==='golden'?-280:165),physics.y+(weather==='golden'?65:280),camera.position.z+96);
  sunlight.target.position.set(physics.x,physics.y,physics.z);
  sunlight.target.updateMatrixWorld();
  if(now-lastHud>85){if(playing)updateHUD();lastHud=now;}
  if(now-lastMap>330){if(showMap)drawMap();lastMap=now;}
 }
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
