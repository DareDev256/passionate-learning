import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ca.stiersolutions.passionatelearning",
  appName: "Passionate",
  webDir: "out",
  ios: { contentInset: "never", backgroundColor: "#ffffff" },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: "#ffffff", showSpinner: false },
  },
};

export default config;
