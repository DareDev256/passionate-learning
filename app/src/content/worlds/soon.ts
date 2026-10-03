import type { World } from "../types";

// Worlds on the way. Each shows on the map with its stickman so the catalogue reads as growing.
// Porting one = writing its units (see CONTRIBUTING.md) and flipping status to "live".
const soon = (id: string, title: string, tagline: string, accent: string, from: string, guide: World["guide"]): World =>
  ({ id, title, tagline, accent, from, guide, status: "soon", units: [] });

export const comingSoon: World[] = [
  soon("bias", "Bias Check", "Spot when AI treats people unfairly.", "#8a4dff", "Bias Buster", { pose: "think", face: "flat", wear: ["hero"] }),
  soon("tools", "Tool Shop", "Pick the right AI tool for the job.", "#0fa968", "Tool Match", { pose: "present", face: "grin", wear: ["hero"] }),
  soon("circuit", "Circuit Lab", "How computers work, down to the wires.", "#ff8a00", "Circuit Prophet", { pose: "type", face: "happy", wear: ["hero"] }),
  soon("net", "Net Run", "How the internet moves your stuff.", "#00a6c8", "NetRunner", { pose: "run", face: "grin", wear: ["hero"] }),
  soon("keys", "Speed Keys", "Type tech words at full speed.", "#e5007e", "TypeMaster AI", { pose: "type", face: "cool", wear: ["hero"] }),
];
