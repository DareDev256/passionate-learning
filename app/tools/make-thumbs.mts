// YouTube thumbnails for Passionate Learning videos, drawn with the stick kit. Run: npx tsx tools/make-thumbs.mts <outdir>
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { figure, DEFS } from "../src/art/kit";
const OUT = process.argv[2];
const font = (f: string) => `data:font/woff2;base64,${readFileSync(f).toString("base64")}`;
const css = `:root{--paper:#fff;--ink:#0a0a0a;--accent:#ff3b1f} body{margin:0} @font-face{font-family:AB;src:url(${font("node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2")})} @font-face{font-family:PH;src:url(${font("node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2")})}`;
const fig = (o: object, s: number, x: number, y: number) => `<g transform="translate(${x},${y}) scale(${s})">${figure(o)}</g>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.setContent(`<style>${css}</style>${DEFS}<div style="width:1280px;height:720px;background:#fff;position:relative;overflow:hidden">
  <div style="position:absolute;left:0;top:0;width:1280px;height:16px;background:#ff3b1f"></div>
  <div style="position:absolute;left:56px;top:70px;font:118px/0.92 AB;color:#0a0a0a">HOW<br>CHATGPT<br>WORKS</div>
  <div style="position:absolute;left:62px;top:440px;font:76px/1 PH;color:#ff3b1f;transform:rotate(-3deg)">(for idiots)</div>
  <div style="position:absolute;left:62px;top:560px;font:40px/1.1 PH;color:#0a0a0a">peanut butter and ___</div>
  <svg style="position:absolute;left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720"><g filter="url(#rough)">
    ${fig({ pose: "point", face: "grin", wear: ["hero"] }, 3.1, 800, 700)}
    ${fig({ robot: true, pose: "cheer", face: "grin", flip: true }, 3.1, 1130, 700)}
    <path d="M980 70h270v120h-170l-46 46 12-46h-66z" fill="#fff" stroke="#0a0a0a" stroke-width="7" stroke-linejoin="round"/>
  </g></svg>
  <div style="position:absolute;left:980px;top:96px;width:270px;text-align:center;font:58px/1 AB;color:#ff3b1f">JELLY!</div>
</div>`);
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/thumb-pl02.png` });
await b.close(); console.log("thumbs written");
