// Plays the built app like a person and screenshots each screen. Usage: node tools/shots.mjs [outdir]
import { chromium } from "@playwright/test";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const OUT = process.argv[2] || "../docs/screenshots"; fs.mkdirSync(OUT, { recursive: true });
const root = path.resolve("out");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".txt": "text/plain" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); let f = path.join(root, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { r.writeHead(404); return r.end("404"); } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(4321);
const D = new Date().toISOString().slice(0, 10);
const b = await chromium.launch();
const errs = [];
for (const [tag, vp] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: tag === "phone" ? 2 : 1 });
  p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errs.push(`${tag} console: ${m.text().slice(0, 140)}`); });
  await p.goto("http://localhost:4321/"); await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${D}_pl-home-${tag}.png`, fullPage: tag === "desktop" });
  await p.goto("http://localhost:4321/play/token/next-word/"); await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${D}_pl-card-${tag}.png` });
  // play the round: answer every card with the first option / CAP / type "language", reaching the recap
  for (let i = 0; i < 10; i++) {
    if (await p.locator(".recap").count()) break;
    if (await p.locator(".type-in").count()) { await p.fill(".type-in", "language"); await p.click("form .btn"); }
    else if (await p.locator(".pool-chip").count()) { const n = await p.locator(".pool-chip").count(); for (let k = 0; k < n; k++) await p.locator(".pool-chip").first().click(); await p.click("text=CHECK"); }
    else if (await p.locator(".cap-btn").count()) await p.locator(".cap-btn").first().click();
    else if (await p.locator(".sentence").count()) await p.locator(".sentence").first().click();
    else await p.locator(".opt").first().click();
    await p.waitForTimeout(350);
    if (i === 0) await p.screenshot({ path: `${OUT}/${D}_pl-feedback-${tag}.png` });
    await p.locator(".drawer .btn").click(); await p.waitForTimeout(250);
  }
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${D}_pl-recap-${tag}.png`, fullPage: true });
  await p.goto("http://localhost:4321/w/cap/"); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${D}_pl-world-${tag}.png` });
  await p.close();
}
console.log(errs.length ? "ERRORS:\n" + [...new Set(errs)].join("\n") : "no page errors");
await b.close(); srv.close();
