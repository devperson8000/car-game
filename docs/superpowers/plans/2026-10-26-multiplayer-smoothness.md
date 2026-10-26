# Multiplayer smoothness repair

User approved fixing multiplayer after verifying model download availability. All three Sketchfab archive endpoints returned401 authentication required. Listings/previews are accessible, but no archives obtained; no car replacements in this change.

Observed root causes: own state is pulled backward25% every50ms while rotation/velocity/wheels hard-replace; camera consumes that corrected physics pose directly. No processed-input acknowledgements/replay. Remote buffer uses fixed100ms and hard endpoints on gaps, wheel spins un-interpolated; heavy per-player snapshots and hidden DOM updates. Existing functional checks did not measure latency/jitter smoothness.

- [x] Shared complete simulation-state capture/restore and fixed1/60 input frame application, tested deterministic replay.
- [x] Version2 input frames with server acknowledgement/epoch, bounded queues and wall-clock simulation budget; legacy protocol remains functional. Own full snapshot only; compact remote snapshots, less frequent standings. Server remains authoritative.
- [x] Independent fixed-rate local prediction, history replay on acknowledgement, bounded backlog, safe pause/reconnect/grid epochs. Presentation pose preserves continuity during correction and decays error; camera follows presentation pose. Large true resets snap intentionally.
- [x] Adaptive monotonic remote interpolation with bounded extrapolation, interpolated wheels, reduced allocations, shared car asset cache. Validate under bursty/delayed updates.
- [x] Browser tests with delay/jitter, camera continuity checks, unit suite, multiplayer UI/gameplay and solo browser regressions, production build, local lobbies/races, deployment protocol documentation and push realism branch. Do not claim measured hardware frame rates or change hosting plans/regions without evidence.
