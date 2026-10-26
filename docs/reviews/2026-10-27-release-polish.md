# Multiplayer and realism release polish

## Changes

- Race countdowns remember their entrants and latch interrupted connections, including a disconnect and resume between server ticks. Leaving, being removed or losing connection returns everyone to readiness. Fresh readiness can start again. Legacy clients stay stationary in the race paddock, matching current clients.
- Lobby Start follows the same connected/ready rule as the server. Closing the multiplayer panel resumes a previously active, connected drive. Unrelated lobby updates preserve the host's setup draft; changed server settings replace it.
- Joining or resuming clears old finish state, snapshots and remote presentation history. Protocol negotiation resets correctly when reconnecting to an older server. Reconnection retains the approved member, rotates the token, resets the input epoch and stays paused until the driver enters again.
- Cockpit and hood cameras follow chassis banking. Chase keeps a level horizon. Tire sound now responds to grounded wheels, longitudinal slip and actual contact surfaces: straight wheelspin and locked braking are audible, airborne road/tire noise fades out.
- Returning to solo restores the selected car's stored personal best rather than displaying the online session's empty best time. Online results do not overwrite local records.

## Evidence

- `npm run build`: passed on the final main-branch tree. Bundle verified to contain the production Northflank address and no local WebSocket test URL.
- `npm test`: 99 tests passed. New camera, tire-audio and server regressions cover the repaired behavior. Server and camera failures were reproduced before fixes; a browser assertion reproduced the solo personal-best display regression.
- `TEST_CAR=apex|brz|m3 node tests/route-smoke.mjs`: each car completed all 5.04 km of Alpine Pass with zero off-road frames and zero rollovers using the conservative test driver. This is a physics check, not a gameplay autopilot.
- `tests/audio.mjs`: actual Web Audio decoding/rendering, unclipped multi-RPM engine output, straight-slip tire sound, airborne silence, mute, pause/resume and missing-sample fallback passed.
- `tests/multiplayer-ui.mjs`: mobile overflow, safe names, approval/readiness, host draft preservation, authoritative settings replacement, online panel close/resume and expired-session recovery passed.
- `tests/multiplayer-reconnect.mjs`: real browser controller and WebSocket server passed membership resume, new epochs, safe pause, assists, manual shifting, continued driving and bounded acknowledged history.
- `tests/browser.mjs`: production solo driving passed both routes, keyboard controls, cameras, audio, pause and responsive layouts without page errors or failed HTTP requests.
- `tests/multiplayer-browser.mjs`: production lobby approval, remote BRZ rendering, acknowledged driving, race readiness/countdown/start/cancel, leave and solo personal-best restoration passed normally and with ordered network jitter (80–160 ms upstream, 80–350 ms downstream).
- Manual E/Q shifting, M toggle, paused input isolation and saved manual choice passed. BRZ and M3 browser checks passed selected models, actual driving, distinct eight-loop audio banks, cockpits and mobile layouts. Loading checks passed desktop/mobile gating, keyboard handoff, reduced motion and asset failure/retry.
- Independent review found the between-tick countdown reconnection race. A regression reproduced it and verified the interruption latch and fresh readiness. Review then found no remaining actionable issues.

An eight-driver local Nordschleife probe ran 600 simulation ticks with every frame processed, about 0.63 ms mean and 0.93 ms p95 for input/tick/snapshot work on this worker. This is not a capacity guarantee for Northflank or a GPU frame-rate benchmark. Browser graphics checks use software WebGL. Existing maps, models, physics calibration and noncolliding multiplayer cars remain the current game approximations; no replacement assets were downloaded.

## Deployment

Publish both frontend and backend from the release commit on `main`. Vercel uses the production Northflank WebSocket URL already committed in `.env.production`; explicit Vercel environment variables override it. Northflank runs `Dockerfile.multiplayer`, one instance, port 3001 and `/health`. Its public health endpoint returned `{"ok":true}` during this pass. Host settings and deployments are not managed from this workspace; verify that both services rebuild the release and open a fresh lobby. In-memory sessions end when the backend restarts.
