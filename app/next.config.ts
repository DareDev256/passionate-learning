import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// The version is read here, at build time, so the client bundle gets one string instead of all of package.json.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// Static export: the whole app is files, so it runs offline as a PWA and can be wrapped by Capacitor for iOS later.
const nextConfig: NextConfig = { output: "export", images: { unoptimized: true }, trailingSlash: true, env: { NEXT_PUBLIC_APP_VERSION: version } };

export default nextConfig;
