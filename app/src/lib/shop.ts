// The arcade shop. Pure functions over the save: tokens buy themes (no money, no purchases), and a token never goes below zero.
import { type Save, type SaveEvent } from "./save";
import { themeById } from "./themes";
import { newId } from "./uuid";

export type ShopResult =
  | { ok: true; save: Save }
  | { ok: false; save: Save; reason: "unknown" | "owned" | "notEnough" | "notOwned"; need?: number };

function event(type: SaveEvent["type"], unit: string, now: Date): SaveEvent {
  return { id: newId(), type, unit, cards: [], correct: [], durationMs: 0, clientTs: now.getTime() };
}

/** Buys a theme with tokens. Refuses (same save back) when the id is unknown, already owned, or the tokens fall short. */
export function buyTheme(save: Save, id: string, now = new Date()): ShopResult {
  const t = themeById(id);
  if (!t) return { ok: false, save, reason: "unknown" };
  if (save.themes.owned.includes(id)) return { ok: false, save, reason: "owned" };
  if (save.tokens < t.price) return { ok: false, save, reason: "notEnough", need: t.price - save.tokens };
  return {
    ok: true,
    save: { ...save, tokens: save.tokens - t.price, themes: { ...save.themes, owned: [...save.themes.owned, id] }, events: [...save.events, event("buy", id, now)] },
  };
}

/** Equips a theme the player owns. */
export function equipTheme(save: Save, id: string, now = new Date()): ShopResult {
  if (!themeById(id)) return { ok: false, save, reason: "unknown" };
  if (!save.themes.owned.includes(id)) return { ok: false, save, reason: "notOwned" };
  if (save.themes.equipped === id) return { ok: true, save };
  return { ok: true, save: { ...save, themes: { ...save.themes, equipped: id }, events: [...save.events, event("equip", id, now)] } };
}

/** One token for one game of What's Poppin. Never goes below zero. */
export function spendToken(save: Save): { ok: boolean; save: Save } {
  if (!(save.tokens >= 1)) return { ok: false, save };
  return { ok: true, save: { ...save, tokens: save.tokens - 1 } };
}
