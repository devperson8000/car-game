# Boxer-four and race V8 engine sample banks

Author: **CryHam**, 24 December 2024. License: **CC BY 4.0**.

Source: [Stunt Rally 3 engine samples](https://github.com/stuntrally/stuntrally3/tree/fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8/data/sounds/engines), pinned at `fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8`.

- `public/audio/boxer4/1.ogg` through `8.ogg`: `su-oe-1.wav` through `su-oe-8.wav`, used as the Subaru BRZ's flat-four-inspired sound.
- `public/audio/race-v8/1.ogg` through `8.ogg`: `b-v8-1.wav` through `b-v8-8.wav`, used as the BMW M3 race car's V8-inspired sound.

These are **engine-sim 0.1.14 recordings**, cut and equalized by CryHam at 1,000–8,000 RPM. They are not real-car recordings or manufacturer-supplied audio and do not establish the exact engine configuration of a production vehicle. Upstream's attribution applies to all engine series; the preserved statement is in [car-engine-upstream-sources.txt](car-engine-upstream-sources.txt), “vehicle/* engines”. License: https://creativecommons.org/licenses/by/4.0/ (full text in [CC-BY-4.0.txt](CC-BY-4.0.txt)). Attribution does not imply endorsement.

APEX adaptations: DC removal, a 12 ms seam crossfade, per-band RMS normalization to 0.20 with peak capped at 0.85, and Ogg Vorbis quality 6 encoding. Runtime adds equal-power adjacent-RPM crossfades, continuous pitch tracking, load-dependent low-pass filtering and gain, and cockpit attenuation. These banks retain different source timbres rather than pitching the existing V8 into another engine.

Reproduce with Python 3 and ffmpeg (libvorbis): download each named WAV from `https://raw.githubusercontent.com/stuntrally/stuntrally3/fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8/data/sounds/engines/` into a source directory, then run:

```
python3 scripts/prepare-car-engine-audio.py SOURCE_DIR public/audio
```

The dedicated script uses bit-exact ffmpeg flags and strips metadata for reproducible output with the same ffmpeg/libvorbis version. Each bank's `manifest.json` preserves its pinned source URL/revision, source filename, RPM, original WAV SHA-256, output Ogg SHA-256 and encoded byte count.
