# Realism Upgrade Implementation Plan

> Execute inline with superpowers:executing-plans. User explicitly approved implementation; preserve current cloud checkout and Git history.

**Goal:** Replace arcade dynamics and flat scenery with tested four-wheel physics, a detailed mountain environment, physically based vehicle rendering, sunlight/shadows and responsive audio.
**Architecture:** Keep the published game's recognizable interface and camera choices; use existing vendored MIT four-wheel solver behind a session adapter. Bundle assets locally. Provide a fictional mountain circuit as the primary scenic route and the authentic Nordschleife as a secondary option.
**Tech Stack:** Three.js, Vite, JavaScript modules, Node tests, Playwright.
**Spec:** Approved conversation direction, docs/superpowers/specs/2026-10-24-driving-simulator-design.md and docs/reviews/2026-10-24-current-main-review.md. Mountain map supersedes the original Nürburgring-only scope.

## Global Constraints
- No third-party runtime hotlinks, source analytics, or noncommercial car models.
- Retain detailed licensed GLB and preserve CC BY/MIT/ODbL notices.
- Fixed-step 240Hz four-wheel solver, bounded elapsed time, analog gamepad inputs, actual barriers.
- Do not claim scanned real-world scenery, authentic recordings, calibrated dynamics or deployment without evidence.

## Review Focus
- Handbrake release must restore grip and analog pedals must remain analog.
- Road/terrain height and barriers must agree with wheel contacts, including crossovers.
- Background/pause and disconnects clear held controls; invalid lap crossings earn no lap.
- All quality settings retain environment lighting and contact shadows; settings update immediately.
- Asset failures show a retry action, never a silently substituted car/map.

### Task 1: Physics and map definition
- [x] Write regression tests for analog acceleration, handbrake release, barrier containment, resets, lap progression and mountain map closure/grade; observe failure.
- [x] Add src/sim/routes.js and upgrade Session to select routes, normalize finite controls and retain tested fixed-step solver. Tune model/physics alignment.
- [x] Run all Node tests and record outcomes.

### Task 2: Graphics and controls
Files: src/{main,scene,vehicle,input,hud,materials,vegetation}.js and src/style.css; index.html.
Interfaces: Session.vehicle owns physics; World uses the same Track.edge/query as wheels; CarView.update(vehicle) binds local model wheels to actual worldPos and spin; Input.sample returns numeric controls; HUD reads actual telemetry.
- [x] Add browser smoke assertions for real assets, driving/braking/steering, cameras, pause/reset, quality/weather changes, audio worklet and responsive layout; observe failure against current app.
- [x] Implement textured asphalt/grass/rock, terrain and forest, sky/sun/environment, proximity shadows, car PBR materials and cockpit, gamepad/touch, HUD, quality and weather settings.
- [x] Inspect screenshots and production browser checks; fix material failures.

### Task 3: Audio and delivery
Files: src/audio.js, public/credits.html, README.md, tests/browser.mjs, vercel.json.
- [x] Integrate MIT waveguide engine worklet with slip/road/wind/shift/impact layers and actual pause/mute.
- [x] Run production build, physics and browser checks, fresh whole-change review and material fixes.
- [x] Save reusable tested startup instructions; deploy only with supported authenticated Vercel access. Preserve all work in reviewable commits and report tested limits.

## Delivery evidence

Fresh npm ci, 19 unit tests and production build passed. Browser suite passed both routes, golden-hour detailed trees, car/track assets, driving/braking/reset, cameras, pause, worklet audio and responsive controls with zero page errors or failed requests. Direct Vercel access is unavailable in this session; a source push alone does not verify deployment. No hardware frame-rate guarantee or full manual lap is claimed.
