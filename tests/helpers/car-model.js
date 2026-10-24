import fs from 'node:fs';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// Keep the real GLB vertex data/hierarchy; omit browser-only image decoding.
export async function loadCarGeometry(){
 globalThis.ProgressEvent??=class{};
 const b=fs.readFileSync(new URL('../../public/models/car-concept.glb',import.meta.url)),length=b.readUInt32LE(12),gltf=JSON.parse(b.subarray(20,20+length));
 gltf.buffers[0].uri='data:application/octet-stream;base64,'+b.subarray(28+length).toString('base64');delete gltf.images;delete gltf.textures;delete gltf.materials;
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(gltf),'');return scene;
}
