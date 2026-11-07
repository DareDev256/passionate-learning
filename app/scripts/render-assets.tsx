// Renders the app icon and splash from the code-drawn LogoMark. Run: npx tsx scripts/render-assets.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { LogoMark } from "../src/art/Logo";
import { StickDefs } from "../src/art/Stick";

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
    { file: "assets/splash.png", canvas: 2732, mark: 640 },
  ];
  for (const j of jobs) {
    const p = await browser.newPage({ viewport: { width: j.canvas, height: j.canvas }, deviceScaleFactor: 1 });
    await p.setContent(page(j.canvas, j.mark));
    await p.screenshot({ path: j.file, omitBackground: false });
    await p.close();
  }
  await browser.close();
}
main();
