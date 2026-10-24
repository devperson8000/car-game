import * as THREE from 'three';
import {Tree} from './vendor/ez-tree/tree.js';

export function createTreeGeometry(preset){
  const tree=new Tree();tree.loadPreset(preset);
  tree.options.branch.children[0]=Math.min(tree.options.branch.children[0],36);
  tree.options.leaves.count=Math.min(tree.options.leaves.count,18);tree.generate();
  const geometry=tree.createGeometry({sectionStride:3,segmentFactor:.5,leafStride:2,leafScale:1.2,billboard:'single'});
  geometry.branches.computeBoundingBox();geometry.leaves.computeBoundingBox();
  const top=Math.max(geometry.branches.boundingBox.max.y,geometry.leaves.boundingBox.max.y),scale=10/top;
  geometry.branches.scale(scale,scale,scale);geometry.leaves.scale(scale,scale,scale);tree.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return geometry;
}

export async function createDetailedTrees(materials){
  const loader=new THREE.TextureLoader();
  const maps=await Promise.all([loader.loadAsync('/textures/trees/pine.png'),loader.loadAsync('/textures/trees/ash.png')]);
  maps.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;});
  const prototypes={};
  for(const [name,preset] of [['con','Pine Small'],['broad','Ash Small']]){
    const geometry=createTreeGeometry(preset);
    const bark=new THREE.MeshStandardMaterial({map:materials.ground.map,normalMap:materials.ground.normalMap,color:0x8f8069,roughness:1});
    const leaves=new THREE.MeshStandardMaterial({map:maps[name==='con'?0:1],color:0xffffff,side:THREE.DoubleSide,alphaTest:.38,roughness:.9,emissive:0x122308,emissiveIntensity:.18});
    prototypes[name]={branches:{geometry:geometry.branches,material:bark},leaves:{geometry:geometry.leaves,material:leaves}};
  }
  return prototypes;
}
