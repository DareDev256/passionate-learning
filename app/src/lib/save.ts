// One save for the whole app: XP, rank, days played, per-card memory (FSRS), unit progress, daily quests, arcade tokens, an event log.
// localStorage, versioned, defensive: a corrupt save becomes a fresh one instead of a crash.
import { DEFAULT_THEME, THEMES, isThemeId } from "./themes";
import { FSRS, Rating, StrategyMode, createEmptyCard, type Card as FCard, type Grade } from "ts-fsrs";

export const SAVE_KEY = "passionate-learning:v2";
/** The v1 save's key. Read once to upgrade, then removed; the payload lives on as BACKUP_KEY. */
export const LEGACY_KEY = "passionate-learning:v1";
export const BACKUP_KEY = "passionate-learning:v1-backup";
/** A v2 key that could not be read (corrupt, or from a newer build), copied here before it is overwritten. */
export const PRESERVED_KEY = "passionate-learning:v2-preserved";

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

export type MotionPref = "system" | "reduce" | "full";
export interface Settings { sound: boolean; haptics: boolean; motion: MotionPref; name: string }

/** What brought the player here: picks their first world and the order of their path. */
export type Goal = "work" | "curious" | "protect" | "build";
export const GOAL_IDS: readonly Goal[] = ["work", "curious", "protect", "build"];

/**
 * One thing the player did, appended and never edited. Server state in P3 is a fold over these and a merge is a union by `id`.
 * `cards` and `correct` line up by index.
 */
export interface SaveEvent {
  id: string;
  type: "round" | "fix" | "buy" | "equip";
  /** "world/unit" for a round; the unit the missed cards came from for a fix; the theme id for a buy or an equip (cards and correct are empty). */
  unit: string;
  cards: string[];
  correct: boolean[];
  durationMs: number;
  /** The device clock when it happened. The server will use its own receipt time for anything that counts. */
  clientTs: number;
}

/** XP carried over from a v1 save. Kept in full locally; a server credits at most `cap` and never to leagues. */
export interface Imported { xp: number; cap: number; unverified: true }

/** Today's quests. The chest opens once all three are done. */
export interface Quests { date: string; rounds: number; reviewed: boolean; chest: boolean }

/** Themes the player owns and the one in use. Notebook is always owned. */
export interface ThemeState { owned: string[]; equipped: string }

export interface Save {
  v: 2;
  xp: number;
  /** ISO dates (YYYY-MM-DD) on which at least one round was finished. Never resets on a missed day; only the player's own Reset progress clears it. */
  days: string[];
  cards: Record<string, CardMemory>;
  units: Record<string, UnitProgress>;
  quests: Quests;
  tokens: number;
  settings: Settings;
  themes: ThemeState;
  profile: { goal: Goal | null; onboarded: boolean };
  /** Append-only log of rounds and fix passes. */
  events: SaveEvent[];
  /** How many of `events`, from the start, a server has already received. 0 until accounts exist. */
  flushed: number;
  imported: Imported | null;
}

export const today = (d = new Date()) => d.toLocaleDateString("en-CA");

export const freshQuests = (now = new Date()): Quests => ({ date: today(now), rounds: 0, reviewed: false, chest: false });

