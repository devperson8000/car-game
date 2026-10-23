# APEX / Nürburgring Drive

An immersive single-player browser driving simulator using Three.js, the Nürburgring Nordschleife layout and Khronos's detailed Car Concept glTF asset.

## Play

Open the deployed website, press **ENTER DRIVE**, then use **WASD / arrow keys** or a gamepad. **C** cycles chase / hood / cockpit cameras, **Space** is the handbrake, **R** resets the car, **N** changes weather and **M** enables or disables the HUD map.

## Features

- Real 20.7 km Nordschleife track shape and sampled elevation
- Detailed CC BY 4.0 sports-car GLB (with immediate procedural fallback)
- Continuous vehicle simulation, steering response, grip, drag, gears and road-edge effects
- Dynamic cameras, shadows, tree scenery, atmospheric effects, speedometer, tachometer, mini-map and synthesised engine audio
- Desktop keyboard, gamepad and mobile touch controls
- Static Vercel deployment: no backend and no secrets required

## Licensing and sources

- Car: [Khronos glTF Sample Assets — CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), CC BY 4.0. Logos and trademarks belong to their owners.
- Track: [esc5221/drive-game](https://github.com/esc5221/drive-game) geometry, OpenStreetMap contributors, ODbL 1.0; elevation source open-elevation.com / SRTM. Derived track database remains governed by ODbL. Runtime track data is loaded from its original public source.
- Procedural graphics, physics, UI and synthesised sounds in this repository are newly implemented. No third-party vehicle recordings are bundled.

This is a driving **game**, not a verified professional vehicle dynamics simulator. It works best in a desktop browser with WebGL2. The 3D model and track source are downloaded at runtime; their third-party hosting must remain available for the highest-detail mode.

## Development

Serve the project directory with a local HTTP server, such as `python3 -m http.server 8080`. Navigate to `http://localhost:8080`. This is a static web app, requiring no build.
