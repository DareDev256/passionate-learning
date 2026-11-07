import { defineConfig } from "@playwright/test";
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { VIEWPORTS } from "./e2e/helpers";

const FALLBACK_CHROMIUM =
  "/Users/t./Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";

// Use the bundled browser when present; otherwise PW_CHROMIUM_PATH, defaulting to this Mac's known shell.
function executablePath(): string | undefined {
  if (existsSync(chromium.executablePath())) return undefined;
  const p = process.env.PW_CHROMIUM_PATH ?? FALLBACK_CHROMIUM;
  return existsSync(p) ? p : undefined;
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  workers: 2,
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath: executablePath() },
  },
  projects: VIEWPORTS.map((v) => ({
    name: `${v.w}x${v.h}`,
    use: { viewport: { width: v.w, height: v.h } },
  })),
});
