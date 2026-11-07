// Renders the app icon and splash from the code-drawn LogoMark, then writes the iOS icon and launch assets.
// Run from app/: npm run ios:assets
//
// The splash is 2400 x 2400, not the 2732 x 2732 that @capacitor/assets expects. iOS snapshots the launch screen at
// install, and SplashBoard refuses a launch image over 25,000,000 bytes decoded: 2732 x 2732 RGBA is 29.9 MB, so iOS
// marked the app's launch image bad and showed black for about 3 s at every cold launch, light or dark. 2400 x 2400
// is 23 MB. @capacitor/assets hard-codes 2732 for every splash rendition and adds dark variants (the app is white
// paper only), so after it runs, writeSplashImageset() rewrites Splash.imageset from the 2400 render and checks it.
// Running `npx @capacitor/assets generate --ios` on its own brings the 2732 splash back; npm test fails when it does.
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { LogoMark } from "../src/art/Logo";
import { StickDefs } from "../src/art/Stick";
import { SPLASH_MAX_PX, SPLASH_SOURCE, writeSplashImageset } from "./splash-imageset";

const FALLBACK =
  "/Users/t./Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";

function page(canvas: number, markWidth: number): string {
  return `<!doctype html><html><head><style>
:root{--paper:#ffffff;--ink:#0a0a0a;--accent:#ff3b1f}
html,body{margin:0;background:#fff}
body{width:${canvas}px;height:${canvas}px;display:flex;align-items:center;justify-content:center}
</style></head><body>${renderToStaticMarkup(<StickDefs />)}${renderToStaticMarkup(<LogoMark size={markWidth} />)}</body></html>`;
}

async function main() {
  const bundled = existsSync(chromium.executablePath());
  const browser = await chromium.launch(bundled ? {} : { executablePath: process.env.PW_CHROMIUM_PATH ?? FALLBACK });
  const jobs = [
    { file: "assets/icon.png", canvas: 1024, mark: 560 },
    // The mark keeps the proportion it had on the 2732 canvas (640 px), so the launch screen looks the same.
    { file: SPLASH_SOURCE, canvas: SPLASH_MAX_PX, mark: Math.round((640 * SPLASH_MAX_PX) / 2732) },
  ];
  for (const j of jobs) {
    const p = await browser.newPage({ viewport: { width: j.canvas, height: j.canvas }, deviceScaleFactor: 1 });
    await p.setContent(page(j.canvas, j.mark));
    await p.screenshot({ path: j.file, omitBackground: false });
    await p.close();
  }
  await browser.close();

  execFileSync("node_modules/.bin/capacitor-assets", ["generate", "--ios"], { stdio: "inherit" });
  writeSplashImageset();
  console.log(`Splash imageset rewritten at ${SPLASH_MAX_PX} px, light only.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
