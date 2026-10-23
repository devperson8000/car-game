import * as THREE from 'three';

export const TRACK_URL='https://raw.githubusercontent.com/esc5221/drive-game/main/data/track.json';
export const CAR_URL='https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb';
const PI=Math.PI;
function random(seed){let s=seed|0;return()=>{s=(Math.imul(s,1664525)+1013904223)|0;return (s>>>0)/4294967296;};}
export async function loadTrack(){
 try{
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),11500);
  const res=await fetch(TRACK_URL,{mode:'cors',signal:ctrl.signal,cache:'force-cache'});clearTimeout(timer);
  if(!res.ok)throw new Error('track request failed');
  const data=await res.json();
  if(!Array.isArray(data.points)||data.points.length<2000||data.points[0].length<3)throw Error('invalid track data');
  return {name:data.name||'Nürburgring Nordschleife',points:data.points,total:data.total||20710,step:data.step||5,authentic:true};
 }catch(err){console.warn('Using fallback circuit:',err);
  const points=[],count=1500;
  for(let i=0;i<count;i++){const t=i/count*2*PI;points.push([1100*Math.cos(t)+280*Math.sin(3*t),35+18*Math.sin(2*t)+8*Math.sin(5*t),1100*Math.sin(t)+210*Math.sin(4*t)]);}
  const total=points.reduce((a,p,i)=>{const q=points[(i+1)%count];return a+Math.hypot(p[0]-q[0],p[2]-q[2]);},0);
  return {name:'Fallback mountain loop',points,total,step:total/count,authentic:false};
 }
}
const pos3=(x,y,z)=>new THREE.Vector3(x,y,z);
function dir2(track,i){
 const p=track.points[(i+track.points.length)%track.points.length],q=track.points[(i+1)%track.points.length];
 let dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz)||1;return [dx/l,dz/l];
}
function ribbon(track,offset,width,lift,sideTrim=0,colorize=false){
 const pts=track.points,n=pts.length;
 const p=new Float32Array(n*6*3),uv=new Float32Array(n*6*2),col=colorize?new Float32Array(n*6*3):null;
 let k=0,u=0,c=0;
 for(let i=0;i<n;i++){
  const j=(i+1)%n,pt=pts[i],qt=pts[j],d=dir2(track,i),e=dir2(track,j);
  const edges=(point,unit)=>[[point[0]+unit[1]*offset,point[1]+lift,point[2]-unit[0]*offset],[point[0]+unit[1]*(offset+width),point[1]+lift,point[2]-unit[0]*(offset+width)]];
  const a=edges(pt,d),b=edges(qt,e);
  const verts=[a[0],a[1],b[0],a[1],b[1],b[0]];
  const tiling=track.step/5, v0=i*tiling,v1=(i+1)*tiling;
  const vt=[[v0,0],[v0,1],[v1,0],[v0,1],[v1,1],[v1,0]];
  const alt=i%12<6?[1,1,1]:[.89,.27,.19];
  for(let t=0;t<6;t++){
   p.set(verts[t],k);k+=3;uv.set(vt[t],u);u+=2;
   if(col){const cc=sideTrim?alt:[.3,.3,.3];col.set(cc,c);c+=3;}
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 if(col)geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
 return geo;
}
function asphaltTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');
 ctx.fillStyle='#515459';ctx.fillRect(0,0,256,256);
 const rand=random(5310);
 for(let i=0;i<17000;i++){const v=rand()>.5?Math.floor(100+rand()*40):Math.floor(34+rand()*38);ctx.fillStyle='rgba('+v+','+v+','+v+','+(rand()*.18)+')';const x=rand()*256,y=rand()*256,s=.3+rand()*1.9;ctx.fillRect(x,y,s,s);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;return tex;
}
export function createTrackWorld(scene,track,quality='high'){
 const rng=random(2356),pts=track.points,n=pts.length,world=new THREE.Group();scene.add(world);
 const asphalt=new THREE.MeshStandardMaterial({map:asphaltTexture(),color:0xd5d5d5,roughness:.96,metalness:0});
 const road=new THREE.Mesh(ribbon(track,-6.7,13.4,.055),asphalt);road.receiveShadow=true;road.frustumCulled=false;world.add(road);
 const grass=new THREE.MeshStandardMaterial({color:0x576b42,roughness:1});
 const shoulder=new THREE.MeshStandardMaterial({color:0x637b4c,roughness:1});
 for(const [offset,width,mat,lift] of [[-17,10.3,grass,-.05],[6.7,10.3,grass,-.05],[-8.4,1.7,shoulder,.018],[6.7,1.7,shoulder,.018]]){
  const mesh=new THREE.Mesh(ribbon(track,offset,width,lift),mat);mesh.receiveShadow=true;mesh.frustumCulled=false;world.add(mesh);
 }
 const white=new THREE.MeshBasicMaterial({color:0xe8ede1});
 for(const offset of [-6.42,6.2]){const mesh=new THREE.Mesh(ribbon(track,offset,.17,.08),white);mesh.frustumCulled=false;world.add(mesh);}
 const curbMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77});
 for(const offset of [-7.4,6.7]){const mesh=new THREE.Mesh(ribbon(track,offset,.72,.091,1,true),curbMat);mesh.frustumCulled=false;world.add(mesh);}
 // Infield grassland following sampled road elevation, with gentle ridges.
 let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
 for(const [x,y,z] of pts){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);}
 const pad=350,xmid=(xmin+xmax)/2,zmid=(zmin+zmax)/2,wx=(xmax-xmin)+pad*2,wz=(zmax-zmin)+pad*2;
 const slices=quality==='low'?48:quality==='medium'?74:110;
 const geo=new THREE.PlaneGeometry(wx,wz,slices,slices);geo.rotateX(-PI/2);
 const vertex=geo.attributes.position;
 const cloud=[];for(let i=0;i<n;i+=Math.max(1,Math.floor(n/320))){const p=pts[i];cloud.push(p);}
 for(let i=0;i<vertex.count;i++){
  const x=vertex.getX(i)+xmid,z=vertex.getZ(i)+zmid;
  let best=Infinity,height=pts[0][1];
  for(const q of cloud){const dist=(q[0]-x)**2+(q[2]-z)**2;if(dist<best){best=dist;height=q[1];}}
  const noise=Math.sin(x*.009)*2.5+Math.cos(z*.011)*2.6+Math.sin(x*.023+z*.012)*1.2;
  vertex.setY(i,height-4.5+noise);
 }
 geo.computeVertexNormals();
 geo.translate(xmid,0,zmid);
 const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x4d6740,roughness:1,side:THREE.DoubleSide}));
 ground.receiveShadow=true;ground.frustumCulled=false;world.add(ground);
 // Guardrails: narrow reflective rails on both sides, indexed to the original road samples.
 const railMat=new THREE.MeshStandardMaterial({color:0xa7afb4,metalness:.78,roughness:.37,side:THREE.DoubleSide});
 const railPosts=[],railGeometry=new THREE.BoxGeometry(.13,.8,.13);
 for(const offset of [-11,11]){
  const vertices=[],indices=[];
  for(let i=0;i<n;i+=4){
   const p=pts[i],d=dir2(track,i);const xx=p[0]+d[1]*offset,zz=p[2]-d[0]*offset,yy=p[1]+.66;
   vertices.push(xx,yy,zz,xx,yy+.33,zz);
  }
  const ct=vertices.length/6;
  for(let i=0;i<ct;i++){const j=(i+1)%ct;indices.push(2*i,2*j,2*i+1,2*i+1,2*j,2*j+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();world.add(new THREE.Mesh(g,railMat));
  for(let i=0;i<n;i+=12){const p=pts[i],d=dir2(track,i);railPosts.push([p[0]+d[1]*offset,p[1]+.40,p[2]-d[0]*offset]);}
 }
 const postMesh=new THREE.InstancedMesh(railGeometry,new THREE.MeshStandardMaterial({color:0x7c8385,metalness:.6,roughness:.6}),railPosts.length);
 const dummy=new THREE.Object3D();railPosts.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();postMesh.setMatrixAt(i,dummy.matrix);});postMesh.instanceMatrix.needsUpdate=true;world.add(postMesh);
 // Instanced trees: realistic irregular forest silhouette without one draw-call per tree.
 const treeCount=quality==='low'?650:quality==='medium'?1700:2900;
 const tops=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),new THREE.MeshStandardMaterial({color:0x456d42,roughness:1}),treeCount);
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.18,1,5),new THREE.MeshStandardMaterial({color:0x51402e,roughness:1}),treeCount);
 const treeColor=new THREE.Color();const mat=new THREE.Matrix4();
 for(let i=0;i<treeCount;i++){
  const ind=Math.floor(rng()*n),p=pts[ind],d=dir2(track,ind);
  const side=rng()<.5?-1:1,offset=side*(21+rng()*108),s=7+rng()*16;
  const px=p[0]+d[1]*offset+(rng()-.5)*12,pz=p[2]-d[0]*offset+(rng()-.5)*12;
  const base=p[1]-1.5+Math.sin(px*.009)*1.6+Math.cos(pz*.011)*1.2;
  dummy.position.set(px,base+s*.52,pz);dummy.scale.set(s*.22,s,s*.22);dummy.rotation.set(0,rng()*PI*2,0);dummy.updateMatrix();tops.setMatrixAt(i,dummy.matrix);
  treeColor.setHSL(.27+rng()*.06,.26+rng()*.20,.17+rng()*.10);tops.setColorAt(i,treeColor);
  dummy.position.set(px,base+s*.17,pz);dummy.scale.set(s*.21,s*.34,s*.21);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
 }
 tops.instanceMatrix.needsUpdate=true;trunks.instanceMatrix.needsUpdate=true;
 tops.castShadow=false;tops.receiveShadow=true;world.add(trunks,tops);
 // Start grid line
 const p=pts[0],d=dir2(track,0);
 const start=new THREE.Mesh(new THREE.BoxGeometry(13.4,.016,.62),new THREE.MeshBasicMaterial({color:0xf1f1e8}));start.position.set(p[0],p[1]+.105,p[2]);start.rotation.y=Math.atan2(d[0],d[1]);world.add(start);
 // 100m signs near the start and an unobtrusive grandstand enclosure.
 const board=new THREE.Mesh(new THREE.BoxGeometry(7,2.4,.2),new THREE.MeshStandardMaterial({color:0x18272a,metalness:.4,roughness:.44}));
 board.position.set(p[0]+d[1]*17,p[1]+4,p[2]-d[0]*17);board.rotation.y=Math.atan2(d[0],d[1]);world.add(board);
 const textCanvas=document.createElement('canvas');textCanvas.width=640;textCanvas.height=170;let ctx=textCanvas.getContext('2d');
 ctx.fillStyle='#152121';ctx.fillRect(0,0,640,170);ctx.fillStyle='#e4fb70';ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.fillText('APEX',320,116);
 const billboard=new THREE.Mesh(new THREE.PlaneGeometry(6.6,1.75),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(textCanvas),side:THREE.DoubleSide}));billboard.position.copy(board.position);billboard.position.z+=.12;billboard.rotation.copy(board.rotation);world.add(billboard);
 return {world,road,ground,bounds:{xmin,xmax,zmin,zmax},treeCount};
}
