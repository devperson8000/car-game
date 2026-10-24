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
