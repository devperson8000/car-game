import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTreeGeometry} from '../src/trees.js';
import {Box3} from 'three';
test('nearby tree geometry has finite physical scale and bounded triangle cost',()=>{
 for(const preset of ['Pine Small','Ash Small']){
  const g=createTreeGeometry(preset),box=new Box3();let triangles=0;
  for(const geo of [g.branches,g.leaves]){geo.computeBoundingBox();box.union(geo.boundingBox);triangles+=(geo.index?.count||geo.attributes.position.count)/3;}
  assert.ok(Number.isFinite(box.max.y));assert.ok(Math.abs(box.max.y-10)<.01);assert.ok(triangles>100&&triangles<10000,`${preset}: ${triangles}`);
 }
});
