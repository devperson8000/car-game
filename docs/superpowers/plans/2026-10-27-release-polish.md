# Multiplayer and realism release polish

Goal: finish the existing simulator and publish the verified result to main, as requested. Keep the current Three.js renderer, authoritative WebSocket server, fixed-frame prediction, cars and maps. Changes repair observed behavior; no new asset downloads, framework or hosting changes.

- [x] Server: reproduce and repair inconsistent race-lobby motion and countdowns after membership changes. Verify authority, mixed protocols, assists and reconnect behavior with focused regressions.
- [x] Client: reproduce and repair lobby close/resume and stale lifecycle state; verify controls, prediction, joins, expiry and disconnect handling with browser and unit checks.
- [x] Realism: reproduce cockpit bank alignment and tire audio that ignores wheelspin/contact; use physical wheel state, preserve chase comfort and existing tuning.
- [x] Verification: full unit suite, real Web Audio, loading/garage/manual flows, production solo driving, delayed/jittered multiplayer with real WebSockets, mobile UI and multi-car rendering. Software WebGL is not a hardware performance benchmark.
- [x] Review the complete diff, merge the current remote main without dropping changes, test the merged result, then push main without force. The user has explicitly authorized the main push. Document deployed-service requirements and limits.
