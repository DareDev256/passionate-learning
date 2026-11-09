// Pure round logic: build a round, grade a response, apply the result to the save. No DOM, fully testable.
import type { Card, Unit, World } from "@/content/types";
import { cardKey, findCard } from "@/content";
import { type Save, dueKeys, freshQuests, isMastered, rankOf, recallMultiplier, reviewCard, today, unitKey, type Rank } from "./save";
import { newId } from "./uuid";

export interface RoundCard { key: string; card: Card; worldId: string; review: boolean }

/** Seeded shuffle so a round is stable across re-renders. */
export function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A unit's cards (shuffled) plus up to 2 due review cards from anywhere else. Max 8 cards: one short round. */
export function buildRound(world: World, unit: Unit, save: Save, seed = Date.now()): RoundCard[] {
  const own = shuffle(unit.cards, seed).map((card) => ({ key: cardKey(world.id, card), card, worldId: world.id, review: false }));
  const ownKeys = new Set(own.map((c) => c.key));
  const reviews = dueKeys(save)
    .filter((k) => !ownKeys.has(k))
    .map((k) => findCard(k))
    .filter((x): x is NonNullable<typeof x> => !!x && x.world.status === "live")
    .slice(0, 2)
    .map(({ key, card, world: w }) => ({ key, card, worldId: w.id, review: true }));
  return [...own.slice(0, 8 - reviews.length), ...reviews].slice(0, 8);
}

