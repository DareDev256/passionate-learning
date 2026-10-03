// The content model. A world is a data file; adding one to `worlds/index.ts` adds it to the catalogue.
// Every card asks before it explains (problem first), then shows `why` in one line.

export type Face = "happy" | "grin" | "sad" | "flat" | "shock" | "smug" | "angry" | "dead" | "cool" | "cry" | "zen" | "spiral";
export type Pose =
  | "stand" | "point" | "pointL" | "pointUp" | "shrug" | "panic" | "cheer" | "think" | "facepalm"
  | "hold" | "type" | "wave" | "nope" | "hips" | "run" | "present" | "holdOut";

export type MemeKind = "drake" | "galaxy" | "expect" | "buttons" | "fine";

/** An original stickman meme card that explains the idea after the player meets it. */
export type Meme =
  | { kind: "drake"; no: string; yes: string }
  | { kind: "galaxy"; levels: string[] }
  | { kind: "expect"; expectation: string; reality: string }
  | { kind: "buttons"; a: string; b: string; caption?: string }
  | { kind: "fine"; caption: string };

interface CardBase {
  /** Unique within its world; stored as `${world}:${id}`. */
  id: string;
  /** One line shown after answering: the idea in plain words. */
  why: string;
  meme?: Meme;
}

/** Pick one of 2 to 4 options. */
export interface ChoiceCard extends CardBase {
  type: "choice";
  prompt: string;
  options: string[];
  answer: number;
}

/** Is this AI claim cap (made up) or facts? */
export interface CapCard extends CardBase {
  type: "cap";
  claim: string;
  isCap: boolean;
  /** Optional speaker label, e.g. "ChatBot said". */
  source?: string;
}

/** Pick the most likely next token; the probabilities are revealed after. */
export interface PredictCard extends CardBase {
  type: "predict";
  context: string;
  options: { token: string; p: number }[];
}

/** Tap the sentence the AI made up. */
export interface SpotCard extends CardBase {
  type: "spot";
  prompt: string;
  sentences: string[];
  answer: number;
}

/** Put the steps in order. `steps` is the correct order; the player sees them shuffled. */
export interface OrderCard extends CardBase {
  type: "order";
  prompt: string;
  steps: string[];
}

/** Type the term. Accepts any of `accept`, case-insensitive. */
export interface TypeCard extends CardBase {
  type: "type";
  prompt: string;
  accept: string[];
  hint?: string;
}

export type Card = ChoiceCard | CapCard | PredictCard | SpotCard | OrderCard | TypeCard;

export interface Unit {
  id: string;
  title: string;
  /** One line under the title. */
  blurb: string;
  cards: Card[];
}

export interface World {
  id: string;
  title: string;
  /** What the world teaches, in one line. */
  tagline: string;
  /** Hex accent used for this world's tags and System window edge. */
  accent: string;
  /** How the guide stands on the world card. */
  guide: { pose: Pose; face: Face; wear?: string[] };
  /** Where the content came from (the old suite game), for the record. */
  from?: string;
  status: "live" | "soon";
  units: Unit[];
}
