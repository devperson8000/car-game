const choices={route:['mountain','nordschleife'],quality:['high','balanced','low'],light:['day','golden','overcast','rain']};
const defaults={route:'mountain',quality:'balanced',light:'day',paint:'#b8172e',muted:false,touch:null,camera:0};
function read(storage,key){try{return storage?.getItem(`apex-${key}`)??null;}catch{return null;}}
export function savePreference(storage,key,value){try{storage?.setItem(`apex-${key}`,String(value));}catch{/* Preferences are optional in private browsing. */}}
export function loadPreferences(storage){
  const p={...defaults};
  for(const [key,allowed] of Object.entries(choices)){const value=read(storage,key);if(allowed.includes(value))p[key]=value;}
  const paint=read(storage,'paint');if(/^#[0-9a-f]{6}$/i.test(paint||''))p.paint=paint;
  for(const key of ['muted','touch']){const value=read(storage,key);if(value==='true'||value==='false')p[key]=value==='true';}
  const camera=read(storage,'camera');if(['0','1','2'].includes(camera))p.camera=Number(camera);
  return p;
}
export function readBestLap(storage,route){
  if(!choices.route.includes(route))return null;
  const value=Number(read(storage,`best-${route}`));return Number.isFinite(value)&&value>0?value:null;
}
export function saveBestLap(storage,route,seconds){
  const previous=readBestLap(storage,route);
  if(!choices.route.includes(route)||!Number.isFinite(seconds)||seconds<=0)return previous;
  const best=previous===null?seconds:Math.min(previous,seconds);savePreference(storage,`best-${route}`,best);return best;
}
