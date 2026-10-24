import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original deterministic foliage cards. Instancing gives detailed silhouettes
// and alpha-tested shadowing without shipping thousands of individual trees.
export function foliageTexture(broad=false){
  const c=document.createElement('canvas');c.width=512;c.height=768;const ctx=c.getContext('2d');
  let state=broad?21:31;const r=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
  ctx.strokeStyle='#493b25';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(256,760);ctx.lineTo(256,30);ctx.stroke();
  for(let k=0;k<11000;k++){
    const y=30+r()*670;
    const spread=broad?Math.sqrt(Math.max(0,1-((y-350)/350)**2))*245:(y/720)**.7*235;
    const x=256+(r()-.5)*2*spread;
    if(r()<.12)continue;
    const v=r();ctx.fillStyle=`rgb(${65+v*45|0},${100+v*85|0},${40+v*45|0})`;
    ctx.beginPath();ctx.ellipse(x,y,2+r()*7,1+r()*3,(r()-.5)*1.8,0,Math.PI*2);ctx.fill();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
export function foliageGeometry(width,height){
  const geos=[];for(let i=0;i<3;i++){const g=new THREE.PlaneGeometry(width,height);g.rotateY(i*Math.PI/3);geos.push(g);}
  const result=mergeGeometries(geos);geos.forEach(g=>g.dispose());return result;
}
