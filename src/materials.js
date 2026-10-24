import * as THREE from 'three';
export async function loadMaterials(){
  const loader=new THREE.TextureLoader();
  const load=async(name,color=false)=>{
    const t=await loader.loadAsync(`/textures/${name}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
    if(color)t.colorSpace=THREE.SRGBColorSpace;return t;
  };
  const result={};
  await Promise.all(['asphalt','grass','ground'].map(async type=>{
    const [map,normalMap,roughnessMap]=await Promise.all([load(`${type}-color`,true),load(`${type}-normal`),load(`${type}-roughness`)]);
    result[type]={map,normalMap,roughnessMap,normalScale:new THREE.Vector2(type==='asphalt'?.45:.7,type==='asphalt'?.45:.7)};
  }));
  return result;
}
