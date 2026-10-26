import {SPEC} from './spec.js';
// These are distinct game approximations, not manufacturer-calibrated models.
const brz=structuredClone(SPEC);
Object.assign(brz,{name:'Subaru BRZ Varis',mass:1250,inertia:[1800,2100,450],comH:.42,audioBank:'boxer4',gears:[3.626,2.188,1.541,1.213,1,.767],final:4.1,brakeT:5000,bias:.60,arbF:24000,arbR:12000,aero:{cda:.65,cla:.12}});
Object.assign(brz.wheels,{fz:-1.275,rz:1.275,htF:.79,htR:.82,radius:.330494,attachY:.12,kF:44000,kR:43000,cBF:3200,cRF:5000,cBR:3200,cRR:5000,muF:1,muR:1.02});
brz.engine={rpm:[750,1500,2500,3500,4500,5500,6400,7000,7400,7800],nm:[95,125,160,180,180,195,205,195,175,0],idle:750,redline:7400,engBrake:[15,.01],shiftDown:2500};
Object.assign(brz.engine_model,{cyl:4,intakeLen:105,exhaustLen:110,extractorLen:80,straightPipeLen:100,level:.7});
const m3=structuredClone(SPEC);
Object.assign(m3,{name:'BMW M3 Race',mass:1350,inertia:[2100,2350,530],comH:.36,audioBank:'race-v8',gears:[2.923,2.071,1.619,1.318,1.111,.962],final:4.1,brakeT:7200,bias:.63,arbF:38000,arbR:22000,aero:{cda:.9,cla:1.65}});
Object.assign(m3.wheels,{fz:-1.345,rz:1.345,htF:.80,htR:.80,radius:.329177,attachY:.17,kF:85000,kR:90000,cBF:5400,cRF:8000,cBR:5800,cRR:8500,muF:1.16,muR:1.18});
m3.engine={rpm:[950,2000,3000,4000,5000,6000,7000,8000,8400,8800],nm:[150,260,350,400,430,450,440,410,350,0],idle:950,redline:8400,engBrake:[30,.016],shiftDown:3500};
Object.assign(m3.engine_model,{cyl:8,exhaustLen:90,extractorLen:80,straightPipeLen:100,intakeMix:.5,blockMix:.8});
export const CARS=[
 {id:'apex',name:'APEX GT',model:'/models/car-concept.glb',normalized:false,description:'4.0 V8 · RWD · Balanced road supercar',character:'High-revving V8, progressive road tires and a seven-speed gearbox.',spec:SPEC},
 {id:'brz',name:'Subaru BRZ Varis',model:'/models/brz.glb',remoteModel:'/models/brz-remote.glb',normalized:true,cockpitEye:[-.32,.78,.22],description:'Flat-four · RWD · Lightweight road coupe',character:'Lower power, six manual ratios and forgiving road suspension. Carry momentum through corners.',spec:brz},
 {id:'m3',name:'BMW M3 Race',model:'/models/m3.glb',remoteModel:'/models/m3-remote.glb',normalized:true,cockpitEye:[-.34,.73,.375],description:'Race V8 · RWD · Track-focused coupe',character:'Stiffer suspension, stronger brakes and track tires. Aero grip builds with speed.',spec:m3},
];
export function getCar(id){return CARS.find(c=>c.id===id)||CARS[0];}
