// Dependency-free static server for out/ (the Next static export), port 4173.
// Directory -> index.html; missing file -> out/404.html with HTTP 404.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../out", import.meta.url)));
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  const abs = normalize(join(ROOT, p));
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;
  try {
    const s = await stat(abs);
    if (s.isDirectory()) {
      const idx = join(abs, "index.html");
      return (await stat(idx)).isFile() ? idx : null;
    }
    return s.isFile() ? abs : null;
  } catch { return null; }
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
  let file = await resolveFile(urlPath);
  let status = 200;
  if (!file) { file = join(ROOT, "404.html"); status = 404; }
  try {
    const body = await readFile(file);
    res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500).end("missing out/404.html; run npm run build");
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
