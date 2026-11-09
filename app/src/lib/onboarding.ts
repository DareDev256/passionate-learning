// First launch: one question that picks the first world. Pure data and two small functions.
import { getWorld } from "@/content";
import type { Goal, Save } from "./save";

export interface GoalChoice {
  id: Goal;
  label: string;
  line: string;
  /** The world the player starts in. Its first unit is always open. */
  worldId: string;
}

export const GOALS: readonly GoalChoice[] = [
  { id: "work", label: "For work", line: "Talk to AI so it saves you real time.", worldId: "prompt" },
  { id: "curious", label: "Just curious", line: "See how AI actually thinks.", worldId: "token" },
  { id: "protect", label: "Protect myself", line: "Catch fakes and made-up answers.", worldId: "cap" },
  { id: "build", label: "Build stuff", line: "Pick the right tool for the job.", worldId: "tools" },
];

/** The first card is for a brand new player only. Anyone with progress, or who has already answered or skipped it, never sees it. */
export function needsOnboarding(save: Save): boolean {
  return !save.profile.onboarded && save.xp === 0 && save.days.length === 0 && Object.keys(save.units).length === 0;
}

/** Where a goal sends the player: the world and its first unit. */
export function startFor(goal: Goal): { worldId: string; unitId: string } {
  const g = GOALS.find((x) => x.id === goal)!;
  return { worldId: g.worldId, unitId: getWorld(g.worldId)!.units[0].id };
}
