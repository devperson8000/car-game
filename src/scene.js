import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {buildWorld,groundHeightAt} from './vendor/world.js';
import {setDem} from './vendor/terrain.js';
import {DEM} from './vendor/dem_data.js';
import {loadMaterials} from './materials.js';
import {CarView} from './vehicle.js';
import {createDetailedTrees} from './trees.js';

export class DrivingScene{
  constructor(container,session){
    this.session=session;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,10000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.9;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Driving view');
    this.sky=new Sky();this.sky.scale.setScalar(9000);this.scene.add(this.sky);
    this.sun=new THREE.DirectionalLight(0xffedce,3.3);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:350});
    this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00008;
    this.scene.add(this.sun,this.sun.target);
    this.hemi=new THREE.HemisphereLight(0xb4d0ef,0x6d7658,1.3);this.scene.add(this.hemi);
    this.scene.fog=new THREE.Fog(0xc6d0d3,250,2600);
    this.sunDirection=new THREE.Vector3();this.cameraMode=0;this.snap=true;this.clock=0;
    this.target=new THREE.Vector3();this.desired=new THREE.Vector3();this.look=new THREE.Vector3();this.forward=new THREE.Vector3();this.sunOffset=new THREE.Vector3();
    this.setWeather('day');
    addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);});
  }
  async load(progress){
    progress(12,'Loading detailed road materials…');
    const [materials,car,hdr]=await Promise.all([loadMaterials(),new CarView().load(),new RGBELoader().loadAsync('/models/venice-sunset.hdr')]);
    progress(65,'Building terrain and forest…');
    await new Promise(r=>setTimeout(r,30));
    hdr.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=new THREE.PMREMGenerator(this.renderer);const env=pmrem.fromEquirectangular(hdr);this.scene.environment=env.texture;
    this.scene.environmentIntensity=.7;hdr.dispose();pmrem.dispose();
    this.car=car;this.scene.add(car.group);
    setDem(this.session.route==='nordschleife'?DEM:null);
    const trees3d=await createDetailedTrees(materials);
    this.world=buildWorld(this.scene,this.session.track,{materials,trees3d,trees:.22,nord:this.session.route==='nordschleife',aniso:8});
    this.roadMat=this.world.roadMat;this.roadMat.color.set(0xb2b2b2);
    this.forest=[];this.scene.traverse(o=>{if(o.userData.forest)this.forest.push(o);});
    // Source terrain and verges use the very same road surface as the wheel queries.
    this.scene.traverse(o=>{if(o.isMesh&&o.material?.metalness>.3)o.castShadow=true;if(o.isMesh&&o.material?.map){o.material.map.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());}});
    progress(92,'Preparing the cockpit…');
    this.addContactShadow();this.setWeather(this.weather);this.setQuality('balanced');
    for(let i=0;i<120;i++)this.session.vehicle.step(1/240);
    this.session.laps.reset(this.session.vehicle.trackS);this.car.update(this.session.vehicle);progress(100,'Ready. The road is yours.');
  }
  addContactShadow(){
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
    const grad=g.createRadialGradient(64,64,10,64,64,64);grad.addColorStop(0,'rgba(0,0,0,.65)');grad.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);
    this.contact=new THREE.Mesh(new THREE.PlaneGeometry(2.8,5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    this.contact.rotation.x=-Math.PI/2;this.contact.renderOrder=3;this.scene.add(this.contact);
  }
  setQuality(q){
    this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?1.65:q==='low'?.85:1.2));
    this.renderer.transmissionResolutionScale=q==='high'?.5:.25;this.car?.setQuality(q);
    const size=q==='high'?2048:q==='low'?1024:1536;
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
    this.renderer.shadowMap.enabled=true;
    this.scene.traverse(o=>{if(o.isInstancedMesh&&o.material?.alphaTest>0)o.castShadow=q!=='low';});
  }
  setWeather(weather){
    this.weather=weather;
    const golden=weather==='golden',cloudy=weather==='overcast'||weather==='rain';
    this.sunDirection.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-(golden?13:cloudy?45:32)),THREE.MathUtils.degToRad(golden?245:125));
    const u=this.sky.material.uniforms;u.turbidity.value=cloudy?12:golden?5:3;u.rayleigh.value=golden?2.2:2.5;u.mieCoefficient.value=.004;u.mieDirectionalG.value=.8;u.sunPosition.value.copy(this.sunDirection);
    this.sun.color.set(golden?0xffc58e:cloudy?0xd0e0ee:0xffedcf);this.sun.intensity=cloudy?1:golden?3.2:3.4;this.hemi.intensity=cloudy?1.5:1.15;
    this.scene.fog.color.set(golden?0xc8b49c:cloudy?0xa6b4bc:0xb9cbd5);this.scene.fog.near=cloudy?130:300;this.scene.fog.far=cloudy?1500:3000;
    this.renderer.toneMappingExposure=golden?.82:.86;
    if(this.roadMat){this.roadMat.roughness=weather==='rain'?.25:.9;this.roadMat.metalness=weather==='rain'?.15:0;}
  }
  update(dt,driving){
    if(!this.car)return;
    const v=this.session.vehicle;this.car.update(v);this.clock+=dt;
    const f=this.forward.set(0,0,-1).applyQuaternion(v.quat);
    if(!driving){
      const angle=.8+Math.sin(this.clock*.08)*.18;
      this.desired.set(-Math.sin(angle)*6,2.0,-Math.cos(angle)*6).applyQuaternion(v.quat).add(v.pos);
      // Position the car to the right of the launch card.
      this.look.copy(v.pos).addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(v.quat),2.0);this.look.y+=.25;
    }else if(this.cameraMode===0){
      this.desired.copy(v.pos).addScaledVector(f,-(6.2+Math.min(2.5,Math.abs(v.speed)*.035)));this.desired.y+=2.5;
      const ground=groundHeightAt(this.session.track,{},this.desired.x,this.desired.z,v.pos.y);
      this.desired.y=Math.max(this.desired.y,ground+1);
      this.look.copy(v.pos).addScaledVector(f,3+Math.abs(v.speed)*.025);this.look.y+=.55;
    }else{
      const eye=this.cameraMode===1?this.car.cockpitEye:new THREE.Vector3(0,.65,-1.65);
      this.desired.copy(eye).applyQuaternion(v.quat).add(v.pos);
      this.look.copy(this.desired).addScaledVector(f,30);this.look.y-=.15;
    }
    if(this.snap||this.cameraMode!==0&&driving){this.camera.position.copy(this.desired);this.snap=false;}
    else this.camera.position.lerp(this.desired,1-Math.exp(-dt*7));
    this.camera.lookAt(this.look);
    const fov=driving?(this.cameraMode===0?48+Math.min(10,Math.abs(v.speed)*.12):65):44;
    this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,1-Math.exp(-dt*4));this.camera.updateProjectionMatrix();
    this.sunOffset.copy(this.sunDirection).multiplyScalar(160);this.sun.position.copy(v.pos).add(this.sunOffset);this.sun.target.position.copy(v.pos);this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
    const q=this.session.track.query(v.pos.x,v.pos.z,{},v.pos.y);
    if(q){this.contact.position.set(v.pos.x,q.y+.025,v.pos.z);this.contact.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(q.nx,q.ny,q.nz));this.contact.rotateZ(-Math.atan2(f.x,-f.z));this.contact.visible=!v.airborne;}
    for(const mesh of this.forest||[]){const d=mesh.boundingSphere.center.distanceTo(this.camera.position),nearRange=this.quality==='high'?180:this.quality==='low'?0:110;mesh.visible=mesh.userData.nearTree?d<nearRange:d<(this.quality==='high'?1100:this.quality==='low'?450:700)&&(d>=nearRange||!mesh.material.alphaTest);mesh.castShadow=this.quality!=='low'&&d<100;}
    this.renderer.render(this.scene,this.camera);
  }
}
