# Distinct cars, then multiplayer

User authorizes implementation and delegates mode details. Work on codex/realism-upgrade, preserving solo play and laptop controls. Finish and verify cars before implementing multiplayer.

## Cars
- [x] Convert BRZ Varis and BMW M3 race-car source models with verified upstream notices into optimized textured GLBs, normalized wheel/cockpit mounts; retain APEX GT. Veneno deferred until exact license terms and genuine AWD support are resolved.
- [x] Independent per-car physics: mass/inertia, torque/RPM/gears, suspension/tire/aero tuning matched to geometry. Clearly game approximations. Add persistent car selector and descriptions.
- [x] Distinct boxer-four and race V8 audio banks with author/license/provenance and robust fallback. Lazy-load selected car only.
- [x] Validate car files, geometry, all tests/build and browser selection/control/audio; commit cars.

## Multiplayer (after cars)
- [ ] Persistent WebSocket lobby server, maximum eight accepted players; explicit owner approval/rejection of join requests; pending clients see only waiting status. Room codes, names, owner transfer/disconnect cleanup, rate/payload validation.
- [ ] Free Drive: shared route/weather, accepted players spawn safely, smooth remote car interpolation, noncolliding cars, owner can change session settings and remove members. Opening a menu parks only that player; no global pause.
- [ ] Race: owner selects route/laps, ready-up, countdown and staggered grid. Server validates progress/checkpoints and crossing order; laps/positions/results. Reject join requests during race, return to lobby/rematch. Avoid claiming strong anti-cheat without authoritative server physics.
- [ ] Integrate lobby dialog, owner requests/controls, connection state, race HUD, remote car models and interpolation. Solo remains usable offline; no remote server configured => clearly explain connection requirement, never fake players.
- [ ] Test real multiple WebSocket clients for approval security, routing, capacity, disconnects, races, validation; browser multiplayer flow and solo regressions. Add Docker/deployment instructions for a persistent server while frontend remains Vercel hosted.

Deployment: existing repo contains only static Vite/Vercel frontend; persistent server deployment requires a suitable runtime/service. Complete locally testable deployable server and integration first, then identify any account/endpoint configuration needed to make internet multiplayer live. Do not invent a hosted endpoint.

Car stage verified: 46/46 Node tests, full Alpine route smoke (zero off-road/rollovers), production build, both-car gameplay selection/driving/audio/cockpit/mobile browser checks, both audio-bank real Web Audio render/fallback checks. Final visual inspection fixed BRZ heading and BMW lamp placement; added heading regression and normalized geometry tests. Personal bests and paint persist independently per car. Low-speed tire slip denominator regularized to prevent numerical wheelspin/lockup alternating during lighter-car launches; higher-speed grip unchanged.
