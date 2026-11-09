// Achievements, derived from the save so a migrated v1 player earns what they already did. Pure.
import { liveWorlds } from "@/content";
import { type Save, isCleared, isMastered, rankOf, unitKey } from "./save";
import { totals } from "./stats";

export interface Achievement {
  id: string;
  label: string;
  /** How to earn it, in one plain sentence. Shown on earned and unearned badges alike. */
  how: string;
  earned: boolean;
}

const RANK_AT = (xp: number, rank: string) => ["E", "D", "C", "B", "A", "S"].indexOf(rankOf(xp).rank) >= ["E", "D", "C", "B", "A", "S"].indexOf(rank);

export function achievementsOf(save: Save): Achievement[] {
  const t = totals(save);
  const units = Object.values(save.units);
  const clearedUnits = units.filter(isCleared).length;
  const worldDone = liveWorlds().some((w) => w.units.length > 0 && w.units.every((u) => isCleared(save.units[unitKey(w.id, u.id)])));
  const cards = Object.values(save.cards);
  const defs: [string, string, string, boolean][] = [
    ["first-round", "First round", "Finish one round.", t.rounds >= 1],
    ["perfect", "Flawless", "Get every card right in a round.", units.some((u) => u.best >= 1)],
    ["fixer", "Put it right", "Finish a Fix your mistakes pass.", save.events.some((e) => e.type === "fix")],
    ["days-3", "Three days", "Play on three different days. Days only count up.", t.days >= 3],
    ["days-7", "Seven days", "Play on seven different days. Missed days cost nothing.", t.days >= 7],
    ["days-30", "Thirty days", "Play on thirty different days.", t.days >= 30],
    ["units-5", "Five cleared", "Clear five units at 70% or better.", clearedUnits >= 5],
    ["world", "World cleared", "Clear every unit in one world.", worldDone],
    ["mastered", "Locked in", "Average 90% over your last three rounds of a unit.", units.some(isMastered)],
    ["cards-50", "Fifty cards", "Meet fifty different cards.", t.cardsLearned >= 50],
    ["memory", "Long memory", "Get a card to stick for a week or more.", cards.some((m) => m.stability >= 7)],
    ["rank-d", "Rank D", "Earn 150 XP.", RANK_AT(save.xp, "D")],
    ["rank-b", "Rank B", "Earn 1,000 XP.", RANK_AT(save.xp, "B")],
    ["rank-s", "Rank S", "Earn 4,000 XP.", RANK_AT(save.xp, "S")],
  ];
  return defs.map(([id, label, how, earned]) => ({ id, label, how, earned }));
}
