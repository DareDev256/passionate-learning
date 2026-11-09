// The Home path: every live unit in one line, the player's own goal world first. Pure.
import { liveWorlds } from "@/content";
import type { Unit, World } from "@/content/types";
import { type Save, isCleared, unitKey } from "./save";
import { GOALS } from "./onboarding";
import { isUnitOpen } from "./unlock";

export interface PathNode { world: World; unit: Unit; cleared: boolean; open: boolean }

/** Live worlds with the player's goal world first, then the catalogue order. */
export function worldOrder(save: Save): World[] {
  const all = liveWorlds();
  const goalId = GOALS.find((g) => g.id === save.profile.goal)?.worldId;
  const first = all.find((w) => w.id === goalId);
  return first ? [first, ...all.filter((w) => w !== first)] : all;
}

/** Every unit in path order, with whether it is cleared and whether it can be opened right now. */
export function pathNodes(save: Save): PathNode[] {
  return worldOrder(save).flatMap((world) => world.units.map((unit) => ({
    world, unit, cleared: isCleared(save.units[unitKey(world.id, unit.id)]), open: isUnitOpen(world, unit.id, save),
  })));
}

export interface PathView {
  /** How many nodes before the lit one are cleared (folded into one chip). */
  cleared: number;
  /** The lit node: the first unit not yet cleared. Null when every unit is cleared. */
  current: PathNode | null;
  /** The next few nodes after the lit one. */
  ahead: PathNode[];
}

export function pathWindow(save: Save, aheadCount = 3): PathView {
  const nodes = pathNodes(save);
  const i = nodes.findIndex((n) => !n.cleared);
  if (i === -1) return { cleared: nodes.length, current: null, ahead: [] };
  return { cleared: nodes.slice(0, i).filter((n) => n.cleared).length, current: nodes[i], ahead: nodes.slice(i + 1, i + 1 + aheadCount) };
}
