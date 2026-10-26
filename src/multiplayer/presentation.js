import {Vector3,Quaternion} from 'three';
const identity=new Quaternion();
/** Visual correction only: never changes authoritative or predicted physics. */
export class PresentationPose{
 constructor(){this.position=new Vector3();this.quaternion=new Quaternion();this.offset=new Vector3();this.rotationOffset=new Quaternion();this.inverse=new Quaternion();}
 reset(){this.offset.set(0,0,0);this.rotationOffset.identity();}
 correct(before,after,{snap=false}={}){if(snap||before.position.distanceTo(after.position)>8){this.reset();return;}this.offset.add(before.position).sub(after.position);this.rotationOffset.multiply(before.quaternion).multiply(this.inverse.copy(after.quaternion).invert()).normalize();}
 update(base,dt){const decay=Math.exp(-Math.max(0,dt)/.12);this.offset.multiplyScalar(decay);this.rotationOffset.slerp(identity,1-decay);this.position.copy(base.position).add(this.offset);this.quaternion.copy(this.rotationOffset).multiply(base.quaternion).normalize();return this;}
}
