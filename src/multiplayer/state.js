const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
export function applyVehicleState(v,s,{blend=false}={}){
 if(!s||!finiteArray(s.pos,3)||!finiteArray(s.quat,4)||!finiteArray(s.vel,3)||!finiteArray(s.angVel,3)||Math.hypot(...s.quat)<.1)return false;
 // Keep the solver's vector/quaternion identities and scratch references intact.
 if(blend&&v.pos.distanceToSquared({x:s.pos[0],y:s.pos[1],z:s.pos[2]})<9){v.pos.x+=(s.pos[0]-v.pos.x)*.25;v.pos.y+=(s.pos[1]-v.pos.y)*.25;v.pos.z+=(s.pos[2]-v.pos.z)*.25;}else v.pos.fromArray(s.pos);
 v.quat.fromArray(s.quat).normalize();v.vel.fromArray(s.vel);v.angVel.fromArray(s.angVel);
 for(const key of ['rpm','gear','speed','trackS','trackD','scrape'])if(Number.isFinite(s[key]))v[key]=s[key];
 for(const key of ['auto','tc','abs','onTrack','airborne'])if(typeof s[key]==='boolean')v[key]=s[key];
 if(s.ctrl){for(const key of ['steer','throttle','brake'])if(Number.isFinite(s.ctrl[key]))v.ctrl[key]=Math.max(key==='steer'?-1:0,Math.min(1,s.ctrl[key]));if(typeof s.ctrl.handbrake==='boolean')v.ctrl.handbrake=s.ctrl.handbrake;}
 for(let i=0;i<4;i++){const incoming=s.wheels?.[i],w=v.wheels[i];if(!incoming)continue;if(finiteArray(incoming.worldPos,3))w.worldPos.fromArray(incoming.worldPos);for(const key of ['omega','steer','spinAngle','slipAngle','slipRatio','load','comp','prevComp','surf'])if(Number.isFinite(incoming[key]))w[key]=incoming[key];if(typeof incoming.contact==='boolean')w.contact=incoming.contact;}
 return true;
}
