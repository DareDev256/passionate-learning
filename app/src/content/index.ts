import type { Card, World } from "./types";
import { promptDojo } from "./worlds/prompt-dojo";
import { tokenTemple } from "./worlds/token-temple";
import { capDetector } from "./worlds/cap-detector";
import { redTeam } from "./worlds/red-team";
import { toolShop } from "./worlds/tool-shop";
import { circuitLab } from "./worlds/circuit-lab";
import { netRun } from "./worlds/net-run";
import { speedKeys } from "./worlds/speed-keys";
import { biasCheck } from "./worlds/bias-check";
import { comingSoon } from "./worlds/soon";

/** The catalogue, in map order. Add a world here and it appears in the app. */
export const WORLDS: World[] = [promptDojo, tokenTemple, capDetector, redTeam, biasCheck, toolShop, netRun, circuitLab, speedKeys, ...comingSoon];

export const CATALOGUE_DATE = "2026-10-03";

export const liveWorlds = () => WORLDS.filter((w) => w.status === "live");
export const getWorld = (id: string) => WORLDS.find((w) => w.id === id);
export const getUnit = (worldId: string, unitId: string) => getWorld(worldId)?.units.find((u) => u.id === unitId);
/** Globally unique key used by progress and spaced repetition. */
export const cardKey = (worldId: string, card: Card) => `${worldId}:${card.id}`;

export function allCards(): { world: World; card: Card; key: string }[] {
  return WORLDS.flatMap((world) => world.units.flatMap((u) => u.cards.map((card) => ({ world, card, key: cardKey(world.id, card) }))));
}

export function findCard(key: string) {
  return allCards().find((c) => c.key === key);
}
