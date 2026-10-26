# Multiplayer v1 contract

Persistent Node WebSocket server, 8 accepted members per lobby. Server runs the existing Session/Vehicle solver; clients send inputs, never accepted vehicle transforms or laps. Cars do not collide. Frontend stays on Vercel. WS URL is VITE_MULTIPLAYER_URL; localhost development can default to ws://localhost:3001. No invented public endpoint.

## Client messages (JSON)
- `list`
- `create`: name (driver), lobbyName, mode (`free`/`race`), route (`mountain`/`nordschleife`), weather (`day`/`golden`/`overcast`/`rain`), laps (1–5), car (`apex`/`brz`/`m3`), auto (boolean), paint (#rrggbb).
- `request`: code, name, car, auto, paint. Receives pending until owner approval; pending clients receive no room snapshots/member secrets.
- `approve`: requestId, accept (boolean). Owner only.
- `resume`: token (opaque cryptographically random secret delivered only to its member). Preserve membership for 30s after transient disconnect; remove expired members and transfer ownership to oldest remaining member.
- `leave`, `ready` {ready:boolean}, `start`, `cancel` (owner cancels race/returns to lobby), `kick` {playerId} (owner only).
- `configure`: mode,route,weather,laps. Owner only, before race; notify all, reset readiness/grid. Free mode can reconfigure safely.
- `input`: seq (increasing integer), controls {steer[-1,1],throttle[0,1],brake[0,1],handbrake:boolean}, parked:boolean, auto:boolean. Server clamps/rejects nonfinite values and ignores unaccepted clients. When parked freeze safely in free/lobby, brake to a halt during live race (no automatic reverse).
- `transmission` {auto:boolean} and `assists` {tc:boolean,abs:boolean} change the driver’s personal controls immediately.
- `shift`: direction (`up`/`down`), only manual and allowed driving phase. `recover`: permitted free drive/lobby; reject in active race.
- `ping`: clientTime -> pong.

## Server messages
- `hello` {id,serverTime}; `lobbies` {lobbies:[{code,name,ownerName,players,maxPlayers:8,mode,route,phase}]}.
- `pending` {code}; `rejected` {message}; `error` {message}; `left`; `pong` {clientTime,serverTime}.
- `joined` {selfId,token,room:RoomState} on create/approved request/resume.
- `room` {room:RoomState} on membership/config/phase changes. RoomState = {code,name,ownerId,config:{mode,route,weather,laps},phase,countdownEndsAt,players:[{id,name,car,paint,ready,connected}],pendingRequests:[{id,name,car}]}. pendingRequests populated ONLY for owner.
- `snapshot` {serverTime,code,phase,countdownEndsAt,players:[{id,car,paint,state:VehicleState,laps:{completed,current,last,best,progress,armed},finished,finishTime}],standings:[{id,name,lap,progress,finished,time,position}]} at20Hz. VehicleState contains pos/quat/vel/angVel numeric arrays; rpm,gear,auto,tc,abs,speed,trackS,trackD,onTrack,airborne,scrape; ctrl; wheels[{worldPos,omega,steer,spinAngle,contact,slipAngle,slipRatio,load,comp,prevComp,surf}].

Phases: `lobby`,`countdown`,`running`,`finished`. Free Drive is running immediately. Race needs >=2 connected, ready players; owner starts a5s countdown with frozen staggered grid before the finish line. First forward crossing arms lap timer; completing configured full laps records server finish time. Owner cancel/rematch returns grid/lobby. Reject new joins during countdown/running race. Server verifies all laps through authoritative physics. Server handles per-room global road-width/weather settings before stepping (vendor module globals). Expire stale inputs after500ms and brake safely. No global pause.

## Browser modules

`LobbyClient` (src/multiplayer/client.js): EventTarget. Constructor(url), connect():Promise, send(message), disconnect(), setResumeToken(token|null); properties connected,latency,url. Emits `message` CustomEvent(detail=parsed server message), `status` (detail={state:'connecting'|'connected'|'reconnecting'|'disconnected',message?}). Auto reconnect when resume token exists, sends resume on open. Never store token in URLs or render it. Intentional disconnect disables reconnect.

`LobbyUI` (src/multiplayer/lobby-ui.js): creates its own polished modal DOM/CSS and menu/open button. Constructor({onOpen,onCreate,onRequest,onApprove,onLeave,onReady,onStart,onCancel,onKick,onConfigure,onEnter,onClose}), open(),close(),setStatus(message),setLobbies(lobbies),setPending(code),setRoom(room,selfId),setError(message),setAvailable(boolean),setStandings(snapshot). Callbacks receive raw form values or action payloads; root adds localcar/auto/paint. UI exposes driver name, lobby name, mode, laps, route/weather, roomcode request, browse rooms, waiting for approval, owner approve/reject list, players/ready/kick/start/rematch, Enter track, Leave. Route/weather labels use familiar names. No raw server-address entry in enduser flow; build URL configured externally. Must use textContent for user names. Responsive, accessible dialog, focus-safe and keyboard isolation. Root integrates modules in main.js and handles game/session/remote views.
