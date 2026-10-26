import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const id of ['brz','m3']){
 const page=await browser.newPage({viewport:{width:900,height:650}});await page.goto((process.env.TEST_URL??'http://127.0.0.1:5173')+'/credits.html');
 await page.evaluate(async id=>{
  const T=await import('/node_modules/three/build/three.module.js');const {CarView}=await import('/src/vehicle.js');const dims=await(await fetch(`/models/${id}-dimensions.json`)).json();const car=new CarView();await car.load({normalized:true,model:`/models/${id}.glb`,cockpitEye:dims.cockpitEye});car.setQuality('low');const scene=new T.Scene();scene.background=new T.Color('#8898a8');scene.add(car.group);scene.add(new T.HemisphereLight(0xffffff,0x505050,3));const l=new T.DirectionalLight(0xffffff,4);l.position.set(-3,5,4);scene.add(l);const camera=new T.PerspectiveCamera(55,900/650,.03,50);camera.position.set(0,1.7,6);camera.lookAt(0,.3,0);const r=new T.WebGLRenderer({antialias:true});r.setSize(900,650);document.body.replaceChildren(r.domElement);document.body.className='';r.domElement.style.cssText='position:fixed;inset:0;z-index:10000';r.render(scene,camera);window.probe={r,scene,camera,car,T};
 },id);
 await page.screenshot({path:`test-results/${id}-heading-rear.png`});
 await page.evaluate(()=>{const {r,scene,camera,car,T}=window.probe;camera.position.copy(car.cockpitEye);camera.lookAt(car.cockpitEye.clone().add(new T.Vector3(0,-.03,-1)));r.render(scene,camera);});await page.screenshot({path:`test-results/${id}-heading-cockpit.png`});await page.close();
}
await browser.close();
