// YouTube channel art for "AI for Idiots" from the stickman kit (no generated art). Run: npx tsx tools/make-channel-art.mts <outdir>
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { figure, DEFS } from "../src/art/kit";
const OUT = process.argv[2];
const font = (f: string) => `data:font/woff2;base64,${readFileSync(f).toString("base64")}`;
const css = `:root{--paper:#fff;--ink:#0a0a0a;--accent:#ff3b1f} body{margin:0} @font-face{font-family:AB;src:url(${font("node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2")})} @font-face{font-family:PH;src:url(${font("node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2")})}`;
const fig = (o: object, s: number, x: number, y: number) => `<g transform="translate(${x},${y}) scale(${s})">${figure(o)}</g>`;
const b = await chromium.launch();
async function shot(html: string, w: number, h: number, out: string) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<style>${css}</style>${DEFS}${html}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: out }); await p.close();
}
// Avatar: the host, galaxy-brain sparks, on white, centred for a circle crop
await shot(`<svg width="800" height="800" viewBox="0 0 800 800" style="background:#fff"><g filter="url(#rough)">
  <circle cx="400" cy="400" r="370" fill="#fff" stroke="#0a0a0a" stroke-width="14"/>
  ${fig({ pose: "pointUp", face: "smug", wear: ["hero"] }, 4.1, 400, 690)}
  ${Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return `<path d="M${400 + Math.cos(a) * 92} ${312 + Math.sin(a) * 92}L${400 + Math.cos(a) * 128} ${312 + Math.sin(a) * 128}" stroke="#ff3b1f" stroke-width="12" stroke-linecap="round"/>`; }).join("")}
</g></svg>`, 800, 800, `${OUT}/avatar-800.png`);
// Banner: 2560x1440, everything important inside the 1546x423 centre safe area
await shot(`<div style="width:2560px;height:1440px;background:#fff;background-image:radial-gradient(#e3e3e3 3px,transparent 3px);background-size:44px 44px;position:relative">
  <svg style="position:absolute;left:0;top:0" width="2560" height="1440" viewBox="0 0 2560 1440"><g filter="url(#rough)">
    ${fig({ pose: "present", face: "grin", wear: ["hero"] }, 2.4, 330, 1060)}
    ${fig({ robot: true, pose: "shrug", face: "smug", flip: true }, 2.4, 2230, 1060)}
    <path d="M180 1062H2380" stroke="#0a0a0a" stroke-width="6" stroke-dasharray="3 18" stroke-linecap="round"/>
  </g></svg>
  <div style="position:absolute;left:0;right:0;top:470px;text-align:center">
    <div style="font:150px/0.9 AB;color:#0a0a0a;letter-spacing:2px">AI FOR IDIOTS</div>
    <svg width="900" height="30" viewBox="0 0 200 14" preserveAspectRatio="none"><path d="M3 9q40 -8 80 -2t80 -3q20 -1 34 3" fill="none" stroke="#ff3b1f" stroke-width="4" stroke-linecap="round"/></svg>
    <div style="font:62px/1.1 PH;color:#0a0a0a;margin-top:6px">Learn AI in 60 seconds. Stickmen. Memes. No cap.</div>
  </div>
</div>`, 2560, 1440, `${OUT}/banner-2560x1440.png`);
await b.close(); console.log("channel art written");
