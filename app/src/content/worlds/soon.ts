import type { World } from "../types";

// Worlds on the way. Each shows on the map with its stickman so the catalogue reads as growing.
// Porting one = writing its units (see CONTRIBUTING.md) and flipping status to "live".
const soon = (id: string, title: string, tagline: string, accent: string, from: string, guide: World["guide"]): World =>
  ({ id, title, tagline, accent, from, guide, status: "soon", units: [] });

export const comingSoon: World[] = [
  soon("deepfake", "Deepfake Detector", "Real photo or AI? Real voice or clone?", "#ff3b1f", "new", { pose: "think", face: "smug", wear: ["hero", "glasses"] }),
  soon("scams", "Scam Radar", "Spot AI-powered scams before they spot you.", "#0a0a0a", "new", { pose: "nope", face: "angry", wear: ["hero"] }),
  soon("code", "Code Dojo", "Your first lines of code, explained like a friend would.", "#2f6bff", "new", { pose: "type", face: "grin", wear: ["hero"] }),
  soon("work", "AI at Work", "Use AI on the job without getting fired.", "#0fa968", "new", { pose: "present", face: "happy", wear: ["hero", "tie"] }),
];
