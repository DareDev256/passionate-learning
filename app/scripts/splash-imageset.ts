// The iOS Splash imageset (launch screen and SplashScreen plugin image): what it must be, and how to write it.
//
// iOS renders the launch screen into a snapshot when the app is installed. SplashBoard refuses a launch image whose
// decoded size is over 25,000,000 bytes ("Estimated size (29900800) is over limit (25000000)" for 2732 x 2732 RGBA),
// marks the app as having a bad launch image, and shows black for about 3 s at every cold launch. 2400 x 2400 RGBA
// is 23,040,000 bytes. The app is white paper only, so there are no dark variants either.
//
// Check:  splashProblems(dir) lists every way the set breaks those rules (npm test runs it on the committed set).
// Fix:    npx tsx scripts/splash-imageset.ts   rewrites the set from assets/splash.png, then checks it.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SPLASH_MAX_PX = 2400;
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SPLASH_IMAGESET = path.join(APP_DIR, "ios/App/App/Assets.xcassets/Splash.imageset");
export const SPLASH_SOURCE = path.join(APP_DIR, "assets/splash.png");
const LIGHT = [1, 2, 3].map((scale) => ({ idiom: "universal", filename: `Default@${scale}x~universal~anyany.png`, scale: `${scale}x` }));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from a PNG's IHDR chunk, or null when the file is not a PNG. */
export function pngSize(file: string): { width: number; height: number } | null {
  const b = readFileSync(file);
  if (b.length < 24 || !b.subarray(0, 8).equals(PNG_SIGNATURE) || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** Every way the imageset at dir breaks the rules above; empty when it is fine. */
export function splashProblems(dir: string): string[] {
  const problems: string[] = [];
  const contents = path.join(dir, "Contents.json");
  if (!existsSync(contents)) return [`${contents} is missing`];
  const images: { filename?: string; appearances?: unknown[] }[] = JSON.parse(readFileSync(contents, "utf8")).images ?? [];
  for (const img of images) {
    if (img.appearances?.length) problems.push(`Contents.json has an appearances entry (${img.filename ?? "no file"}); the app is light only`);
    if (!img.filename) continue;
    const file = path.join(dir, img.filename);
    if (!existsSync(file)) problems.push(`${img.filename} is listed in Contents.json but missing`);
  }
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    if (/-dark\./i.test(name)) problems.push(`${name} is a dark variant; the app is light only`);
    const size = pngSize(path.join(dir, name));
    if (!size) problems.push(`${name} is not a PNG`);
    else if (size.width > SPLASH_MAX_PX || size.height > SPLASH_MAX_PX)
      problems.push(`${name} is ${size.width}x${size.height}; over ${SPLASH_MAX_PX} px iOS can't render the launch screen and shows black`);
  }
  return problems;
}

/**
 * Replace whatever is in the imageset (for example @capacitor/assets' 2732 px splash and its dark variants) with the
 * three light renditions made from source, resampled to SPLASH_MAX_PX when it is larger (macOS sips). Throws if the
 * result still breaks a rule.
 */
export function writeSplashImageset(source = SPLASH_SOURCE, dir = SPLASH_IMAGESET): void {
  const size = pngSize(source);
  if (!size) throw new Error(`${source} is not a PNG`);
  for (const name of readdirSync(dir)) if (name !== "Contents.json") rmSync(path.join(dir, name));
  for (const { filename } of LIGHT) {
    const out = path.join(dir, filename);
    if (size.width > SPLASH_MAX_PX || size.height > SPLASH_MAX_PX) execFileSync("sips", ["-Z", String(SPLASH_MAX_PX), source, "--out", out], { stdio: "ignore" });
    else copyFileSync(source, out);
  }
  writeFileSync(path.join(dir, "Contents.json"), JSON.stringify({ images: LIGHT, info: { version: 1, author: "xcode" } }, null, 2) + "\n");
  const problems = splashProblems(dir);
  if (problems.length) throw new Error(`Splash imageset is still wrong:\n${problems.join("\n")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSplashImageset();
  console.log(`Splash imageset written from ${path.relative(APP_DIR, SPLASH_SOURCE)} (max ${SPLASH_MAX_PX} px, light only).`);
}
