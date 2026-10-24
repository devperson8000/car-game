import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {bindWheel} from '../src/vehicle.js';

test('real GLB baked front steering is removed before simulation steering and spin',()=>{
 const b=fs.readFileSync('public/models/car-concept.glb');const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const nodes=gltf.nodes.map(n=>{const o=new THREE.Object3D();o.name=n.name||'';if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}return o;});
 gltf.nodes.forEach((n,i)=>{for(const c of n.children||[])nodes[i].add(nodes[c]);});
 const car=new THREE.Group(),model=new THREE.Group();car.add(model);model.rotation.y=Math.PI;model.scale.setScalar(.88);for(const i of gltf.scenes[0].nodes)model.add(nodes[i]);car.updateMatrixWorld(true);
 for(const name of ['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR']){
  const node=model.getObjectByName(name),assembly=bindWheel(car,node);assembly.spin.rotation.x=1.1;car.updateMatrixWorld(true);
  const axis=new THREE.Vector3(1,0,0).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(Math.abs(axis.y)<1e-5&&Math.abs(axis.z)<1e-5,`${name}: ${axis.toArray()}`);
 }
});

import {loadCarGeometry} from './helpers/car-model.js';import {CarView} from '../src/vehicle.js';import {SPEC} from '../src/sim/spec.js';
test('rear tires remain inside the measured fenders through rotation and suspension travel',async()=>{
 const car=new CarView(),model=await loadCarGeometry();model.rotation.y=Math.PI;model.scale.setScalar(.88);model.position.set(0,-.4,-.19);car.group.add(model);car.group.updateMatrixWorld(true);
 const mounts=['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR'].map(n=>model.getObjectByName(n));
 let fenderWidth=0;const p=new THREE.Vector3();
 model.traverse(mesh=>{if(!mesh.isMesh)return;let ancestor=mesh;while(ancestor){if(/^Wheel(Front|Rear)/.test(ancestor.name))return;ancestor=ancestor.parent;}const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);if(Math.abs(p.z-SPEC.wheels.rz)<.35&&p.y>-.08&&p.y<.4)fenderWidth=Math.max(fenderWidth,Math.abs(p.x));}});
 car.wheels=mounts.map(n=>bindWheel(car.group,n));
 for(const spinAngle of [0,.7,1.6,3.4,5.1])for(const travel of [-.05,0,.06]){
  const pos=new THREE.Vector3(5,2,4),quat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.8),W=SPEC.wheels;
  const v={pos,quat,ctrl:{brake:0,steer:0},wheels:[[-W.htF,W.fz],[W.htF,W.fz],[-W.htR,W.rz],[W.htR,W.rz]].map(([x,z])=>({worldPos:new THREE.Vector3(x,-.062+travel,z).applyQuaternion(quat).add(pos),steer:0,spinAngle}))};
  car.update(v);car.group.updateMatrixWorld(true);const inverse=car.group.matrixWorld.clone().invert();
  for(const mount of mounts.slice(2))mount.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);assert.ok(Math.abs(p.x)<=fenderWidth-.01,`${mount.name} tire x=${p.x.toFixed(3)}, fender=${fenderWidth.toFixed(3)}`);}});
 }
});
