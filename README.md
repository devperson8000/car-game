# APEX — Alpine Pass / Nordschleife

A single-player browser driving simulator with a detailed sports car, 240 Hz four-wheel suspension/tire/drivetrain physics, physically based road materials, sun and shadows, and responsive synthesized engine audio.

## Run

Requires Node.js 22.12+ (Node 24 is supported).

```sh
npm ci
npm run dev
```

Production: `npm run build`, then `npm run preview`. Vercel uses the Vite build and serves `dist/` using the included `vercel.json`. No backend, API keys or remote runtime asset hosts are required. A plain Python file server cannot resolve source package imports; use Vite or serve the built `dist` folder.

## Routes and rendering

- **Alpine Pass** (default): an original fictional closed scenic mountain route, with a forest, road markings, guardrails, terrain and textured verges. It is not a scanned location or a downloaded photoreal map.
- **Nordschleife**: bundled real-world circuit geometry and elevation, with generated scenery. Source attribution and a downloadable copy of the derived track data appear in Credits.
- Nearby trees use locally vendored MIT EZ-Tree geometry and verified leaf textures; distant foliage is instanced and culled by distance.
- Bundled 2K ambientCG asphalt, grass and ground maps include albedo, normal and roughness. Sun direction, physical sky, environment reflections, contact shadows and nearby dynamic shadows remain available across quality settings. High quality adds refractive glass; lower settings use transparent glass to avoid a second full-scene transmission pass.
- Choose the route, light, quality and paint in the launch/pause menu. Changing route starts a new session. Wet-road lighting also reduces tire grip.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Throttle; brake out of reverse, then forward |
| S / Down | Brake; hold at rest to engage reverse |
| A D / Left Right | Steering |
| Space | Handbrake |
| C | Chase / cockpit / hood camera |
| R | Recover near your current circuit position; restart current lap |
| M | Automatic / manual gearbox |
| Q / E | Shift down / up |
| P / Escape | Pause / resume |

Gamepad: analog left stick steering, RT throttle, LT brake, A handbrake. Keyboard and touch remain available if a gamepad disconnects. Touch controls appear automatically on coarse-pointer devices, or can be enabled in Controls. Backgrounding the tab pauses simulation and audio. TC and ABS buttons toggle actual simulation assists.

## Verification

```sh
npm test
npm run test:route
npm run build
npm run preview -- --port 4173
# In another terminal, with Chromium installed:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Node tests cover acceleration/braking, analog controls, handbrake release, finite input/state, road contact/barriers, reverse, reset/pause, route sampling and lap validation. Browser checks exercise the production build, assets, controls, cameras, pause, audio worklet and responsive layout. Screenshots go to ignored `test-results/`. Software WebGL in a cloud machine is substantially slower than GPU rendering; it cannot establish desktop/mobile frame-rate guarantees.

## Assets and limitations

See `/credits.html` in the app and `public/licenses/` for asset provenance and full notices. The car is Eric Chadwick / Darmstadt Graphics Group's CC BY 4.0 Car Concept. The simulation/track/world core is adapted from bwchoi's MIT Nürburgring Drive; engine DSP is derived from Antonio-R1's MIT waveguide model. The original surface textures are ambientCG CC0, retrieved from an accessible public mirror and JPEG-optimized at their original 2K resolution.

Engine, tire, wind, road, shift and impact audio are synthesized, not the previously researched Sonniss recordings. Handling is a fictional sports-car tune, not manufacturer-calibrated vehicle dynamics. This is not a professional engineering simulator. There is no traffic, multiplayer, soft-body damage or wheel force feedback. A successful local build does not mean a Vercel deployment has been created.
