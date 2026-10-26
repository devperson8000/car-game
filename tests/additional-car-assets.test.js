import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {bindWheel} from '../src/vehicle.js';
function glb(id){const b=fs.readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url));assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);const data=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));data.binary=b.subarray(28+b.readUInt32LE(12));return data;}
for(const id of ['brz','m3'])test(`${id}: normalized hubs, complete self-contained geometry and safe runtime wheel binding`,()=>{
 const data=glb(id),dims=JSON.parse(fs.readFileSync(new URL(`../public/models/${id}-dimensions.json`,import.meta.url)));
 assert.equal(data.animations?.length??0,0,'authoring pose animation must not return');
 for(const mesh of data.meshes)for(const primitive of mesh.primitives){const bounds=data.accessors[primitive.attributes.POSITION];assert.ok([...bounds.min,...bounds.max].every(v=>Math.abs(v)<3),`unbaked authoring scale in ${mesh.name}`);}
 assert.ok(data.materials.some(m=>m.name==='Paint 1'));
 assert.ok(data.meshes.length>=5,'body, glass, cabin and wheel assemblies survive');
 for(const im of data.images??[])assert.ok(im.bufferView!==undefined,'textures must be embedded');
 assert.ok(dims.bodyDimensions[0]>1.8&&dims.bodyDimensions[0]<2.1);
 assert.ok(dims.bodyDimensions[1]>.9&&dims.bodyDimensions[1]<1.5);
 assert.ok(dims.bodyDimensions[2]>4&&dims.bodyDimensions[2]<5);
 ['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR'].forEach((name,i)=>{
  const node=data.nodes.find(n=>n.name===name);assert.ok(node,`missing ${name}`);assert.ok(node.translation.every((v,j)=>Math.abs(v-dims.wheelHubs[i][j])<1e-6));
  assert.ok(Math.abs(node.translation[1])<.1,'hub must be relative to physics COM');
  const root=new THREE.Group(),hub=new THREE.Group();hub.position.fromArray(node.translation);root.add(hub);const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25,.65,.65));hub.add(mesh);root.updateMatrixWorld(true);
  const binding=bindWheel(root,hub);binding.spin.rotation.x=1.2;root.updateMatrixWorld(true);
  assert.ok(hub.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...dims.wheelHubs[i]))<1e-6,'wheel spins at authored hub');
 });
 if(id==='brz'){
  // The BRZ roof antenna is the highest authored geometry. It must be behind the
  // chassis (+Z), or chase/cockpit cameras see the opposite end of the car.
  const node=data.nodes.find(n=>n.name==='SX_interior');let wingZ=0,wingCount=0;
  for(const p of data.meshes[node.mesh].primitives){const a=data.accessors[p.attributes.POSITION],v=data.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){const off=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12);const y=data.binary.readFloatLE(off+4);if(y>1.15){wingZ+=data.binary.readFloatLE(off+8);wingCount++;}}}
  assert.ok(wingCount>0&&wingZ/wingCount>.5,'BRZ roof antenna must lie behind the driver');
 }
 if(id==='m3'){
  assert.equal(data.images?.length??0,0,'uncertain upstream photographic atlases must never ship');
  assert.ok(data.nodes.some(n=>n.name==='GeneratedSteeringWheel'));
  assert.ok(!data.nodes.some(n=>n.name==='XZ_interior'),'separately attributed cabin replaced');
  assert.ok(data.materials.some(m=>m.name==='Brakelight'));
 }
});
