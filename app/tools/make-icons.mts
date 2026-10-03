// Renders the app icons and the share card from the stickman kit (no generated art). Run: npx tsx tools/make-icons.ts
import { chromium } from "@playwright/test";
import { figure, DEFS } from "../src/art/kit";
import { readFileSync } from "node:fs";
const font = (f: string) => `data:font/woff2;base64,${readFileSync(f).toString("base64")}`;

const css = `:root{--paper:#fff;--ink:#0a0a0a;--accent:#ff3b1f} body{margin:0} @font-face{font-family:AB;src:url(${font("node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2")})} @font-face{font-family:PH;src:url(${font("node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2")})}`;
const mark = (s: number) => `<svg viewBox="-60 -140 120 150" width="${s}" height="${s * 1.25}"><g filter="url(#rough)"><path d="M-40 -4q20 -12 40 0q20 -12 40 0v-40q-20 -12 -40 0q-20 -12 -40 0z" fill="#fff" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/><path d="M0 -4v-40" stroke="#0a0a0a" stroke-width="3.6"/><g transform="translate(0,-36) scale(0.9)">${figure({ pose: "cheer", legs: "jump", face: "grin", wear: ["hero"] })}</g><path d="M-38 -110l2.4 -8 2.4 8 8 2.4 -8 2.4 -2.4 8 -2.4 -8 -8 -2.4z" fill="#ff3b1f"/><path d="M38 -96l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" fill="#ff3b1f"/></g></svg>`;

const b = await chromium.launch();
async function shot(html: string, w: number, h: number, out: string) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<style>${css}</style>${DEFS}${html}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: out, omitBackground: false });
  await p.close();
}
for (const [s, name, pad] of [[192, "icon-192.png", 0.12], [512, "icon-512.png", 0.12], [512, "icon-maskable-512.png", 0.24], [180, "apple-touch-icon.png", 0.1]] as const) {
  const inner = Math.round(s * (1 - pad * 2) * 0.8);
  await shot(`<div style="width:${s}px;height:${s}px;background:#fff;display:grid;place-items:center">${mark(inner)}</div>`, s, s, `public/icons/${name}`);
}
await shot(`<div style="width:1200px;height:630px;background:#fff;background-image:radial-gradient(#e2e2e2 1.5px,transparent 1.5px);background-size:26px 26px;display:flex;align-items:center;gap:40px;padding:0 70px;box-sizing:border-box">
  ${mark(300)}
  <div><div style="font:64px/0.95 AB;color:#0a0a0a">PASSIONATE<br>LEARNING</div>
  <svg width="430" height="18" viewBox="0 0 200 14" preserveAspectRatio="none"><path d="M3 9q40 -8 80 -2t80 -3q20 -1 34 3" fill="none" stroke="#ff3b1f" stroke-width="4" stroke-linecap="round"/></svg>
  <div style="font:40px/1.15 PH;margin-top:18px;color:#0a0a0a">Learn AI in <span style="color:#ff3b1f">60-second rounds.</span><br>Stickman memes. A System that levels you up.<br>No streak guilt. Free.</div>
  <div style="display:inline-block;margin-top:22px;background:#0a1230;color:#3de0ff;font:22px AB;letter-spacing:4px;padding:10px 16px;border:2px solid #3de0ff;box-shadow:0 0 18px rgba(61,224,255,.5)">[ PLAY FREE ]</div></div>
</div>`, 1200, 630, "public/og.png");
await b.close();
console.log("icons + og written");
