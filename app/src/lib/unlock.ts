import type { Unit, World } from "@/content/types";
import { UNLOCK_AT, isCleared, unitKey, type Save } from "./save";

/** Position of a unit in its world, or -1 when the id is unknown. */
export const unitIndex = (world: World, unitId: string): number => world.units.findIndex((u) => u.id === unitId);

/** The unit to finish first, or null when this one is open. Unknown ids are blocked by the first unit. */
export function blockingUnit(world: World, unitId: string, save: Save): Unit | null {
  const i = unitIndex(world, unitId);
  if (i === 0) return null;
  const prev = world.units[Math.max(i - 1, 0)];
  return i > 0 && isCleared(save.units[unitKey(world.id, prev.id)]) ? null : prev;
}

/** Unit 1 is always open; every other unit opens once the one before it is cleared. */
export const isUnitOpen = (world: World, unitId: string, save: Save): boolean => unitIndex(world, unitId) >= 0 && blockingUnit(world, unitId, save) === null;

export interface UnlockMessage {
  kind: "opened" | "open-already" | "need" | "last";
  text: string;
}

/** Right answers a round of `total` cards needs to reach the unlock line. */
export const rightNeeded = (total: number): number => Math.max(1, Math.ceil(UNLOCK_AT * total - 1e-9));

/**
 * The recap's line about what unlocks next and what it needs. `wasCleared` is whether the unit was already cleared before
 * this round, so a repeat does not announce an unlock twice. Plain words, no streak, no guilt.
 */
export function unlockMessage(world: World, unitId: string, accuracy: number, total: number, wasCleared: boolean): UnlockMessage {
  const next = world.units[unitIndex(world, unitId) + 1];
  const pct = Math.round(accuracy * 100);
  const cleared = wasCleared || accuracy >= UNLOCK_AT;
  const line = Math.round(UNLOCK_AT * 100);
  if (cleared) {
    if (!next) return { kind: "last", text: `That clears the last unit in ${world.title}. Pick another world on the map.` };
    return wasCleared
      ? { kind: "open-already", text: `\u201C${next.title}\u201D is already open. Go when you are ready.` }
      : { kind: "opened", text: `${pct}% opens \u201C${next.title}\u201D. It is ready for you.` };
  }
  const need = rightNeeded(total);
  const target = next ? `opens \u201C${next.title}\u201D` : "clears this unit";
  return { kind: "need", text: `${pct}%. ${line}% ${target}. Get ${need} of ${total} right next round and it does.` };
}
