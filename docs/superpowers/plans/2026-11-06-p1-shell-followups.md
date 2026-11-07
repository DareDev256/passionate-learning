# Phase 1 follow-ups (from the SDD ledger, 2026-11-07)

Rulings made during Phase 1 and every deferred finding, kept for P2 and P8 planning. Source: the run's ledger.

## Rulings
- ## Rulings
- Ruling: T1 ships `app/e2e/serve.mjs`, a tiny Node static server (directories → index.html, missing → out/404.html with status 404), and playwright.config uses it instead of python http.server — matches how Vercel and the app serve 404s — if wrong, one config line swaps it back.
- Ruling: RouteGuard moves from T6 to T8 Step 3 (built only if the deep-load check fails) — the check can't run before the iOS project exists — costs nothing if the check passes.
- Ruling: T7's asset renderer is `scripts/render-assets.tsx`, run with the existing `tsx` dev dependency: `renderToStaticMarkup(<Logo/>)` then a Playwright screenshot — avoids shipping a throwaway route — if Logo needs browser-only APIs, fall back to a hidden page under /dev/ excluded from the export.
- Ruling: the 2 pre-existing lint findings (RoundPlayer use-memo deps error, WorldView unused var) get fixed in Task 9 before its all-green check — npm run lint is part of Task 9's gate — costs one small commit.
- Ruling: Task 6 installs @capacitor/core@8 and @capacitor/haptics@8 (it imports them); Task 7 installs the rest (ios, app, splash-screen, status-bar, cli, assets) — the plan installed all of them in Task 7, after Task 6 needs them — costs nothing.
- Ruling: Task 7 Step 1 also upgrades next to 16.4.5 (and eslint-config-next to match) — npm audit --omit=dev reports critical advisories for next 16.0.0-16.4.0 (GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r); a static export doesn't run the vulnerable server paths, but the security protocol says fix critical/high — costs a re-run of build + e2e.
- Ruling: Task 8 fixes the dark-mode launch flash (UIUserInterfaceStyle Light in Info.plist, remove the generated dark splash variants or regenerate with a white dark background; LaunchScreen background white, not systemBackgroundColor) — the app is white-paper only and a dark flash before a white app is a visible defect — costs a regenerate.
- Ruling: Task 8 adds a "Continue your round" card on Home driven by a new roundResume.peekInProgress(now) (any unit, under 30 min) — WKWebView cold-starts at the root, so Task 4's resume never triggers on the phone after iOS kills the app; this is a plan gap — costs one small component + tests.
- Ruling: RouteGuard (if Capacitor's asset handler falls back to the root index.html for extension-less paths) runs on every platform, not only isNative() (on the web it never mismatches, so it's a no-op), and is tested in Playwright by a serve.mjs SPA-fallback mode (env CAP_SPA=1) that mimics Capacitor — the simulator can't be scripted for a deep load — costs one env branch in serve.mjs.
- Ruling (supersedes the RouteGuard ruling): Capacitor iOS's CapacitorRouter maps every extension-less path to the root index.html (Router.swift:23), so deep loads render Home. Fix natively: a StaticExportRouter (extension-less path → <path>/index.html when that file exists in the bundle, else root index.html) returned from a CAPBridgeViewController subclass's router(); verify RED/GREEN in the simulator with a scratch build using server.appStartPath "/w/prompt/" (never committed). RouteGuard only if the native router can't be wired — serves the right HTML instead of patching after hydration — costs two small Swift files.
- Ruling: Task 9 adds the vendored phaser.min.js and the gitignored ios/ build copies (ios/App/App/public, ios DerivedData) to eslint globalIgnores, plus the two pre-existing lint findings, so npm run lint is green for Task 9's gate — costs one config edit.

