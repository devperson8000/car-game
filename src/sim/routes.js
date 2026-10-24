import {CatmullRomCurve3,Vector3} from 'three';
import {TRACK} from '../vendor/track_data.js';

// A fictional closed scenic mountain route, not a scan of a real location.
// Arc-length sampling keeps tire queries, road geometry and lap distances aligned.
export function createMountainRoute(){
  const anchors=[];
  for(let i=0;i<32;i++){
    const t=i/32*Math.PI*2;
    const radius=1+.13*Math.sin(t*3)+.07*Math.cos(t*5);
    anchors.push(new Vector3(Math.sin(t)*650*radius,100+25*Math.sin(t*2)+12*Math.sin(t*3),Math.cos(t)*850*radius));
  }
  const curve=new CatmullRomCurve3(anchors,true,'centripetal');
  curve.arcLengthDivisions=8000;curve.updateArcLengths();
  const total=curve.getLength(),n=Math.ceil(total/5);
  const points=curve.getSpacedPoints(n).slice(0,-1).map(p=>p.toArray());
  return {name:'Alpine Pass',total,step:total/n,points,segments:[
    {name:'Valley Straight',s:0},{name:'Pinewood Rise',s:total*.14},
    {name:'The Lookout',s:total*.27},{name:'Summit Bends',s:total*.4},
    {name:'Rockfall Descent',s:total*.55},{name:'Forest Sweep',s:total*.7},
    {name:'Lake Approach',s:total*.86},
  ]};
}
export function routeData(id){return id==='mountain'?createMountainRoute():TRACK;}
