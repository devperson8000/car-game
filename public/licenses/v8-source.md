# V8 engine sample bank

Author: **CryHam**, 24 December 2024. License: **CC BY 4.0**.

Source: [Stunt Rally 3 engine samples](https://github.com/stuntrally/stuntrally3/tree/fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8/data/sounds/engines), pinned at `fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8`.

Original files: `v8f-1.wav` through `v8f-8.wav` (1,000–8,000 RPM). These were recorded **from engine-sim 0.1.14**, then cut and equalized by CryHam. They are not recordings of a real production car. The upstream attribution/license statement is preserved in [v8-upstream-sources.txt](v8-upstream-sources.txt); see its “vehicle / engines” section. License: https://creativecommons.org/licenses/by/4.0/ (full text in CC-BY-4.0.txt).

APEX adaptations: DC removal, a 12 ms loop crossfade, per-band RMS/peak normalization and Ogg Vorbis encoding. Reproduce using `scripts/prepare-engine-audio.py`; `public/audio/v8/manifest.json` records original and output SHA-256 hashes. Runtime uses equal-power RPM crossfades, continuous RPM pitch tracking, throttle/load volume and filtering, and cockpit attenuation. Attribution does not imply endorsement.

Original WAV URLs follow this pattern (replace N with 1–8):
`https://raw.githubusercontent.com/stuntrally/stuntrally3/fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8/data/sounds/engines/v8f-N.wav`