export type Response =
  | { type: "choice"; index: number }
  | { type: "cap"; saysCap: boolean }
  | { type: "predict"; index: number }
  | { type: "spot"; index: number }
  | { type: "order"; order: string[] }
  | { type: "type"; text: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function grade(card: Card, r: Response): boolean {
  switch (card.type) {
    case "choice": return r.type === "choice" && r.index === card.answer;
    case "cap": return r.type === "cap" && r.saysCap === card.isCap;
    case "predict": {
      if (r.type !== "predict") return false;
      const top = card.options.reduce((b, o, i) => (o.p > card.options[b].p ? i : b), 0);
      return r.index === top;
    }
    case "spot": return r.type === "spot" && r.index === card.answer;
    case "order": return r.type === "order" && r.order.length === card.steps.length && r.order.every((s, i) => s === card.steps[i]);
    case "type": return r.type === "type" && card.accept.some((a) => norm(a) === norm(r.text));
  }
}

export const BASE_XP = 10;

export interface Answer { key: string; correct: boolean; review: boolean }

export interface RoundResult {
  save: Save;
  xpGained: number;
  correct: number;
  total: number;
  accuracy: number;
  bonusCards: number;
  tokensGained: number;
  rankBefore: Rank;
  rankAfter: Rank;
  mastered: boolean;
  firstOfDay: boolean;
  /** Quests this round newly completed. */
  questDone: { round: boolean; review: boolean; second: boolean };
  /** Finished inside the 60-second target: a bonus, never a penalty. */
  speedBonus: number;
}

/** The round's time target. Beat it for a bonus; miss it and nothing bad happens. */
export const TARGET_SECONDS = 60;
export const SPEED_BONUS = 15;

/** Which of today's three quests are done. */
function questFlags(q: Save["quests"]) { return { round: q.rounds >= 1, review: q.reviewed, second: q.rounds >= 2 }; }

/** Applies a finished round to the save. Returns the new save plus everything the recap screen shows. */
export function applyRound(save: Save, world: World, unit: Unit, answers: Answer[], now = new Date(), seconds?: number): RoundResult {
  const s: Save = { ...save, cards: { ...save.cards }, units: { ...save.units }, days: [...save.days], quests: { ...save.quests }, events: [...save.events] };
  const ownKeys = new Set(unit.cards.map((c) => cardKey(world.id, c)));
  const nothingDue = dueKeys(save, now).every((k) => ownKeys.has(k));
  let xp = 0, bonusCards = 0;
  for (const a of answers) {
    const before = s.cards[a.key];
    const mult = a.correct ? recallMultiplier(before, now) : 1;
    if (mult > 1) bonusCards++;
    xp += a.correct ? BASE_XP * mult : 2; // trying still counts a little: safe failure
    s.cards[a.key] = reviewCard(before, a.correct, now, a.key);
  }
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const accuracy = total ? correct / total : 0;
  if (accuracy === 1 && total > 0) xp += 20; // perfect-round bonus
  const speedBonus = seconds !== undefined && seconds <= TARGET_SECONDS && accuracy >= 0.5 ? SPEED_BONUS : 0;
  xp += speedBonus;
  const k = unitKey(world.id, unit.id);
  const prev = s.units[k] ?? { last: [], best: 0, rounds: 0 };
  s.units[k] = { last: [...prev.last, accuracy].slice(-3), best: Math.max(prev.best, accuracy), rounds: prev.rounds + 1 };
  const rankBefore = rankOf(s.xp).rank;
  s.xp += xp;
  const day = today(now);
  const firstOfDay = !s.days.includes(day);
  if (firstOfDay) s.days.push(day);
  if (s.quests.date !== day) s.quests = freshQuests(now);
  const qBefore = questFlags(s.quests);
  s.quests.rounds += 1;
  // The review quest has a floor: with nothing due there is nothing to clear, so answering a review card is not required.
  if (answers.some((a) => a.review) || nothingDue) s.quests.reviewed = true;
  s.events.push({ id: newId(), type: "round", unit: k, cards: answers.map((a) => a.key), correct: answers.map((a) => a.correct), durationMs: Math.round((seconds ?? 0) * 1000), clientTs: now.getTime() });
  const tokensGained = 1 + (accuracy === 1 ? 1 : 0);
  s.tokens += tokensGained;
  return {
    save: s, xpGained: xp, correct, total, accuracy, bonusCards, tokensGained,
    rankBefore, rankAfter: rankOf(s.xp).rank,
    mastered: !isMastered(prev) && isMastered(s.units[k]),
    firstOfDay,
    speedBonus,
    questDone: (() => { const a = questFlags(s.quests); return { round: !qBefore.round && a.round, review: !qBefore.review && a.review, second: !qBefore.second && a.second }; })(),
  };
}

/** Keys of the cards answered wrong, in the order they were met, each once. */
export function missedKeys(answers: Answer[]): string[] {
  return [...new Set(answers.filter((a) => !a.correct).map((a) => a.key))];
}

/** XP for a card put right in a fix pass. Smaller than a round's 10: the point is the memory, not the score. */
export const FIX_XP = 5;

export interface FixResult { save: Save; xpGained: number; correct: number; total: number; rankBefore: Rank; rankAfter: Rank }

/**
 * Applies a "fix your mistakes" pass. Card memory is reviewed and the review quest is ticked, but unit progress, days played,
 * tokens and the round quests are left alone: a fix pass is practice on top of a round, never a second score for it.
 */
export function applyFix(save: Save, unit: string, answers: Answer[], now = new Date(), seconds?: number): FixResult {
  const s: Save = { ...save, cards: { ...save.cards }, quests: { ...save.quests }, events: [...save.events] };
  let xp = 0;
  const rankBefore = rankOf(s.xp).rank;
  for (const a of answers) {
    s.cards[a.key] = reviewCard(s.cards[a.key], a.correct, now, a.key);
    if (a.correct) xp += FIX_XP;
  }
  s.xp += xp;
  if (s.quests.date !== today(now)) s.quests = freshQuests(now);
  if (answers.length) s.quests.reviewed = true;
  s.events.push({ id: newId(), type: "fix", unit, cards: answers.map((a) => a.key), correct: answers.map((a) => a.correct), durationMs: Math.round((seconds ?? 0) * 1000), clientTs: now.getTime() });
  return { save: s, xpGained: xp, correct: answers.filter((a) => a.correct).length, total: answers.length, rankBefore, rankAfter: rankOf(s.xp).rank };
}