export function freshSave(): Save {
  return {
    v: 2, xp: 0, days: [], cards: {}, units: {}, quests: freshQuests(), tokens: 0,
    settings: { sound: true, haptics: true, motion: "system", name: "" },
    themes: { owned: [DEFAULT_THEME], equipped: DEFAULT_THEME },
    profile: { goal: null, onboarded: false }, events: [], flushed: 0, imported: null,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** The most XP one answered card can pay (a correct recall after 30+ days is 3x the base 10). */
export const MAX_XP_PER_CARD = 30;
/** The most one round adds on top of its cards: the perfect bonus (20) and the speed bonus (15). */
export const MAX_XP_PER_ROUND = 35;

/** What a server may credit from XP that came from a v1 save: what the save's own card and round counts could have paid. */
export function importCap(s: Pick<Save, "cards" | "units">): number {
  const seen = Object.values(s.cards).reduce((n, m) => n + (isNum(m.seen) ? m.seen : 0), 0);
  const rounds = Object.values(s.units).reduce((n, u) => n + u.rounds, 0);
  return seen * MAX_XP_PER_CARD + rounds * MAX_XP_PER_ROUND;
}

function sanitizeEvents(raw: unknown): SaveEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: SaveEvent[] = [];
  for (const e of raw) {
    if (!isObj(e) || typeof e.id !== "string" || (e.type !== "round" && e.type !== "fix" && e.type !== "buy" && e.type !== "equip") || typeof e.unit !== "string") continue;
    if (!Array.isArray(e.cards) || !Array.isArray(e.correct) || e.cards.length !== e.correct.length) continue;
    if (!e.cards.every((c) => typeof c === "string") || !e.correct.every((c) => typeof c === "boolean")) continue;
    if (!isNum(e.durationMs) || e.durationMs < 0 || !isNum(e.clientTs)) continue;
    out.push({ id: e.id, type: e.type, unit: e.unit, cards: e.cards as string[], correct: e.correct as boolean[], durationMs: e.durationMs, clientTs: e.clientTs });
  }
  return out;
}

const validDate = (x: unknown): x is string => typeof x === "string" && Number.isFinite(new Date(x).getTime());
const count = (x: unknown): number => (isNum(x) && x >= 0 ? Math.floor(x) : 0);

/** Owned ids that exist in the catalogue (Notebook always included); an equipped id the player does not own falls back to Notebook. */
export function cleanThemes(raw: unknown): ThemeState {
  const owned = new Set<string>([DEFAULT_THEME]);
  let equipped = DEFAULT_THEME;
  if (isObj(raw)) {
    if (Array.isArray(raw.owned)) for (const id of raw.owned) if (isThemeId(id)) owned.add(id);
    if (isThemeId(raw.equipped) && owned.has(raw.equipped)) equipped = raw.equipped;
  }
  return { owned: THEMES.map((t) => t.id).filter((id) => owned.has(id)), equipped };
}

/**
 * Rebuilds one card memory field by field so nothing malformed can reach the scheduler (a missing stability or a bad
 * date would throw inside a round). A memory with no usable schedule becomes a new card that is due now, keeping the
 * player's seen and correct counts. A memory with no usable due date is dropped.
 */
function cleanCard(v: unknown): CardMemory | null {
  if (!isObj(v) || !validDate(v.due)) return null;
  const usable = isNum(v.stability) && isNum(v.difficulty) && isNum(v.state) && v.state >= 1 && v.state <= 3;
  const m: CardMemory = {
    due: v.due, stability: usable ? (v.stability as number) : 0, difficulty: usable ? (v.difficulty as number) : 0,
    elapsed_days: count(v.elapsed_days), scheduled_days: count(v.scheduled_days), reps: usable ? count(v.reps) : 0, lapses: usable ? count(v.lapses) : 0,
    state: usable ? Math.floor(v.state as number) : 0, seen: count(v.seen), correct: Math.min(count(v.correct), count(v.seen)),
  };
  if (usable && validDate(v.last_review)) m.last_review = v.last_review;
  return m;
}

/**
 * Accepts anything; returns a valid v2 Save. A v1 save is upgraded (nothing it holds is dropped); a v2 save is cleaned;
 * anything else becomes a fresh save. Unknown or malformed fields fall back to defaults.
 */
export function migrate(raw: unknown): Save {
  const s = freshSave();
  if (!isObj(raw) || (raw.v !== 1 && raw.v !== 2)) return s;
  if (isNum(raw.xp) && raw.xp >= 0) s.xp = Math.floor(raw.xp);
  if (Array.isArray(raw.days)) s.days = [...new Set(raw.days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (isObj(raw.cards)) for (const [k, v] of Object.entries(raw.cards)) if (/^[a-z0-9-]+:[a-z0-9-]+$/.test(k)) { const c = cleanCard(v); if (c) s.cards[k] = c; }
  if (isObj(raw.units)) for (const [k, v] of Object.entries(raw.units)) if (isObj(v)) s.units[k] = { last: (Array.isArray(v.last) ? v.last : []).filter((n): n is number => isNum(n)).slice(-3), best: Math.min(1, Math.max(0, Number(v.best) || 0)), rounds: Math.max(0, Math.floor(Number(v.rounds) || 0)) };
  if (isNum(raw.tokens) && raw.tokens >= 0) s.tokens = Math.floor(raw.tokens);
  if (isObj(raw.settings)) s.settings = { sound: raw.settings.sound !== false, haptics: raw.settings.haptics !== false, motion: raw.settings.motion === "reduce" || raw.settings.motion === "full" ? raw.settings.motion : "system", name: typeof raw.settings.name === "string" ? raw.settings.name.slice(0, 24) : "" };

  if (raw.v === 2) {
    s.themes = cleanThemes(raw.themes);
    if (isObj(raw.quests) && typeof raw.quests.date === "string") s.quests = { date: raw.quests.date, rounds: isNum(raw.quests.rounds) && raw.quests.rounds >= 0 ? Math.floor(raw.quests.rounds) : 0, reviewed: !!raw.quests.reviewed, chest: !!raw.quests.chest };
    if (isObj(raw.profile)) s.profile = { goal: GOAL_IDS.includes(raw.profile.goal as Goal) ? (raw.profile.goal as Goal) : null, onboarded: !!raw.profile.onboarded };
    s.events = sanitizeEvents(raw.events);
    s.flushed = isNum(raw.flushed) ? Math.min(s.events.length, Math.max(0, Math.floor(raw.flushed))) : 0;
    if (isObj(raw.imported) && isNum(raw.imported.xp) && isNum(raw.imported.cap)) s.imported = { xp: Math.max(0, Math.floor(raw.imported.xp)), cap: Math.max(0, Math.floor(raw.imported.cap)), unverified: true };
    return s;
  }

  // v1 -> v2. The old daily quest carries over for today only; its "perfect" tick has no v2 quest and is dropped.
  if (isObj(raw.quest) && typeof raw.quest.date === "string" && raw.quest.date === s.quests.date) s.quests = { date: raw.quest.date, rounds: raw.quest.round ? 1 : 0, reviewed: !!raw.quest.review, chest: false };
  const played = s.xp > 0 || s.days.length > 0 || Object.keys(s.units).length > 0 || Object.keys(s.cards).length > 0;
  s.profile = { goal: null, onboarded: played };
  if (s.xp > 0) s.imported = { xp: s.xp, cap: importCap(s), unverified: true };
  return s;
}

/** The class the `<html>` element carries for a motion preference. */
export const motionClass = (m: MotionPref): "" | "reduce-motion" => (m === "reduce" ? "reduce-motion" : "");

/** The v2 save, or a v1 save upgraded once. A valid v2 save is never replaced by an older one. */
export function loadSave(now = new Date()): Save {
  if (typeof window === "undefined") return freshSave();
  try {
    const rawV2 = localStorage.getItem(SAVE_KEY);
    if (rawV2) {
      try {
        const parsed: unknown = JSON.parse(rawV2);
        if (isObj(parsed) && parsed.v === 2) return rollQuest(migrate(parsed), now);
      } catch { /* unreadable: handled below */ }
      // A v2 key we cannot use (corrupt, or written by a newer build): keep the original before anything overwrites it.
      try { if (localStorage.getItem(PRESERVED_KEY) === null) localStorage.setItem(PRESERVED_KEY, rawV2); } catch { /* nothing more to do */ }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    const source = legacy ?? localStorage.getItem(BACKUP_KEY);
    if (!source) return freshSave();
    const upgraded = migrate(JSON.parse(source));
    const json = JSON.stringify(upgraded);
    try {
      localStorage.setItem(SAVE_KEY, json);
      // Only once the v2 save reads back, and never over a backup that already exists: the first v1 payload is the one worth keeping.
      if (localStorage.getItem(SAVE_KEY) === json && legacy !== null && localStorage.getItem(BACKUP_KEY) === null) { localStorage.setItem(BACKUP_KEY, legacy); localStorage.removeItem(LEGACY_KEY); }
    } catch { /* full or blocked: play on, and the v1 data is still there for the next try */ }
    return rollQuest(upgraded, now);
  } catch { return freshSave(); }
}

export function writeSave(s: Save): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode or full: play on without saving */ }
}

/** Removes the v1 backup (and any v1 key). Reset progress calls this so a reset really is one: the backup must not bring the old save back. */
export function forgetLegacy(): void {
  try { localStorage.removeItem(BACKUP_KEY); localStorage.removeItem(LEGACY_KEY); localStorage.removeItem(PRESERVED_KEY); } catch { /* nothing to forget if storage is blocked */ }
}

/** A new day gets new quests. */
export function rollQuest(s: Save, now = new Date()): Save {
  return s.quests.date === today(now) ? s : { ...s, quests: freshQuests(now) };
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
// No same-day learning steps: a miss comes back tomorrow, which is what "you will see this again Thursday" can truthfully say.
// "Fix your mistakes" is the immediate retry. Fuzz stays but is seeded per card and rep, so the date shown after an answer is the date stored.
let fuzzSeed = "card";
const scheduler = new FSRS({ enable_fuzz: true, enable_short_term: false }).useStrategy(StrategyMode.SEED, () => fuzzSeed);

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

export function reviewCard(m: CardMemory | undefined, correct: boolean, now = new Date(), seed = "card"): CardMemory {
  fuzzSeed = `${seed}|${m?.reps ?? 0}|${m?.last_review ?? ""}|${correct}`;
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
