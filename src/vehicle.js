import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export function bindWheel(root,node){
  const center=node.getWorldPosition(new THREE.Vector3());
  const steer=new THREE.Group();steer.position.copy(center);root.add(steer);
  const spin=new THREE.Group();steer.add(spin);root.updateMatrixWorld(true);spin.attach(node);
  // This GLB is posed with 30 degrees of front steering. Remove that pose
  // before spinning about the vehicle axle, or the wheel will visibly wobble.
  const axle=new THREE.Vector3(1,0,0).applyQuaternion(node.quaternion).normalize();
  const target=new THREE.Vector3(Math.sign(axle.x)||1,0,0);
  node.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(axle,target));root.updateMatrixWorld(true);
  const calipers=[];node.traverse(o=>{if(/BrakePad/.test(o.name))calipers.push(o);});
  for(const caliper of calipers)steer.attach(caliper);
  return {steer,spin};
}
export class CarView{
  constructor(){this.group=new THREE.Group();this.wheels=[];this.paintMaterials=[];this.brakeMaterials=[];this.glassMaterials=new Set();this.inverse=new THREE.Quaternion();this.temp=new THREE.Vector3();}
  async load(){
    const gltf=await new GLTFLoader().loadAsync('/models/car-concept.glb');
    const model=this.model=gltf.scene;model.scale.setScalar(.88);model.rotation.y=Math.PI;model.position.set(0,-.40,-.19);
    this.group.add(model);this.group.updateMatrixWorld(true);
    model.traverse(o=>{
      if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        m.envMapIntensity=1.1;
        if(m.transmission>0){this.glassMaterials.add(m);o.castShadow=false;}
        if(m.name?.startsWith('Paint 1')){m.roughness=.24;m.metalness=.85;if('clearcoat' in m)m.clearcoat=1;this.paintMaterials.push(m);}
        if(/Brakelight/i.test(m.name)){m.emissive=new THREE.Color(0xff1806);this.brakeMaterials.push(m);}
      }
    });
    for(const name of ['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR']){
      const node=model.getObjectByName(name);if(!node)throw new Error(`Car wheel missing: ${name}`);
      this.wheels.push(bindWheel(this.group,node));
    }
    this.group.updateMatrixWorld(true);
    // Measure the actual steering-wheel location instead of guessing from fallback geometry.
    const wheel=model.getObjectByName('InteriorSteeringWheel01');
    const point=wheel?wheel.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(-.4,.4,-.3);
    this.cockpitEye=point.clone().add(new THREE.Vector3(0,.28,.42));
    this.cockpitEye.y=Math.min(this.cockpitEye.y,.57);
    this.steering=model.getObjectByName('InteriorSteeringCylinder');this.steeringBase=this.steering?.quaternion.clone();
    this.setPaint('#b8172e');return this;
  }
  setPaint(color){for(const m of new Set(this.paintMaterials))m.color.set(color);}
  setQuality(quality){
    for(const m of this.glassMaterials){
      m.transmission=quality==='high'?1:0;m.transparent=quality!=='high';m.opacity=quality==='high'?1:.19;m.depthWrite=quality==='high';m.needsUpdate=true;
    }
  }
  update(v){
    this.group.position.copy(v.pos);this.group.quaternion.copy(v.quat);this.inverse.copy(v.quat).invert();
    for(let i=0;i<this.wheels.length;i++){
      const render=this.wheels[i],w=v.wheels[i];
      if(w.worldPos.lengthSq()>1)render.steer.position.copy(w.worldPos).sub(v.pos).applyQuaternion(this.inverse);
      render.steer.rotation.y=-w.steer;render.spin.rotation.x=-w.spinAngle;
    }
    for(const m of this.brakeMaterials)m.emissiveIntensity=v.ctrl.brake>.05?3:.35;
    if(this.steering){this.steering.quaternion.copy(this.steeringBase);this.steering.rotateY(-v.ctrl.steer*1.4);}
  }
}
