import type { Card, World } from "./types";

/** Returns every problem in the catalogue. Empty array = valid. Used by the test suite and `npm run validate`. */
export function validateWorlds(worlds: World[]): string[] {
  const errs: string[] = [];
  const worldIds = new Set<string>();
  for (const w of worlds) {
    if (worldIds.has(w.id)) errs.push(`duplicate world id ${w.id}`);
    worldIds.add(w.id);
    if (!/^#[0-9a-f]{6}$/i.test(w.accent)) errs.push(`${w.id}: accent must be #rrggbb`);
    if (w.status === "live" && w.units.length === 0) errs.push(`${w.id}: live world with no units`);
    const cardIds = new Set<string>();
    const unitIds = new Set<string>();
    for (const u of w.units) {
      if (unitIds.has(u.id)) errs.push(`${w.id}: duplicate unit ${u.id}`);
      unitIds.add(u.id);
      if (u.cards.length < 4) errs.push(`${w.id}/${u.id}: a unit needs at least 4 cards (has ${u.cards.length})`);
      for (const c of u.cards) {
        const at = `${w.id}/${u.id}/${c.id}`;
        if (cardIds.has(c.id)) errs.push(`${at}: duplicate card id`);
        cardIds.add(c.id);
        if (!/^[a-z0-9-]{2,40}$/.test(c.id)) errs.push(`${at}: id must be lowercase letters, digits, dashes`);
        if (!c.why || c.why.trim().length < 12) errs.push(`${at}: every card needs a real "why"`);
        errs.push(...checkCard(c).map((e) => `${at}: ${e}`));
      }
    }
  }
  return errs;
}

function checkCard(c: Card): string[] {
  switch (c.type) {
    case "choice":
      return [
        ...(c.options.length < 2 || c.options.length > 4 ? ["choice needs 2 to 4 options"] : []),
        ...(c.answer < 0 || c.answer >= c.options.length ? ["answer index out of range"] : []),
        ...(new Set(c.options).size !== c.options.length ? ["duplicate options"] : []),
      ];
    case "cap":
      return c.claim.trim() ? [] : ["empty claim"];
    case "predict": {
      const top = Math.max(...c.options.map((o) => o.p));
      const sum = c.options.reduce((s, o) => s + o.p, 0);
      return [
        ...(c.options.length < 2 ? ["predict needs 2+ options"] : []),
        ...(sum > 1.0001 ? ["probabilities add up to more than 1"] : []),
        ...(c.options.filter((o) => o.p === top).length > 1 ? ["predict needs one clear top token"] : []),
      ];
    }
    case "spot":
      return [
        ...(c.sentences.length < 3 ? ["spot needs 3+ sentences"] : []),
        ...(c.answer < 0 || c.answer >= c.sentences.length ? ["answer index out of range"] : []),
      ];
    case "order":
      return c.steps.length < 3 || c.steps.length > 6 ? ["order needs 3 to 6 steps"] : [];
    case "type":
      return c.accept.length === 0 ? ["type needs accepted answers"] : [];
  }
}
