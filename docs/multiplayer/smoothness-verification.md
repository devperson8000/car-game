# Multiplayer smoothness repair verification

## Model download check

Checked the actual Sketchfab `/v3/models/{id}/download` endpoints for the shortlisted Porsche 911 GT3 (`78d5c47ab2554c2592b7e499179a0792`), McLaren P1 (`adae2edc721e4ce7b31c1d06a581e30a`) and Lamborghini Centenario (`d679af35b5694301a185c7454a700c73`). All returned HTTP401: authentication credentials required. Listings and thumbnails are accessible, but no model archives were downloaded, no geometry inspection was claimed, and no cars were replaced. A signed-in download is needed before those assets can be evaluated for integration.

## Changes and measured scope

- Complete simulation snapshots include drivetrain, suspension, parking, reverse and lap state. Processed frame acknowledgements let the local client restore server state and replay unacknowledged input rather than repeatedly pulling the car backwards.
- Fixed input simulation runs independently of render frames. Server queues and simulation time remain bounded; resets, safety braking, reconnects and grids use new input epochs.
- Car and camera use a continuous presentation pose. Small corrections decay visually; actual recoveries/grids reset intentionally.
- Remote interpolation adapts100–220ms to uneven delivery, with bounded extrapolation. Recovery from an underrun preserves position, orientation and wheel continuity, then catches up over150ms; it no longer jumps when a burst arrives.
- Shared prefab geometry/textures and private materials avoid repeated loading/parsing and preserve independent paints. Driver labels project against the current camera and do not repeatedly rewrite unchanged names.
- Own solver state is sent only to its owner; other cars use compact display state. Eight-player fixture:8,943 versus15,852 JSON bytes (about44% reduction). Standings are sent at most2Hz plus forced phase/finish updates.

## Verification

- All 87 unit/integration tests passed. Coverage includes deterministic full-state replay, delayed acknowledgements, stale epochs, bounded queues/time budgets, approval security, legacy compatibility, gap recovery, wheel phase, shared asset lifetime and presentation continuity.
- The ten-second deterministic network loop injects160–320ms round trips and ordered burst delivery. After warm-up, reconciliation error stays below1mm; displayed pose remains continuous across corrections.
- Production-browser lobby/driving/race flow runs normally and with per-direction delay/jitter (up80–160ms; down80–350ms), asserts v2 negotiation and fixed-frame input delivery, and covers remote display, readiness/countdown/cancel/leave.
- Solo production-browser regression passed both routes, all keyboard controls, three cameras, pause, audio and responsive rendering, with no page errors or failed HTTP responses. The pause action now flushes the throttled HUD immediately so the displayed lap clock freezes consistently.
- UI checks retain mobile/name safety and expired-session recovery. A standard production build continues to use the supplied Northflank URL; local browser testing overrides it explicitly.

These tests verify synchronization behavior, not a laptop GPU frame-rate guarantee or the live Northflank instance's capacity/region latency. The RTT badge helps distinguish network distance from rendering performance.

## Deployment

Redeploy Northflank and Vercel from `codex/realism-upgrade`, then open a fresh lobby. Both services need the new protocol for acknowledged replay. The public endpoint and `ALLOWED_ORIGINS` configuration remain unchanged.
