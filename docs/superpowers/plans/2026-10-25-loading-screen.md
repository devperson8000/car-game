# Loading screen

User requested a polished loading screen before the existing engine-start page. Implement directly within the approved APEX visual language: dark racing presentation, original vector car artwork, subtle motion, real asset progress/stages and a fade to the ready screen. No artificial loading delay or fake countdown. Keep gameplay inaccessible until loading and the transition finish; failures stay on the loader with a working retry. Respect reduced motion and mobile safe areas.

- [x] Browser regression: hold the car asset; assert loader visible and launch controls inert; capture desktop/mobile views. Release and verify transition to ready. Abort a required asset and verify loader error/retry.
- [x] Add early-loaded HTML/CSS loader and progress/error/transition controller; wire real bootstrap progress and first rendered frame.
- [x] Build, run unit tests and focused browser checks; verify existing keyboard start still works after transition; push codex/realism-upgrade.

Verified: 27 Node tests passed; production build passed; focused Chromium loading checks passed, including blocked input before readiness, desktop/mobile screenshots, keyboard handoff, reduced-motion completion, failed asset/retry recovery and reachable retry at 568×320. Review found landscape clipping; fixed with scrollable overflow.
