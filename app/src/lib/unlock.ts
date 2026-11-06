import type { Unit, World } from "@/content/types";
import { isCleared, unitKey, type Save } from "./save";

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
