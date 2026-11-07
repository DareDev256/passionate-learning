# P1 simulator run: iPhone 18 Pro and iPhone Duo (2026-11-06)

Debug simulator build of `ca.stiersolutions.passionatelearning` (Xcode 27.2). iPhone 18 Pro on iOS 27.0, iPhone Duo on iOS 27.1. Installed, launched and captured with `app/scripts/ios-smoke.sh <device>` (headless boot, `xcrun simctl io ... screenshot`).

## How the screens were reached

`simctl` cannot tap, so screens 02 to 08 came from a scratch build whose `MainViewController` ran JavaScript passed in through `SIMCTL_CHILD_SMOKE_JS` (for example `location.assign("/w/prompt/")`, or answering two cards by clicking the first option). That hook was removed before the final build and never committed. The final build (no hook, no `appStartPath`) was then smoked on both devices, and it produced the dark-launch recordings (09 to 11).

The iPhone Duo was captured **closed**, on its cover display (1398 x 2034 px, about 466 x 678 pt, status bar down the right edge). Its inner display is black while closed. Opening the fold needs the Simulator.app device controls, which take focus, so the open pose was not captured here. The `web-669x951_*` shots are the **web build** in Playwright at 669 x 951, the inner display's size in points, standing in for the open pose.

## The shots

| File | Source | What it shows |
|---|---|---|
| `iphone-18-pro_00a-deep-load-before-router.png` | simulator, scratch `appStartPath: "/w/prompt/"`, Capacitor's router | **RED**: a document load of `/w/prompt/` renders Home. (Also shows the status-bar overlap and the emoji ▶, both fixed later.) |
| `iphone-18-pro_00b-deep-load-with-router.png` | simulator, same scratch path, `StaticExportRouter` | **GREEN**: the Prompt Dojo path renders. |
| `*_01-home.png` | simulator | Home on a fresh install: guide, PLAY, daily quest, worlds. |
| `*_02-world-prompt.png` | simulator, `location.assign("/w/prompt/")` | Prompt Dojo path; deep load through the router. |
| `*_03-round-drawer-open.png` | simulator | A round with two cards answered and the feedback drawer up. |
| `*_04-home-continue-after-kill.png` | simulator | After 03, `simctl terminate` (iOS killing the app), then a cold launch: Home offers **Continue your round** (2 cards answered). |
| `*_05-continue-resumes-card-3.png` | simulator, CONTINUE clicked | The round resumes on card 3 of 6 with two cards done. |
| `*_06-settings.png` | simulator | Settings. |
| `*_07-404.png` | simulator, `/404/` | The branded 404 page. |
| `*_08-missing-path.png` | simulator, `/nope/` | A path with no page serves the root `index.html`, so Home renders (the ruled fallback). |
| `iphone-18-pro_09-dark-launch-before-fix.png` | frames from a Dark Mode launch recording, old launch assets | **RED**: springboard, **black**, then the dark splash (a small white square on near-black), then the white app. Brightness Y: black frames 16 to 17, dark splash 34, app 233. |
| `iphone-18-pro_10-dark-launch-after-fix.png` | Dark Mode launch recording, final build | **GREEN**: icon zoom into the white launch screen, white splash, white page. No frame darker than the springboard after the app appears. |
| `iphone-duo_10-dark-launch-after-fix.png` | Dark Mode launch recording, final build, cover display | **GREEN** on the Duo: springboard, then white launch screen and splash. |
| `*_11-dark-launch-frame.png` | full resolution frame from the Dark Mode recordings | The launch screen in Dark Mode is white. |
| `web-669x951_01-home.png`, `web-669x951_03-round-drawer-open.png` | **web build**, Playwright | The open Duo's inner display size: one stretched column. |

## Defects seen and fixed in this task

1. **Content under the status bar and Dynamic Island** (00a, 00b): `viewport-fit=cover` with no top inset put the rank and token chips, and the round's ✕, in the status bar band, where taps go to the system. `body` now pads by `env(safe-area-inset-top/right/left)`. The right inset also keeps content clear of the Duo cover display's side status bar (all Duo shots).
2. **▶ drawn as a blue emoji** (00a): Archivo Black has no ▶, so iOS fell back to Apple Color Emoji on PLAY, CONTINUE and NEXT. U+FE0E now forces the text glyph.
3. **Deep loads rendered Home** (00a): Capacitor's router answers every extension-less path with the root `index.html`. `StaticExportRouter` serves `<route>/index.html`. The same fix covers the Recap's AGAIN button, which calls `location.reload()` on a round page. That case follows from the same code path and was not captured separately.
4. **Black launch on every cold start, light or dark** (09): SplashBoard logged `Estimated size (29900800) is over limit (25000000)` for the 2732 px splash, marked the launch image bad and showed black for about 3 s. The Splash imageset is now 2400 px (23 MB decoded). The smoke script fails when SplashBoard logs this. Note that `splashboardd` caches the old image until the simulator reboots.
5. **Dark splash in Dark Mode** (09): the generated dark variants (and three unused Capacitor template splash files) are gone, `UIUserInterfaceStyle` is Light, and the launch screen background is white rather than `systemBackgroundColor`.
6. **No resume after iOS kills the app**: WKWebView always cold-starts at `/`. Home now offers the round (04, 05).

## For later (P6 Duo layouts unless noted)

- **Duo open pose not seen on the device.** The inner display is regular width (about 669 x 951 pt). The web stand-in shows one stretched column, which is a candidate for two panes (card and feedback, or path and unit). Capture the open, book and tabletop poses in Simulator.app when focus can be taken.
- **Fixed bars ignore the side insets** (Duo 03): `.drawer`, `.sheet` and `.locked-toast` pad the bottom inset only, so on the cover display the drawer and its NEXT button run under the right status column. Pad them by `env(safe-area-inset-left/right)`.
- **Drawer clearance is zero on the short cover display** (Duo 03): the last option sits flush on the drawer's top edge with its shadow hidden.
- **Missing paths render Home at the wrong URL** (08): the app never links to one, so play is unaffected. Serving `out/404.html` instead is a one-line change in `StaticExportRouter` if wanted.
- **Two red primary buttons on Home while a round is open** (04): CONTINUE and PLAY compete. PLAY could drop to the ghost style while the Continue card shows.
- **World path:** the dotted connector runs through the "you are here" label (02, both devices).
- **404:** the MAP button sits tight under the paragraph (07).
- **Launch time (P8, measure on hardware):** tap to first paint ranged from about 2 s to 9 s on these simulators (cold WebKit after a reboot or reinstall, on a busy Mac). The screen stays white the whole time.
- **Asset regeneration (P8):** rerunning `npx @capacitor/assets generate --ios` would restore the 2732 px splash (black launch) and the dark variants. Rerun with a smaller splash and drop the dark variants, or keep the current imageset. The smoke script catches the black launch.

## Offline

`grep -rE "fetch\(['\"]https?://" app/out/` and the same over `app/ios/App/App/public/` return nothing. `capacitor.config.ts` and the generated `capacitor.config.json` have no `server` key. A Playwright request log over the same bundle (Home, a full round to the Recap, Settings, a world path) saw 96 requests and 0 off the app's own origin. Safari Web Inspector was not used because it needs the Safari window and a manual attach.
