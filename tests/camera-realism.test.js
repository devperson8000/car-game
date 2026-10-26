import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DrivingScene} from '../src/scene.js';
import {Session} from '../src/sim/session.js';

function fixture(mode){
 const orientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,-1),Math.PI/6);
 const vehicle={pos:new THREE.Vector3(0,2,0),quat:orientation,speed:0,airborne:false};
 const camera=new THREE.PerspectiveCamera();
 const view={session:{vehicle,track:{query:()=>null}},car:{cockpitEye:new THREE.Vector3(-.3,.8,.2),update(){}},camera,cameraMode:mode,clock:0,snap:true,reducedMotion:{matches:true},forward:new THREE.Vector3(),desired:new THREE.Vector3(),look:new THREE.Vector3(),smoothedLook:new THREE.Vector3(),sunOffset:new THREE.Vector3(),sunDirection:new THREE.Vector3(0,1,0),sun:{position:new THREE.Vector3(),target:new THREE.Object3D()},sky:new THREE.Object3D(),forest:[],renderer:{render(){}}};
 return view;
}

test('cockpit and hood cameras follow chassis banking instead of tilting the interior around the driver',()=>{
 for(const mode of [1,2]){
  const view=fixture(mode);DrivingScene.prototype.update.call(view,1/60,true);
  const cameraUp=new THREE.Vector3(0,1,0).applyQuaternion(view.camera.quaternion),bodyUp=new THREE.Vector3(0,1,0).applyQuaternion(view.session.vehicle.quat);
  assert.ok(cameraUp.angleTo(bodyUp)<.01,`mode ${mode}: camera/interior roll mismatch ${cameraUp.angleTo(bodyUp)}`);
 }
});

test('chase camera restores a level horizon after switching from cockpit',()=>{
 const view=fixture(1);DrivingScene.prototype.update.call(view,1/60,true);
 view.cameraMode=0;view.snap=true;
 // Only the chase ground-height helper needs a road query.
 view.session.track=new Session('mountain').track;
 DrivingScene.prototype.update.call(view,1/60,true);
 assert.ok(view.camera.up.distanceTo(new THREE.Vector3(0,1,0))<1e-8);
});
