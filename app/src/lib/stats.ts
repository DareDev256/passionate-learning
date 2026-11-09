// Numbers for the profile page, derived from the save. Pure.
import { liveWorlds } from "@/content";
import type { World } from "@/content/types";
import type { Save } from "./save";

export interface WorldAccuracy {
  world: World;
  /** Answers given across this world's cards (v1 and v2 saves both keep per-card seen and correct). */
  seen: number;
  correct: number;
  /** 0..1, or null when nothing has been answered here yet (never a fake 0%). */
  accuracy: number | null;
}

/** Accuracy per live world from per-card memory. A world the player never touched reads null, not 0%. */
export function worldAccuracy(save: Save): WorldAccuracy[] {
  return liveWorlds().map((world) => {
    let seen = 0, correct = 0;
    for (const [key, m] of Object.entries(save.cards)) if (key.startsWith(`${world.id}:`)) { seen += m.seen; correct += m.correct; }
    return { world, seen, correct, accuracy: seen > 0 ? correct / seen : null };
  });
}

export interface Totals {
  rounds: number;
  cardsLearned: number;
  accuracy: number | null;
  days: number;
}

export function totals(save: Save): Totals {
  const rounds = Object.values(save.units).reduce((n, u) => n + u.rounds, 0);
  const cards = Object.values(save.cards);
  const seen = cards.reduce((n, m) => n + m.seen, 0);
  const correct = cards.reduce((n, m) => n + m.correct, 0);
  return { rounds, cardsLearned: cards.filter((m) => m.seen > 0).length, accuracy: seen > 0 ? correct / seen : null, days: save.days.length };
}
