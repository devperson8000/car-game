# Driving Simulator Implementation Plan

> For agentic workers: use superpowers:executing-plans. User approved immediate implementation.

**Goal:** Ship a playable detailed-car Nürburgring simulator and prepare/deploy on Vercel when authenticated access exists.
**Architecture:** Vite and Three.js with locally vendored MIT simulation/track code, Khronos GLB, a fixed-step session adapter, and a new renderer/UI/audio layer.
**Tech Stack:** JavaScript ES modules, Three.js, Vite, Node test runner, Playwright/Chromium.
**Spec:** docs/superpowers/specs/2026-10-24-driving-simulator-design.md

## Global Constraints

- Existing cloud checkout is isolated; do not create a worktree.
- Keep runtime assets local; preserve MIT, CC BY, and ODbL notices.
- 240 Hz bounded simulation; no spline-constrained vehicle.
- No paid assets, analytics, backend, or claims of manufacturer calibration.

## Review Focus

- Background tabs and pause must not retain throttle or cause time jumps.
- Full laps require circuit progress; reset/teleport cannot award laps.
- Asset/audio failures must be visible and retryable.
- Camera viewpoints must not intersect the car or terrain.
- Small screens and gamepad disconnect must retain usable controls.

### Task 1: Simulation and assets

Files: package.json, src/vendor/*, src/sim/{spec,session}.js, tests/simulation.test.js, public/models/*, public/licenses/*.
Interfaces: Session(track) exposes vehicle, advance(dt, controls), reset(), paused, lap timing; updateLap(s,dt) rejects teleports and reverse crossings.
- [ ] Write and run tests for stability, acceleration/braking, turning, reset, bounded elapsed time and lap validation (expected red before implementation).
- [ ] Vendor required upstream modules with notices; integrate model and fictional sports-car tune; implement Session.
- [ ] Run npm test; all tests pass. Commit.

### Task 2: Playable scene and interface

Files: index.html, src/{main,scene,vehicle,input,audio,hud}.js, src/style.css, tests/browser.mjs.
Interfaces: Scene loads GLB and circuit, updates from Session.vehicle; Controls.sample(dt,vehicle) returns smoothed controls; Audio follows physics; HUD displays actual telemetry.
- [ ] Add browser smoke assertions for loading, real drive/brake/turn, pause/reset, cameras, audio worklet, mobile buttons and console/network failures; run against missing app to establish red.
- [ ] Implement PBR scene, detailed model wheel binding, daylight/golden-hour sky, proximity shadows, quality control, responsive HUD/menu, keyboard/gamepad/touch and layered audio.
- [ ] Run browser checks against production build, inspect screenshots and fix any failures. Commit.

### Task 3: Delivery

Files: README.md, public/credits.html, vercel.json, .gitignore, saved environment instructions.
- [ ] Document controls, licensing and setup; run npm test, production build and browser checks.
- [ ] Perform fresh whole-change code review, fix material issues and rerun affected verification.
- [ ] Check supported authenticated Vercel access; deploy if available, otherwise give the precise connection requirement without claiming deployment.
- [ ] Save tested install/start instructions for this cloud environment and report concrete results.
