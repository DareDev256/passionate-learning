// YouTube thumbnails for Passionate Learning videos, drawn with the stick kit. Run: npx tsx tools/make-thumbs.mts <outdir> [id ...]
// One entry per video in THUMBS; brand marks come from tools/thumb-marks.json (simple-icons paths, never a generated logo).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { figure, DEFS } from "../src/art/kit";
const [OUT, ...only] = process.argv.slice(2);
const MARKS: Record<string, string> = JSON.parse(readFileSync(new URL("./thumb-marks.json", import.meta.url), "utf8"));
const font = (f: string) => `data:font/woff2;base64,${readFileSync(f).toString("base64")}`;
const css = `:root{--paper:#fff;--ink:#0a0a0a;--accent:#ff3b1f} body{margin:0} @font-face{font-family:AB;src:url(${font("node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2")})} @font-face{font-family:PH;src:url(${font("node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2")})}`;
const fig = (o: object, s: number, x: number, y: number) => `<g transform="translate(${x},${y}) scale(${s})">${figure(o)}</g>`;
const frame = (inner: string, svg: string) => `<style>${css}</style>${DEFS}<div style="width:1280px;height:720px;background:#fff;position:relative;overflow:hidden">
  <div style="position:absolute;left:0;top:0;width:1280px;height:16px;background:#ff3b1f"></div>${inner}
  <svg style="position:absolute;left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720"><g filter="url(#rough)">${svg}</g></svg></div>`;
// a round badge holding a brand mark (24x24 simple-icons path) or a text chip
const badge = (x: number, y: number, r: number, mark: string | null, text = "") => `<g transform="translate(${x},${y})"><circle r="${r}" fill="#fff" stroke="#0a0a0a" stroke-width="7"/>` +
  (mark ? `<g transform="scale(${(r * 1.1) / 24}) translate(-12,-12)"><path d="${mark}" fill="#0a0a0a"/></g>` : `<text text-anchor="middle" dominant-baseline="central" font-family="AB" font-size="${r * 0.36}" fill="#0a0a0a">${text}</text>`) + `</g>`;

const THUMBS: Record<string, string> = {
  pl02: frame(`
  <div style="position:absolute;left:56px;top:70px;font:118px/0.92 AB;color:#0a0a0a">HOW<br>CHATGPT<br>WORKS</div>
  <div style="position:absolute;left:62px;top:440px;font:76px/1 PH;color:#ff3b1f;transform:rotate(-3deg)">(for idiots)</div>
  <div style="position:absolute;left:62px;top:560px;font:40px/1.1 PH;color:#0a0a0a">peanut butter and ___</div>
  <div style="position:absolute;left:980px;top:96px;width:270px;text-align:center;font:58px/1 AB;color:#ff3b1f">JELLY!</div>`,
    `${fig({ pose: "point", face: "grin", wear: ["hero"] }, 3.1, 800, 700)}
    ${fig({ robot: true, pose: "cheer", face: "grin", flip: true }, 3.1, 1130, 700)}
    <path d="M980 70h270v120h-170l-46 46 12-46h-66z" fill="#fff" stroke="#0a0a0a" stroke-width="7" stroke-linejoin="round"/>`),
  // PL15: the best Short's topic, as the question people type
  pl15: frame(`
  <div style="position:absolute;left:56px;top:64px;font:150px/0.9 AB;color:#0a0a0a">WHICH<br>AI?</div>
  <div style="position:absolute;left:62px;top:356px;font:72px/1 PH;color:#ff3b1f;transform:rotate(-3deg)">(for idiots)</div>
  <div style="position:absolute;left:60px;top:470px;background:#0a0a0a;color:#fff;font:42px/1 AB;padding:16px 22px">CHATGPT vs CLAUDE vs GEMINI</div>`,
    `${badge(800, 170, 84, null, "ChatGPT")}${badge(990, 120, 84, MARKS.claude)}${badge(1180, 170, 84, MARKS.googlegemini)}
    ${fig({ pose: "shrug", face: "spiral", wear: ["hero"] }, 3.7, 990, 735)}
    <text x="1150" y="470" font-family="AB" font-size="120" fill="#ff3b1f" transform="rotate(10 1150 470)">?</text>`),
  // PL16: the 2nd-best Short's topic, expanded to 7
  pl16: frame(`
  <div style="position:absolute;left:56px;top:64px;font:112px/0.9 AB;color:#0a0a0a">DON'T<br>USE AI<br>FOR <span style="color:#ff3b1f">THIS</span></div>
  <div style="position:absolute;left:62px;top:440px;font:66px/1 PH;color:#ff3b1f;transform:rotate(-3deg)">7 times (for idiots)</div>`,
    `${fig({ pose: "nope", face: "angry", wear: ["hero"] }, 3.7, 840, 735)}
    ${fig({ robot: true, pose: "shrug", face: "shock", flip: true }, 3.7, 1130, 735)}
    <g transform="translate(1110,150) rotate(8)"><rect x="-120" y="-62" width="240" height="124" rx="14" fill="#ff3b1f" stroke="#0a0a0a" stroke-width="7"/>
    <text text-anchor="middle" dominant-baseline="central" font-family="AB" font-size="64" fill="#fff">NOPE</text></g>`),
  // PL23: the channel fact-checks itself; the hook is our own public line, struck and stamped
  pl23: frame(`
  <div style="position:absolute;left:56px;top:58px;font:44px/1 PH;color:#9a9a9a">we said, one week ago:</div>
  <div style="position:absolute;left:56px;top:118px;font:96px/0.95 AB;color:#9a9a9a;text-decoration:line-through;text-decoration-color:#ff3b1f;text-decoration-thickness:12px">A CHATBOT<br>ONLY TALKS</div>
  <div style="position:absolute;left:70px;top:350px;font:84px/1 AB;color:#ff3b1f;border:10px solid #ff3b1f;padding:8px 22px;transform:rotate(-6deg)">UPDATED</div>
  <div style="position:absolute;left:62px;top:540px;font:58px/1 PH;color:#0a0a0a">AI moves fast (for idiots)</div>`,
    `${fig({ pose: "pointUp", face: "shock", wear: ["hero"] }, 3.7, 900, 735)}
    ${fig({ robot: true, pose: "cheer", face: "grin", flip: true }, 3.7, 1150, 735)}`),
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
for (const [id, html] of Object.entries(THUMBS)) {
  if (only.length && !only.includes(id)) continue;
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/thumb-${id}.png` });
  console.log(`${OUT}/thumb-${id}.png`);
}
await b.close();
