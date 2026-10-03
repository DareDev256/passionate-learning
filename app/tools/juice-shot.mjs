// Captures the first correct answer ~150ms after the click, to prove the juice is visible.
import { chromium } from "@playwright/test";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = path.resolve("out"); const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(4322);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:4322/play/cap/cap-or-facts/"); await p.waitForTimeout(900);
for (let i = 0; i < 8; i++) {
  const btns = p.locator(".cap-btn"); const n = await btns.count(); if (!n) break;
  await btns.nth(i % 2).click(); await p.waitForTimeout(150);
  if (await p.locator(".drawer.good").count()) { await p.screenshot({ path: process.argv[2] }); console.log("captured correct frame at card", i + 1); break; }
  await p.locator(".drawer .btn").click(); await p.waitForTimeout(250);
}
await b.close(); srv.close();
