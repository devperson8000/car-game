import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomEngine } from './engine.js';

/** Start one authoritative in-memory service. A lobby always lives on one process. */
export async function createMultiplayerServer({port=3001,host='0.0.0.0',allowedOrigins=[],maxConnections=512,maxConnectionsPerIp=16,maxRooms=100}={}){
  const origins=new Set(typeof allowedOrigins==='string'?allowedOrigins.split(',').map(s=>s.trim()).filter(Boolean):allowedOrigins);
  const engine=new RoomEngine({maxPeers:maxConnections,maxRooms});
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/health'){res.writeHead(200);res.end(JSON.stringify({ok:true}));}else{res.writeHead(404);res.end(JSON.stringify({error:'Not found'}));}});
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  const ips=new Map();
  server.on('upgrade',(req,socket,head)=>{
    const ip=req.socket.remoteAddress??'unknown';
    if((req.headers.origin&&origins.size&&!origins.has(req.headers.origin))||wss.clients.size>=maxConnections||(ips.get(ip)??0)>=maxConnectionsPerIp){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',(ws,req)=>{
    const ip=req.socket.remoteAddress??'unknown';ips.set(ip,(ips.get(ip)??0)+1);
    const send=message=>{if(ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>1024*1024){ws.close(1013,'Slow connection');return;}ws.send(JSON.stringify(message));};
    let id;try{id=engine.connect(send);}catch{ws.close(1013,'Server full');return;}
    ws.alive=true;let budget=180,lastBudget=Date.now();
    ws.on('pong',()=>{ws.alive=true;});
    ws.on('message',(data,binary)=>{
      const now=Date.now();budget=Math.min(180,budget+(now-lastBudget)*.12);lastBudget=now;
      if(--budget<0){ws.close(1008,'Message rate exceeded');return;}
      if(binary){send({type:'error',message:'JSON text messages required'});return;}
      let message;try{message=JSON.parse(data.toString());}catch{send({type:'error',message:'Invalid JSON'});return;}
      engine.message(id,message);
    });
    ws.on('error',()=>{}); // Close cleanup below handles malformed/oversized frames too.
    ws.on('close',()=>{engine.disconnect(id);const remaining=(ips.get(ip)??1)-1;if(remaining)ips.set(ip,remaining);else ips.delete(ip);});
  });
  let previous=performance.now(),accumulator=0;
  const physics=setInterval(()=>{
    const now=performance.now();accumulator+=Math.min(.1,(now-previous)/1000);previous=now;
    while(accumulator>=1/60){engine.tick(1/60);accumulator-=1/60;}
  },1000/60);
  const snapshots=setInterval(()=>engine.snapshots(),50);
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
  for(const timer of [physics,snapshots,heartbeat])timer.unref();
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});}catch(error){clearInterval(physics);clearInterval(snapshots);clearInterval(heartbeat);throw error;}
  return{engine,address:()=>server.address(),async close(){clearInterval(physics);clearInterval(snapshots);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.PORT??3001);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer from 1 to 65535');
  const service=await createMultiplayerServer({port,host:process.env.HOST??'0.0.0.0',allowedOrigins:process.env.ALLOWED_ORIGINS??''});
  console.log(`Multiplayer server listening on port ${service.address().port}`);
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await service.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
