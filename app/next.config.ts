import type { NextConfig } from "next";

// Static export: the whole app is files, so it runs offline as a PWA and can be wrapped by Capacitor for iOS later.
const nextConfig: NextConfig = { output: "export", images: { unoptimized: true }, trailingSlash: true };

export default nextConfig;
