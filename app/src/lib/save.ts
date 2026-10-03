// One save for the whole app: XP, rank, days played, per-card memory (FSRS), unit progress, daily quest, arcade tokens.
// localStorage, versioned, defensive: a corrupt save becomes a fresh one instead of a crash.
import { FSRS, Rating, createEmptyCard, type Card as FCard, type Grade } from "ts-fsrs";

export const SAVE_KEY = "passionate-learning:v1";

export interface CardMemory {
  /** FSRS card state, dates as ISO strings. */
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
  seen: number;
  correct: number;
}

export interface UnitProgress {
  /** Accuracy (0..1) of the last three rounds, newest last. */
  last: number[];
  best: number;
  rounds: number;
}

export interface Save {
  v: 1;
  xp: number;
  /** ISO dates (YYYY-MM-DD) on which at least one round was finished. Never reset. */
  days: string[];
  cards: Record<string, CardMemory>;
  units: Record<string, UnitProgress>;
  quest: { date: string; round: boolean; review: boolean; perfect: boolean };
  tokens: number;
  settings: { sound: boolean; name: string };
}

export const today = (d = new Date()) => d.toLocaleDateString("en-CA");

export function freshSave(): Save {
  return { v: 1, xp: 0, days: [], cards: {}, units: {}, quest: { date: today(), round: false, review: false, perfect: false }, tokens: 0, settings: { sound: true, name: "" } };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Accepts anything; returns a valid Save. Unknown or malformed fields fall back to defaults. */
export function sanitize(raw: unknown): Save {
  const s = freshSave();
  if (!isObj(raw) || raw.v !== 1) return s;
  if (typeof raw.xp === "number" && Number.isFinite(raw.xp) && raw.xp >= 0) s.xp = Math.floor(raw.xp);
  if (Array.isArray(raw.days)) s.days = [...new Set(raw.days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (isObj(raw.cards)) for (const [k, v] of Object.entries(raw.cards)) if (/^[a-z0-9-]+:[a-z0-9-]+$/.test(k) && isObj(v) && typeof v.due === "string") s.cards[k] = v as unknown as CardMemory;
  if (isObj(raw.units)) for (const [k, v] of Object.entries(raw.units)) if (isObj(v) && Array.isArray(v.last)) s.units[k] = { last: (v.last as unknown[]).filter((n): n is number => typeof n === "number").slice(-3), best: Number(v.best) || 0, rounds: Number(v.rounds) || 0 };
  if (isObj(raw.quest) && typeof raw.quest.date === "string") s.quest = { date: raw.quest.date, round: !!raw.quest.round, review: !!raw.quest.review, perfect: !!raw.quest.perfect };
  if (typeof raw.tokens === "number" && raw.tokens >= 0) s.tokens = Math.floor(raw.tokens);
  if (isObj(raw.settings)) s.settings = { sound: raw.settings.sound !== false, name: typeof raw.settings.name === "string" ? raw.settings.name.slice(0, 24) : "" };
  return s;
}

export function loadSave(): Save {
  if (typeof window === "undefined") return freshSave();
  try { return rollQuest(sanitize(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"))); } catch { return freshSave(); }
}

export function writeSave(s: Save): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode or full: play on without saving */ }
}

/** A new day gets a new daily quest. */
export function rollQuest(s: Save, now = new Date()): Save {
  return s.quest.date === today(now) ? s : { ...s, quest: { date: today(now), round: false, review: false, perfect: false } };
}

// ── Ranks: E to S, from total XP ─────────────────────────────────────────────────────────────────
export const RANKS = [
  { rank: "E", xp: 0 }, { rank: "D", xp: 150 }, { rank: "C", xp: 450 }, { rank: "B", xp: 1000 }, { rank: "A", xp: 2000 }, { rank: "S", xp: 4000 },
] as const;
export type Rank = (typeof RANKS)[number]["rank"];

export function rankOf(xp: number): { rank: Rank; next: number | null; floor: number } {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  return { rank: RANKS[i].rank, floor: RANKS[i].xp, next: i + 1 < RANKS.length ? RANKS[i + 1].xp : null };
}
export const levelOf = (xp: number) => Math.floor(xp / 100) + 1;

// ── Memory (FSRS) ────────────────────────────────────────────────────────────────────────────────
const scheduler = new FSRS({ enable_fuzz: true });

function toFsrs(m: CardMemory): FCard {
  return { ...m, due: new Date(m.due), last_review: m.last_review ? new Date(m.last_review) : undefined } as unknown as FCard;
}

/** Days since this card was last reviewed, or null if never. */
export function daysSinceReview(m: CardMemory | undefined, now = new Date()): number | null {
  if (!m?.last_review) return null;
  return (now.getTime() - new Date(m.last_review).getTime()) / 86400000;
}

/** Recall bonus: a correct answer 7+ days after the last review is worth 2x, 30+ days 3x. */
export function recallMultiplier(m: CardMemory | undefined, now = new Date()): number {
  const d = daysSinceReview(m, now);
  return d === null ? 1 : d >= 30 ? 3 : d >= 7 ? 2 : 1;
}

export function reviewCard(m: CardMemory | undefined, correct: boolean, now = new Date()): CardMemory {
  const card = m ? toFsrs(m) : createEmptyCard(now);
  const grade: Grade = (correct ? Rating.Good : Rating.Again) as Grade;
  const next = scheduler.next(card, now, grade).card;
  return {
    due: next.due.toISOString(), stability: next.stability, difficulty: next.difficulty, elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days, reps: next.reps, lapses: next.lapses, state: next.state,
    last_review: now.toISOString(), seen: (m?.seen ?? 0) + 1, correct: (m?.correct ?? 0) + (correct ? 1 : 0),
  };
}

/** Keys of cards whose review is due, oldest due first. */
export function dueKeys(s: Save, now = new Date(), limit = 20): string[] {
  return Object.entries(s.cards).filter(([, m]) => new Date(m.due) <= now).sort((a, b) => a[1].due.localeCompare(b[1].due)).slice(0, limit).map(([k]) => k);
}

// ── Units ────────────────────────────────────────────────────────────────────────────────────────
export const unitKey = (worldId: string, unitId: string) => `${worldId}/${unitId}`;
/** Played at least once at 70%+: the next unit opens. Keeps momentum (ADHD) while mastery is tracked separately. */
export const UNLOCK_AT = 0.7;
/** Kumon-style mastery: 90% average over the last three rounds. */
export const MASTERY_AT = 0.9;
export const isCleared = (p?: UnitProgress) => !!p && p.best >= UNLOCK_AT;
export const isMastered = (p?: UnitProgress) => !!p && p.last.length >= 3 && p.last.reduce((a, b) => a + b, 0) / p.last.length >= MASTERY_AT;
