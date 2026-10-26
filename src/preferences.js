const choices={car:['apex','brz','m3'],transmission:['auto','manual'],route:['mountain','nordschleife'],quality:['high','balanced','low'],light:['day','golden','overcast','rain']};
const defaults={car:'apex',transmission:'auto',route:'mountain',quality:'balanced',light:'day',paint:'#b8172e',muted:false,touch:null,camera:0};
function read(storage,key){try{return storage?.getItem(`apex-${key}`)??null;}catch{return null;}}
export function savePreference(storage,key,value){try{storage?.setItem(`apex-${key}`,String(value));}catch{/* Preferences are optional in private browsing. */}}
export function loadPreferences(storage){
  const p={...defaults};
  for(const [key,allowed] of Object.entries(choices)){const value=read(storage,key);if(allowed.includes(value))p[key]=value;}
  p.paint=({apex:'#b8172e',brz:'#3f74d5',m3:'#e4e6e9'})[p.car];
  const paint=read(storage,p.car==='apex'?'paint':`paint-${p.car}`);if(/^#[0-9a-f]{6}$/i.test(paint||''))p.paint=paint;
  for(const key of ['muted','touch']){const value=read(storage,key);if(value==='true'||value==='false')p[key]=value==='true';}
  const camera=read(storage,'camera');if(['0','1','2'].includes(camera))p.camera=Number(camera);
  return p;
}
export function readBestLap(storage,route,car='apex'){
  if(!choices.route.includes(route)||!choices.car.includes(car))return null;
  const value=Number(read(storage,`best-${route}${car==='apex'?'':'-'+car}`));return Number.isFinite(value)&&value>0?value:null;
}
export function saveBestLap(storage,route,seconds,car='apex'){
  const previous=readBestLap(storage,route,car);
  if(!choices.route.includes(route)||!choices.car.includes(car)||!Number.isFinite(seconds)||seconds<=0)return previous;
  const best=previous===null?seconds:Math.min(previous,seconds);savePreference(storage,`best-${route}${car==='apex'?'':'-'+car}`,best);return best;
}
