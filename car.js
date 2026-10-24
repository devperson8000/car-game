import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CAR_URL} from './track.js';
const mat=(color,metalness=.15,roughness=.45)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
export function createCar(scene){
 const root=new THREE.Group(),suspension=new THREE.Group(),visual=new THREE.Group();
 root.add(suspension);suspension.add(visual);scene.add(root);
 const paint=new THREE.MeshPhysicalMaterial({color:0x293d4b,metalness:.7,roughness:.17,clearcoat:1,clearcoatRoughness:.12});
 const carbon=mat(0x0e1518,.32,.45),rubber=mat(0x111419,.02,.9),alloy=mat(0xbfc5cb,.86,.23),glass=new THREE.MeshPhysicalMaterial({color:0x182c35,metalness:.25,roughness:.08,transparent:true,opacity:.69,clearcoat:1});
 const lights=new THREE.MeshBasicMaterial({color:0xf3f6e2}),red=new THREE.MeshBasicMaterial({color:0xe33527});
 function box(w,h,d,m,x,y,z){const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;visual.add(obj);return obj;}
 const fallback=new THREE.Group();visual.add(fallback);
 const parts=[],wheels=[];
 const add=(geo,material,x,y,z,rot)=>{const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;fallback.add(o);parts.push(o);return o;};
 add(new THREE.BoxGeometry(1.93,.37,4.55),paint,0,.74,0);
 add(new THREE.BoxGeometry(1.79,.25,4.10),paint,0,.94,.05);
 add(new THREE.BoxGeometry(1.74,.04,1.77),paint,0,1.06,1.13);
 add(new THREE.BoxGeometry(1.73,.06,.47),carbon,0,.52,2.25);
 add(new THREE.BoxGeometry(1.73,.06,.31),carbon,0,.52,-2.24);
 // Angled windshield/cabin inspired by contemporary GT sports cars.
 add(new THREE.BoxGeometry(1.53,.62,2.00),glass,0,1.31,-.13,[0,0,0]);
 add(new THREE.BoxGeometry(1.54,.11,1.86),paint,0,1.67,-.1);
 add(new THREE.BoxGeometry(1.62,.17,.49),paint,0,1.03,-1.31);
 for(const side of [-1,1]){
   add(new THREE.BoxGeometry(.09,.37,1.57),paint,side*.91,.81,0);
   add(new THREE.BoxGeometry(.1,.04,.50),carbon,side*.94,.45,1.62);
   add(new THREE.BoxGeometry(.19,.12,.29),carbon,side*1.02,1.22,.48);
   add(new THREE.BoxGeometry(.43,.12,.14),lights,side*.64,.78,2.29);
   add(new THREE.BoxGeometry(.48,.10,.1),red,side*.66,.8,-2.3);
   add(new THREE.BoxGeometry(.40,.08,.68),carbon,side*.76,.60,-1.98);
   add(new THREE.BoxGeometry(.25,.06,1.40),carbon,side*.84,.52,-.27);
 }
 add(new THREE.BoxGeometry(1.60,.065,.55),carbon,0,1.13,-2.11);
 for(const x of [-.67,.67])add(new THREE.BoxGeometry(.07,.3,.14),carbon,x,1.0,-2.10);
 const ringGeo=new THREE.CylinderGeometry(.36,.36,.25,24),hubGeo=new THREE.CylinderGeometry(.21,.21,.259,12),spokeGeo=new THREE.BoxGeometry(.25,.04,.05);
 for(const x of [-.94,.94])for(const z of [-1.47,1.42]){
   const pivot=new THREE.Group();pivot.position.set(x,.38,z);fallback.add(pivot);
   const tire=new THREE.Mesh(ringGeo,rubber);tire.rotation.z=Math.PI/2;tire.castShadow=true;pivot.add(tire);
   const hub=new THREE.Mesh(hubGeo,alloy);hub.rotation.z=Math.PI/2;pivot.add(hub);
   for(let i=0;i<5;i++){const spoke=new THREE.Mesh(spokeGeo,alloy);spoke.position.x=x>0?.137:-.137;spoke.rotation.x=i*Math.PI*2/5;pivot.add(spoke);}
   wheels.push({spin:pivot,steer:z>0});
 }
 // Low beam lights illuminate the road at night and in wet conditions.
 const headlights=[];
 for(const side of [-1,1]){
  const beam=new THREE.SpotLight(0xe5f0ff,0,80,.23,.5,1.5);
  beam.position.set(side*.67,.85,2.25);
  beam.target.position.set(side*.57,-.3,35);
  root.add(beam,beam.target);headlights.push(beam);
 }
 let loaded=false,remoteWheels=[];
 const loader=new GLTFLoader();
 const loadedPromise=new Promise(resolve=>{
  loader.load(CAR_URL,gltf=>{
   try{
    const car=gltf.scene;
    const bbox=new THREE.Box3().setFromObject(car);const size=bbox.getSize(new THREE.Vector3());
    if(size.x>size.z*1.12){car.rotation.y=Math.PI/2;}
    car.updateMatrixWorld(true);
    let adjusted=new THREE.Box3().setFromObject(car),dims=adjusted.getSize(new THREE.Vector3());
    const longest=Math.max(dims.x,dims.z),s=4.63/longest;
    car.scale.multiplyScalar(s);car.updateMatrixWorld(true);
    adjusted=new THREE.Box3().setFromObject(car);
    const center=adjusted.getCenter(new THREE.Vector3());
    car.position.x-=center.x;car.position.z-=center.z;car.position.y-=adjusted.min.y-.04;
    car.traverse(o=>{
      if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
       if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];
        for(const m of mats){if(m.isMeshStandardMaterial){m.envMapIntensity=1.35;m.needsUpdate=true;}}
       }
      }
      if(/wheel/i.test(o.name)&&o.children.length>0&&o.position&&/(front|rear|left|right|fl|fr|rl|rr)/i.test(o.name))remoteWheels.push(o);
    });
    // Keep the imported wheels' original axle transforms intact.
    // Turn the hubs for steering and spin their tire/rim geometry locally.
    remoteWheels=['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR']
      .map(name=>car.getObjectByName(name)).filter(Boolean).map(w=>{
        const originalParent=w.parent;
        const originalPosition=w.position.clone();
        const steerPivot=new THREE.Group();steerPivot.name=w.name+'Steer';
        steerPivot.position.copy(originalPosition);
        originalParent.add(steerPivot);
        steerPivot.add(w);w.position.set(0,0,0);
        const spinPivot=new THREE.Group();spinPivot.name=w.name+'Spin';
        const movingParts=w.children.filter(child=>!/BrakePad/i.test(child.name));
        w.add(spinPivot);
        for(const child of movingParts)spinPivot.add(child);
        // Calipers stay on the steered hub, not the spinning rotor.
        return {spin:spinPivot,steer:steerPivot,front:/Front/.test(w.name)};
      });
    visual.add(car);fallback.visible=false;loaded=true;resolve(true);
   }catch(e){console.error('Model conversion:',e);resolve(false);}
  },undefined,err=>{console.warn('External car model unavailable; procedural GT enabled',err);resolve(false);});
 });
 let oldWheelSpin=0;
 function update(physics,dt,weather='clear'){
  root.position.set(physics.x,physics.y+.04,physics.z);
  root.rotation.y=physics.yaw;
  suspension.rotation.order='YXZ';
  suspension.rotation.x=-physics.pitch*.65; suspension.rotation.z=physics.roll*.66;
  suspension.position.y=Math.sin(physics.wheelSpin*.7)*.004;
  headlights.forEach(light=>{light.intensity=weather==='night'?36:weather==='rain'?10:0;});
  const spinDelta=physics.wheelSpin-oldWheelSpin;oldWheelSpin=physics.wheelSpin;
  for(const w of wheels){
   if(w.steer)w.spin.rotation.y=physics.steerAngle*.9;
   w.spin.rotation.x+=spinDelta;
  }
  remoteWheels.forEach(w=>{
   w.spin.rotation.x=physics.wheelSpin;
   w.steer.rotation.z=w.front?physics.steerAngle:0;
  });
 }
 return {root,suspension,visual,loadedPromise,get loaded(){return loaded;},update};
}
