// Pure round logic: build a round, grade a response, apply the result to the save. No DOM, fully testable.
import type { Card, Unit, World } from "@/content/types";
import { cardKey, findCard } from "@/content";
import { type Save, dueKeys, isMastered, rankOf, recallMultiplier, reviewCard, today, unitKey, type Rank } from "./save";

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
  questDone: { round: boolean; review: boolean; perfect: boolean };
  /** Finished inside the 60-second target: a bonus, never a penalty. */
  speedBonus: number;
}

/** The round's time target. Beat it for a bonus; miss it and nothing bad happens. */
export const TARGET_SECONDS = 60;
export const SPEED_BONUS = 15;

/** Applies a finished round to the save. Returns the new save plus everything the recap screen shows. */
export function applyRound(save: Save, world: World, unit: Unit, answers: Answer[], now = new Date(), seconds?: number): RoundResult {
  const s: Save = { ...save, cards: { ...save.cards }, units: { ...save.units }, days: [...save.days], quest: { ...save.quest } };
  let xp = 0, bonusCards = 0;
  for (const a of answers) {
    const before = s.cards[a.key];
    const mult = a.correct ? recallMultiplier(before, now) : 1;
    if (mult > 1) bonusCards++;
    xp += a.correct ? BASE_XP * mult : 2; // trying still counts a little: safe failure
    s.cards[a.key] = reviewCard(before, a.correct, now);
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
  if (s.quest.date !== day) s.quest = { date: day, round: false, review: false, perfect: false };
  const qBefore = { ...s.quest };
  s.quest.round = true;
  if (answers.some((a) => a.review)) s.quest.review = true;
  if (accuracy === 1 && total > 0) s.quest.perfect = true;
  const tokensGained = 1 + (accuracy === 1 ? 1 : 0);
  s.tokens += tokensGained;
  return {
    save: s, xpGained: xp, correct, total, accuracy, bonusCards, tokensGained,
    rankBefore, rankAfter: rankOf(s.xp).rank,
    mastered: !isMastered(prev) && isMastered(s.units[k]),
    firstOfDay,
    speedBonus,
    questDone: { round: !qBefore.round && s.quest.round, review: !qBefore.review && s.quest.review, perfect: !qBefore.perfect && s.quest.perfect },
  };
}
