import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SPLASH_IMAGESET, SPLASH_MAX_PX, splashProblems } from "../../scripts/splash-imageset";

/** Just enough of a PNG for the header check: signature, IHDR length and type, width, height. */
function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

const LIGHT = ["Default@1x~universal~anyany.png", "Default@2x~universal~anyany.png", "Default@3x~universal~anyany.png"];
function imageset(files: Record<string, Buffer>, images: object[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "splash-"));
  for (const [name, buf] of Object.entries(files)) writeFileSync(path.join(dir, name), buf);
  writeFileSync(path.join(dir, "Contents.json"), JSON.stringify({ images, info: { version: 1, author: "xcode" } }));
  return dir;
}
const lightImages = LIGHT.map((filename, i) => ({ idiom: "universal", filename, scale: `${i + 1}x` }));

describe("iOS launch assets", () => {
  it("the committed Splash imageset fits SplashBoard's limit and has no dark variants", () => {
    expect(splashProblems(SPLASH_IMAGESET)).toEqual([]);
  });

  it("passes a light-only set at the limit", () => {
    const dir = imageset(Object.fromEntries(LIGHT.map((f) => [f, pngHeader(SPLASH_MAX_PX, SPLASH_MAX_PX)])), lightImages);
    expect(splashProblems(dir)).toEqual([]);
  });

  it("fails a splash wider or taller than the limit (the 2732 px @capacitor/assets output)", () => {
    const files = Object.fromEntries(LIGHT.map((f) => [f, pngHeader(SPLASH_MAX_PX, SPLASH_MAX_PX)]));
    files[LIGHT[2]] = pngHeader(2732, 2732);
    files[LIGHT[1]] = pngHeader(SPLASH_MAX_PX, SPLASH_MAX_PX + 1);
    const problems = splashProblems(imageset(files, lightImages));
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain("2732x2732");
  });

  it("fails a dark variant file and an appearances entry", () => {
    const files = Object.fromEntries(LIGHT.map((f) => [f, pngHeader(SPLASH_MAX_PX, SPLASH_MAX_PX)]));
    files["Default@1x~universal~anyany-dark.png"] = pngHeader(SPLASH_MAX_PX, SPLASH_MAX_PX);
    const images = [...lightImages, { appearances: [{ appearance: "luminosity", value: "dark" }], idiom: "universal", scale: "1x", filename: "Default@1x~universal~anyany-dark.png" }];
    const problems = splashProblems(imageset(files, images));
    expect(problems.some((p) => p.includes("dark variant"))).toBe(true);
    expect(problems.some((p) => p.includes("appearances"))).toBe(true);
  });

  it("fails a listed file that is missing or not a PNG", () => {
    const files = { [LIGHT[0]]: pngHeader(SPLASH_MAX_PX, SPLASH_MAX_PX), [LIGHT[1]]: Buffer.from("not a png") };
    const problems = splashProblems(imageset(files, lightImages));
    expect(problems.some((p) => p.includes(LIGHT[1]) && p.includes("not a PNG"))).toBe(true);
    expect(problems.some((p) => p.includes(LIGHT[2]) && p.includes("missing"))).toBe(true);
  });
});
