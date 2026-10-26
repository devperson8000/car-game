# APEX — Alpine Pass / Nordschleife

A single-player browser driving simulator with a detailed sports car, 240 Hz four-wheel suspension/tire/drivetrain physics, physically based road materials, sun and shadows, and responsive multi-RPM V8 engine audio.

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

A full-screen APEX loading sequence shows actual asset preparation progress before the launch page, with mobile layouts, reduced-motion support, and a retry action if loading fails.

Once loading finishes, press any WASD or arrow movement key to start/resume driving, or use Start your engine. Click the driving view to regain focus. WASD and arrow keys are both supported; inactive touch controls cannot poison keyboard inputs. Active keyboard/touch driving takes priority over a connected controller.

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
| F | Fullscreen / exit fullscreen |

Gamepad: analog left stick steering, RT throttle, LT brake, A handbrake. Keyboard and touch remain available if a gamepad disconnects. Touch controls appear automatically on coarse-pointer devices, or can be enabled in Controls. Backgrounding the tab pauses simulation and audio. TC and ABS buttons toggle actual simulation assists.

Personal bests are saved separately for each route in this browser. Paint, lighting, graphics, camera, mute and touch-control preferences also persist. Private browsing or blocked storage does not prevent driving.

## Verification

```sh
npm test
npm run test:route
npm run build
npm run preview -- --port 4173
# In another terminal, with Chromium installed:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
# Focused loading screen, input handoff, and asset failure/retry checks
TEST_URL=http://127.0.0.1:4173 npm run test:loading
# Real Web Audio checks against the Vite dev server (npm run dev -- --port 5173):
TEST_URL=http://127.0.0.1:5173 npm run test:audio
```

Node tests cover acceleration/braking, analog controls, handbrake release, finite input/state, road contact/barriers, reverse, reset/pause, route sampling and lap validation. Browser checks exercise the production build, assets, controls, cameras, pause, engine audio and responsive layout. Screenshots go to ignored `test-results/`. Software WebGL in a cloud machine is substantially slower than GPU rendering; it cannot establish desktop/mobile frame-rate guarantees.

## Assets and limitations

See `/credits.html` in the app and `public/licenses/` for asset provenance and full notices. The car is Eric Chadwick / Darmstadt Graphics Group's CC BY 4.0 Car Concept. The simulation/track/world core is adapted from bwchoi's MIT Nürburgring Drive; default engine audio uses CryHam’s CC BY 4.0 multi-RPM V8 samples from Stunt Rally 3 (recorded from engine-sim), with Antonio-R1’s MIT waveguide model as a fallback. The original surface textures are ambientCG CC0, retrieved from an accessible public mirror and JPEG-optimized at their original 2K resolution.

The default V8 uses engine-sim samples; the fallback engine, tires, wind, road, shifts and impacts are synthesized. No Sonniss recordings are bundled. Handling is a fictional sports-car tune, not manufacturer-calibrated vehicle dynamics. This is not a professional engineering simulator. There is no traffic, multiplayer, soft-body damage or wheel force feedback. A successful local build does not mean a Vercel deployment has been created.

Engine audio source and modifications: `public/licenses/v8-source.md`. Eight locally hosted RPM loops total about 290 KB; adjacent bands crossfade with continuous pitch, load filtering and cockpit attenuation. Traction control preserves lateral grip under power, including launches in a bend. Rear track matches the fender envelope through wheel rotation and suspension travel.

Choose **Gearbox → Manual** before starting or in the pause menu. Press **E** to upshift and **Q** to downshift; **M** toggles Automatic/Manual while driving. Your gearbox choice is saved. Manual holds the selected gear, including at the rev limiter, and blocks downshifts that would overrev. At rest, Q from first selects reverse; E returns to first.

Choose **Car** in setup to select APEX GT, Subaru BRZ Varis or BMW M3 Race. Each loads its own model and has a separate torque curve, gearing, mass, suspension/tire/aero tune and engine sound bank. Choices persist between visits. Models and handling are game adaptations, not manufacturer calibration. Full source and adaptation notices: `/licenses/additional-cars.md` and `/licenses/car-engine-sources.md`.
