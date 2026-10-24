const $=id=>document.getElementById(id);
export function formatTime(seconds){if(seconds===null)return '— — : — —';const m=Math.floor(seconds/60),s=seconds%60;return `${String(m).padStart(2,'0')}:${s.toFixed(3).padStart(6,'0')}`;}
export class HUD{
  constructor(session){
    this.session=session;this.segments=[];for(let i=0;i<28;i++){const el=document.createElement('i');if(i>22)el.classList.add('hot');$('revs').appendChild(el);this.segments.push(el);}
    const t=session.track;this.length=(t.total/1000).toFixed(2);this.name=session.route==='mountain'?'ALPINE PASS':'NORDSCHLEIFE';
    $('route-tag').innerHTML=`<i></i> ${this.name} <span>${session.route==='mountain'?'FICTIONAL SCENIC ROUTE':'GERMANY'}</span>`;
    $('map-name').textContent=this.name;$('map-length').textContent=`${this.length} KM`;
    const xs=Array.from(t.px),zs=Array.from(t.pz);this.bounds={x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};
    this.mapBase=document.createElement('canvas');this.mapBase.width=360;this.mapBase.height=280;
    const c=this.mapBase.getContext('2d');c.strokeStyle='#c0cdb5';c.lineWidth=2.5;c.lineJoin='round';c.beginPath();
    for(let i=0;i<t.n;i+=2){const [x,y]=this.project(t.px[i],t.pz[i]);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.stroke();
  }
  project(x,z){const b=this.bounds,s=Math.min(320/(b.x1-b.x0),240/(b.z1-b.z0));return [180+(x-(b.x0+b.x1)/2)*s,140+(z-(b.z0+b.z1)/2)*s];}
  update(){
    const {vehicle:v,laps,track}=this.session;
    $('speed').textContent=Math.round(v.speedKmh);$('gear').textContent=v.gearLabel;$('transmission').textContent=v.auto?'AUTO':'MANUAL';
    $('rpm-number').textContent=(v.rpm/1000).toFixed(1);this.segments.forEach((el,i)=>el.classList.toggle('on',i<v.rpm/v.spec.engine.redline*28));
    $('throttle-meter').style.width=`${v.ctrl.throttle*100}%`;$('brake-meter').style.width=`${v.ctrl.brake*100}%`;
    $('lap-time').textContent=formatTime(laps.current);$('best-lap').textContent=formatTime(laps.best);$('lap-number').textContent=String(laps.completed+1).padStart(2,'0');
    $('sector').textContent=track.sectionAt(v.trackS)?.name||this.name;$('distance').textContent=`${(v.trackS/1000).toFixed(2)} / ${this.length} KM`;
    $('surface').textContent=v.airborne?'AIRBORNE':v.onTrack?'ASPHALT':'LOW GRIP';
    for(const [key,value] of [['tc',v.tc],['abs',v.abs]]){$(key).textContent=`${key.toUpperCase()} ${value?'ON':'OFF'}`;$(key).setAttribute('aria-pressed',String(value));}
    const canvas=$('minimap'),c=canvas.getContext('2d');c.clearRect(0,0,360,280);c.drawImage(this.mapBase,0,0);
    const [x,y]=this.project(v.pos.x,v.pos.z);c.fillStyle='#f05c59';c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();c.stroke();
  }
}
