# Nürburgring driving simulator — proposed design

Status: awaiting user review. No application implementation has started.

## Intent

Build a browser sports-car simulator in devperson8000/car-game, deployable to Vercel, so the user can drive a detailed car around a real circuit. The user selected a realistic car, map, and sounds through the preceding research and requested review before implementation. Prioritize convincing handling, attractive lighting, reliable controls, and a playable complete lap. This is a browser simulator, not a claim of manufacturer-validated vehicle dynamics or photogrammetric scenery.

## Approaches

1. **Recommended: integrate the selected assets with the existing open-source Nürburgring simulation core.** Reuse attributed MIT track/physics/audio modules from esc5221/drive-game at commit 19f68235ef6ac370fdb7e2930bfb1a07a27e481e. Build a new interface, detailed concept-car integration, and lighting. This provides four-wheel suspension and a working track without inventing a physics engine from scratch. Keep this dependency vendored and attributable rather than loading scripts from the original author's site.
2. **New physics engine and custom map.** Greater control but substantially more work and tuning, with a higher risk of weak handling. It also discards the real circuit the user already selected.

Approach 1 is the builder's recommendation; it has not yet been approved. Do not copy the reference site's branding, analytics, multiplayer services, or bundled third-party car models.

## Experience and visual design

A full-screen 3D scene remains visible behind a compact launch card. Use a restrained dark interface, warm white text, a red accent, and tabular telemetry. The launch card explains controls, shows loading progress, and enables Drive only when the car and circuit are loaded. Starting enables audio through the user's gesture. Errors show a useful retry message rather than silently substituting a block-shaped car.

Default view: damped chase camera showing the detailed car. Offer cockpit and hood views with C and a visible button. Render the concept car with physically based materials, environment reflections, soft shadows, tone mapping, and a natural daylight sky. Low-sun lighting is optional if it can be offered without distracting from the working daytime drive. Use instanced vegetation and improve the road/terrain presentation within the browser frame budget. The existing source's trees are stylized; do not promise a photorealistic scanned forest.

HUD: speed in km/h, gear, RPM, throttle/brake indicators, named circuit section, lap timer, best completed lap, and a minimap. Include Pause, Reset, Camera, Sound, and Controls buttons. Pause stops simulation time; returning from a background tab cannot create a large physics jump. Lap completion must require forward progress around the circuit rather than simply crossing the start line.

## Vehicle and physics

Use Khronos Car Concept, an approximately 11.8 MB self-contained GLB with interior and separate wheel nodes. It is a fictional car; handling values are explicitly a plausible sports-car tune, not factory specifications. Start with rear-wheel drive, automatic gearbox, traction control, and ABS. The builder chooses conservative mass, torque curve, wheelbase, suspension, damping, and gearing consistent with the model's dimensions, and records those choices in source comments.

Run fixed-step 240 Hz simulation with a bounded accumulator. Preserve suspension contact, combined longitudinal/lateral tire grip, drivetrain/gear changes, aerodynamic drag, braking, and guardrail collisions from the source core. Bind wheel steering/spin and suspension motion to the actual visual wheel hierarchy. Do not implement motion as a car constrained to a spline. Allow grass/off-road driving within the modeled corridor, with reduced grip and a reset if stranded or inverted. Reset returns the car to a safe nearby track position at rest.

Controls: W/Up throttle, S/Down brake and reverse near standstill, A/D or Left/Right steering, Space handbrake, C camera, R reset, Escape/P pause. Offer gamepad steering and trigger pedals when connected, with keyboard fallback. Provide touch steering and pedals for basic mobile play. Clear held input on blur/pause to prevent stuck acceleration. Controls must work without scrolling the page.

## Circuit

Use the reference's approximately 20.7 km Nürburgring track data and elevation data. Reuse its procedural road, curbs, barriers, terrain, and scenery as appropriate. Preserve road/physics agreement through elevation changes and crossovers. Bundle all runtime data locally. No live map service, backend, account, or API key is needed to drive.

## Audio

The intended recorded sources are the Sonniss GDC Huracán engine and tire-skid collections identified in research. Their files and current license have not been downloaded or verified because this environment blocks those domains. They cannot be represented as included assets.

For the initial complete build, use the verified MIT procedural waveguide engine implementation already present in the reference, with a sports-car profile and layers for RPM/throttle, shift events, tire slip, road rumble, wind, and impacts. Describe it as synthesized audio. Enable sound only after a user gesture; provide mute and suspend sound while paused/backgrounded. Recordings can later replace or supplement the synthesis after download and license checks, without blocking the playable build.

## Licensing

Include third-party notices in the repository and a visible Credits link. Preserve MIT copyright/license notices for reused code. Credit Eric Chadwick / Darmstadt Graphics Group GmbH for Car Concept under CC BY 4.0 and identify adaptations. Handle included Khronos logos under their separate terms; prefer removal of branded decal imagery if needed after inspecting those terms. Credit OpenStreetMap contributors, link ODbL 1.0, and keep redistributed/derived track data available under the applicable ODbL requirements. Preserve elevation-source credit. No unrelated noncommercial car meshes may be copied from the reference.

## Implementation and deployment

Use Vite, JavaScript modules, and Three.js. The repository is empty, so there is no framework to preserve. Separate scene/car rendering, simulation adapter, audio, controls, and UI into manageable modules. Keep all runtime models, textures, worklets, and data in the build; avoid third-party hotlinks. Vercel serves the built static dist directory. Include package scripts, a lockfile, deployment configuration as necessary, and concise local/deployment instructions. No server functions are required.

The user explicitly requested creating a Vercel project and deployment. No Vercel connector tools or CLI authentication are currently available in the session. Once implementation is built and verified, use a supported authenticated Vercel connection if it becomes available; otherwise deliver a deployment-ready repository and report the exact remaining connection step. Do not claim a project or deployment exists without a successful provider response. Do not request secret tokens in chat. Do not make deployment availability block local implementation after design approval.

## Performance and failure handling

Target smooth desktop driving and a reduced-cost mobile mode; actual frame rates must be measured rather than promised. Cap pixel ratio, avoid per-frame allocation in physics, use instancing and distance visibility, limit shadow coverage to the car vicinity, and offer graphics quality selection. Load the single vehicle once. Handle missing WebGL with an explicit unsupported-browser message. Network failures loading local assets must be visible and retryable.

## Validation and completion

Require a production build and browser smoke test. Verify GLB loading, visible rendered car/track, acceleration, braking, left/right steering, wheel animation, reset, pause/resume, camera changes, sound/mute, and responsive touch controls. Use meaningful deterministic tests for standstill stability, finite physics state, acceleration/braking, guardrail containment, and lap counting. Inspect browser console and production asset requests, including worklets. Check no external analytics or original backend calls remain. Run deployment smoke checks if deployment access becomes available. Report tested capabilities, measured limitations, and any deployment blocker candidly.

## Out of scope for the initial release

Multiplayer, accounts, traffic AI, multiple vehicle brands, damage deformation, wheel force feedback, paid assets, and promises of laser-scanned circuit fidelity. These are independent additions, not prerequisites to the user's playable solo simulator.
