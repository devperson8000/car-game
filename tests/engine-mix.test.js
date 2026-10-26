import {test} from 'node:test';import assert from 'node:assert/strict';
const load=()=>import('../src/engine-samples.js');
test('sample engine uses adjacent RPM bands without a volume dip at crossover',async()=>{
 const {engineMix}=await load();
 for(const rpm of [900,1000,1500,3000,4500,7999,8500]){const mix=engineMix(rpm);assert.equal(mix.length,8);const audible=mix.filter(x=>x.gain>1e-6);assert.ok(audible.length<=2);assert.ok(Math.abs(mix.reduce((n,x)=>n+x.gain*x.gain,0)-1)<1e-9);for(const x of audible){assert.ok(Math.abs(x.rate*x.rpm-rpm)<1e-6);}}
});
test('sample engine has continuous crossovers and handles invalid RPM safely',async()=>{
 const {engineMix}=await load();for(const rpm of [2000,4000,7000]){const a=engineMix(rpm-.01),b=engineMix(rpm+.01);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i].gain-b[i].gain)<.001);}
 for(const rpm of [NaN,Infinity,-4])for(const x of engineMix(rpm)){assert.ok(Number.isFinite(x.gain)&&Number.isFinite(x.rate));assert.ok(x.rate>0);}
});

import fs from 'node:fs';import {createHash} from 'node:crypto';
test('all eight hosted engine loops match the preparation manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/audio/v8/manifest.json'));assert.equal(manifest.length,8);
 for(let i=0;i<8;i++){const data=fs.readFileSync(`public/audio/v8/${i+1}.ogg`);assert.equal(data.subarray(0,4).toString(),'OggS');assert.equal(createHash('sha256').update(data).digest('hex'),manifest[i].ogg_sha256);assert.ok(data.length>10000);}
});

test('selected car banks crossfade their own RPM samples with stable power',async()=>{
 const {engineMix}=await load();
 for(const bank of ['boxer4','race-v8']){
  const mix=engineMix(3500,bank),audible=mix.filter(x=>x.gain>1e-6);
  assert.deepEqual(audible.map(x=>x.url),[`/audio/${bank}/3.ogg`,`/audio/${bank}/4.ogg`]);
  assert.ok(Math.abs(mix.reduce((sum,x)=>sum+x.gain*x.gain,0)-1)<1e-9);
  for(const sample of audible)assert.ok(Math.abs(sample.rate*sample.rpm-3500)<1e-6);
 }
 assert.deepEqual(engineMix(3500,'unknown'),engineMix(3500));
});

test('additional engine banks contain distinct, attributed prepared loops',()=>{
 const hashes=new Set();
 for(const [bank,prefix] of [['boxer4','su-oe'],['race-v8','b-v8']]){
  const manifest=JSON.parse(fs.readFileSync(`public/audio/${bank}/manifest.json`));
  assert.equal(manifest.length,8);
  for(let i=0;i<8;i++){
   const entry=manifest[i],data=fs.readFileSync(`public/audio/${bank}/${i+1}.ogg`);
   assert.equal(entry.source_file,`${prefix}-${i+1}.wav`);
   assert.equal(entry.source_revision,'fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8');
   assert.equal(data.subarray(0,4).toString(),'OggS');
   assert.equal(createHash('sha256').update(data).digest('hex'),entry.ogg_sha256);
   assert.match(entry.source_sha256,/^[a-f0-9]{64}$/);
   assert.ok(!hashes.has(entry.ogg_sha256));hashes.add(entry.ogg_sha256);
  }
 }
});
