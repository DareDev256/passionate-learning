// The theme catalogue: source of truth for the app. What's Poppin keeps its own copy in
// public/arcade/pop/src/theme.js (a separate vanilla page); themes.test.ts fails if the two drift.
// Grounds follow house taste: white, true black, or one saturated colour plus one loud accent.

export interface Theme {
  id: string;
  name: string;
  /** Tokens. 0 means the player always owns it. */
  price: number;
  ground: string;
  ink: string;
  accent: string;
  /** The hero stickman's outfit under this theme. Always starts with "hero" (the headband). */
  wear: string[];
  blurb: string;
}

export const THEMES: readonly Theme[] = [
  { id: "notebook", name: "Notebook", price: 0, ground: "#ffffff", ink: "#0a0a0a", accent: "#ff3b1f", wear: ["hero"], blurb: "White paper, black ink, one red pen." },
  { id: "blackout", name: "Blackout", price: 6, ground: "#000000", ink: "#ffffff", accent: "#c6ff00", wear: ["hero", "glasses"], blurb: "True black with a lime glow. Your stickman puts on shades." },
  { id: "redline", name: "Redline", price: 10, ground: "#ff2a1a", ink: "#0a0a0a", accent: "#ffffff", wear: ["hero", "steam"], blurb: "Full red, white highlights. Your stickman runs hot." },
  { id: "greenroom", name: "Greenroom", price: 12, ground: "#00b84a", ink: "#0a0a0a", accent: "#fff200", wear: ["hero", "hair"], blurb: "Backstage green with a yellow spotlight. Wild hair." },
  { id: "ultraviolet", name: "Ultraviolet", price: 15, ground: "#5b21ff", ink: "#ffffff", accent: "#ffe500", wear: ["hero", "sparkle"], blurb: "Deep violet, bright yellow, and a sparkle." },
  { id: "bubblegum", name: "Bubblegum", price: 18, ground: "#ff2e93", ink: "#0a0a0a", accent: "#fff200", wear: ["hero", "bun"], blurb: "Hot pink and sunny yellow. A bun on top." },
];

export const DEFAULT_THEME = "notebook";
export const themeById = (id: string): Theme | undefined => THEMES.find((t) => t.id === id);
export const isThemeId = (id: unknown): id is string => typeof id === "string" && !!themeById(id);
/** A theme for any input: an unknown id is Notebook. */
export const themeOrDefault = (id: unknown): Theme => (isThemeId(id) ? themeById(id)! : THEMES[0]);