## Deferred findings
- Task 1: minor (deferred): playwright.config hardcodes the /Users/t./ fallback browser path (only used when the bundled one is absent)
- Task 1: minor (deferred): answerFirstCard has no order-card path; its type-card path is not yet run live (Task 5 exercises round pages)
- Task 1: minor (deferred): serve.mjs content-type map lacks ico/jpg/webp/map/woff
- Task 2: minor (deferred): vitest exclude replaces defaults; spread configDefaults.exclude
- Task 2: minor (deferred): reduced-motion shake test has no positive-control twin
- Task 2: minor (deferred): LockedScreen hard-codes "70%" (derive from UNLOCK_AT)
- Task 3: minor (deferred): privacy page says Reset "removes it" after listing settings, but Reset keeps settings; reword to "removes your progress" (privacy copy must be literally true; fix before ship)
- Task 3: minor (deferred): JS-driven motion (CountUp rAF, WorldView matchMedia) ignores the Motion setting
- Task 3: minor (deferred): motion class applies after hydration (first-paint flash); suppressHydrationWarning on <html> is dead
- Task 3: minor (deferred): no tests for Full overriding OS reduce, display-name persistence, data-motion
- Task 3: minor (deferred): inline style in Settings.tsx should be a class
- Task 4: minor (deferred): visibilitychange effect re-subscribes every render; comment says it must not
- Task 4: minor (deferred): stale reset happens in an effect (one stale frame + lint disable)
- Task 4: minor (deferred): e2e doesn't test the save-on-hidden path (pagehide dispatch is a no-op; visibilitychange assertion vacuous)
- Task 4: minor (deferred): roundResume validation is loose (spentMs/roundXp/combo/answer shape); malformed answer can throw at RoundPlayer.tsx:64
- Task 4: minor (deferred): thinking clock runs while the quit sheet is open
- Task 4: minor (deferred): ConfirmSheet fixed ids and page-wide querySelectorAll
- Task 4: minor (deferred): no RED capture (tests judged non-vacuous by reviewer)
- Task 4: minor (deferred): resume e2e XP assertion relies on answerFirstCard scoring at least one correct card (could flake)
- Task 4: minor (deferred, pre-existing): levelBefore = levelOf(save.xp) is computed each render, so after update() the Recap's "level before" can show the new level; fix with the P2 recap work
- Task 5: minor (deferred): ResizeObserver updates --drawer-h but doesn't re-scroll when a late-loading meme image grows the drawer
- Task 5: minor (deferred): 404 e2e doesn't assert the 404 status code
- Task 5: minor (deferred): 669 poll uses Math.max(...bottoms, 0), vacuous if no options matched (guarded upstream)
- Task 6: minor (deferred): no tests for a throwing isNative() or a failed dynamic import (only plugin rejection is tested)
- Task 6: minor (deferred): Capacitor mocks hoisted for all of engine.test.ts; native tests would be tidier in native.test.ts
- Task 6: minor (deferred): no RoundPlayer-level test that a haptic fires on answer (web path is a no-op)
- Task 7: minor (deferred): render-assets.tsx hardcodes the /Users/t./ Chromium fallback; main() has no catch/finally
- Task 7: minor (deferred): UIRequiredDeviceCapabilities armv7 from Capacitor's template (check at App Store validation, Task 9 / P8)
- Task 8: minor (deferred): ios-smoke.sh create path prints a misleading message when simctl list fails
- Task 8: minor (deferred): resume e2e "card absent on fresh save" check is vacuous (runs before hydration, nothing stored)
- Task 8: minor (deferred): no automated deep-load check for StaticExportRouter (a SceneDelegate revert would go unseen)
- Task 8: minor (deferred): NOTES.md inconsistencies (09 recording build; "26 PNGs" vs 25; status column wording)
- Task 8: minor (deferred, pre-existing, log for P2): the ⚙ chip wraps onto its own row under RANK/tokens on both devices (.chips flex-wrap)
- Task 8: minor (deferred): offline proof is from the web bundle's request log, not on-device; no log artifact saved
- Task 8: minor (deferred): splashProblems passes vacuously on a Contents.json with images: [] (assert at least one PNG/entry)
- Task 8: minor (deferred): smoke log predicate matches only this runtime's SplashBoard wording (secondary guard)
- Task 9: minor (deferred): testflight.sh passes DEVELOPMENT_TEAM/CODE_SIGN_STYLE/CURRENT_PROJECT_VERSION as command-line settings (apply to SPM targets too; may trip the first real archive)
- Task 9: minor (deferred): team lookup regex over `defaults read` text depends on key order
- Task 9: minor (deferred): asc.mjs CLI guard breaks on paths with spaces/symlinks
- Task 9: minor (deferred): README says Android "is next" (unverified claim)
- Task 9: note: bundle ID ca.stiersolutions.passionatelearning registered (resource ZZGJ45VZCB, platform reported UNIVERSAL); archive/export/upload half untested until the App Store Connect app record exists (James's sign-in)
- P8 note: app-level PrivacyInfo.xcprivacy + required-reason scan over node_modules; armv7 capability check; launch-time on hardware; first real testflight.sh archive (watch the SPM CURRENT_PROJECT_VERSION override).
