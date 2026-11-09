import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { freshSave, migrate, type Save } from "@/lib/save";
import { buyTheme, equipTheme, spendToken } from "@/lib/shop";
import { THEMES, themeOrDefault } from "@/lib/themes";
import v1 from "./fixtures/v1-save-veteran.json";

const rich = (n: number): Save => ({ ...freshSave(), tokens: n });
const price = (id: string) => THEMES.find((t) => t.id === id)!.price;

describe("buyTheme", () => {
  it("spends the price, owns the theme, appends one buy event", () => {
    const r = buyTheme(rich(20), "blackout");
    expect(r.ok).toBe(true);
    expect(r.save.tokens).toBe(20 - price("blackout"));
    expect(r.save.themes.owned).toContain("blackout");
    const e = r.save.events.at(-1)!;
    expect(e).toMatchObject({ type: "buy", unit: "blackout", cards: [], correct: [], durationMs: 0 });
    expect(e.id.length).toBeGreaterThan(8);
  });
  it("refuses when tokens fall short, says how many more, and changes nothing", () => {
    const s = rich(price("redline") - 3);
    const r = buyTheme(s, "redline");
    expect(r).toMatchObject({ ok: false, reason: "notEnough", need: 3 });
    expect(r.save).toBe(s);
  });
  it("a repeat buy is a no-op that costs nothing", () => {
    const once = buyTheme(rich(30), "blackout").save;
    const again = buyTheme(once, "blackout");
    expect(again).toMatchObject({ ok: false, reason: "owned" });
    expect(again.save.tokens).toBe(once.tokens);
    expect(again.save.events.length).toBe(once.events.length);
  });
  it("Notebook is always owned and an unknown id is refused", () => {
    expect(buyTheme(rich(99), "notebook")).toMatchObject({ ok: false, reason: "owned" });
    expect(buyTheme(rich(99), "nope")).toMatchObject({ ok: false, reason: "unknown" });
  });
  it("an exact-price buy leaves zero, never below", () => {
    expect(buyTheme(rich(price("blackout")), "blackout").save.tokens).toBe(0);
  });
});

describe("equipTheme", () => {
  it("needs ownership", () => {
    const s = rich(50);
    expect(equipTheme(s, "blackout")).toMatchObject({ ok: false, reason: "notOwned" });
    expect(equipTheme(s, "nope")).toMatchObject({ ok: false, reason: "unknown" });
  });
  it("equips an owned theme with one equip event, and re-equipping adds none", () => {
    const owned = buyTheme(rich(50), "ultraviolet").save;
    const r = equipTheme(owned, "ultraviolet");
    expect(r.ok && r.save.themes.equipped).toBe("ultraviolet");
    expect(r.save.events.at(-1)).toMatchObject({ type: "equip", unit: "ultraviolet", cards: [], correct: [] });
    const again = equipTheme(r.save, "ultraviolet");
    expect(again.save.events.length).toBe(r.save.events.length);
  });
});

describe("spendToken", () => {
  it("spends one and refuses at zero", () => {
    expect(spendToken(rich(2)).save.tokens).toBe(1);
    const z = rich(0);
    expect(spendToken(z)).toEqual({ ok: false, save: z });
  });
});

describe("tokens never go negative", () => {
  it("over a thousand random shop sequences", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    let s = rich(5);
    for (let i = 0; i < 1000; i++) {
      const roll = rnd();
      const id = THEMES[Math.floor(rnd() * THEMES.length)].id;
      if (roll < 0.35) s = buyTheme(s, id).save;
      else if (roll < 0.6) s = equipTheme(s, id).save;
      else if (roll < 0.85) s = spendToken(s).save;
      else s = { ...s, tokens: s.tokens + Math.floor(rnd() * 4) };
      expect(s.tokens).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s.tokens)).toBe(true);
      expect(s.themes.owned).toContain(s.themes.equipped);
    }
  });
});

describe("save migration of themes", () => {
  it("a v2 save with no themes gets Notebook", () => {
    const old = { ...freshSave() } as Record<string, unknown>;
    delete old.themes;
    expect(migrate(old).themes).toEqual({ owned: ["notebook"], equipped: "notebook" });
  });
  it("a v1 save gets Notebook and keeps its tokens", () => {
    const out = migrate(v1);
    expect(out.themes).toEqual({ owned: ["notebook"], equipped: "notebook" });
    expect(out.tokens).toBe((v1 as { tokens: number }).tokens);
  });
  it("unknown ids are dropped, an unowned equipped id falls back, owned order follows the catalogue", () => {
    const s = migrate({ ...freshSave(), themes: { owned: ["ghost", "redline", "blackout"], equipped: "ultraviolet" } });
    expect(s.themes).toEqual({ owned: ["notebook", "blackout", "redline"], equipped: "notebook" });
    expect(migrate({ ...freshSave(), themes: "junk" }).themes.equipped).toBe("notebook");
  });
  it("buy and equip events survive a round trip through migrate", () => {
    const bought = buyTheme(rich(20), "blackout").save;
    const eq = equipTheme(bought, "blackout").save;
    const back = migrate(JSON.parse(JSON.stringify(eq)));
    expect(back.events.map((e) => e.type)).toEqual(["buy", "equip"]);
    expect(back.themes.equipped).toBe("blackout");
  });
  it("themeOrDefault falls back to Notebook", () => {
    expect(themeOrDefault("zzz").id).toBe("notebook");
    expect(themeOrDefault(undefined).id).toBe("notebook");
  });
});

describe("the game's copy of the catalogue", () => {
  it("matches themes.ts on ids, grounds, inks, accents and outfits", () => {
    const req = createRequire(import.meta.url);
    const game = req("../../public/arcade/pop/src/theme.js").WP_THEMES as { id: string; ground: string; ink: string; accent: string; wear: string[] }[];
    expect(game.map((g) => ({ id: g.id, ground: g.ground, ink: g.ink, accent: g.accent, wear: g.wear })))
      .toEqual(THEMES.map((t) => ({ id: t.id, ground: t.ground, ink: t.ink, accent: t.accent, wear: t.wear })));
  });
  it("every theme starts with the headband and no ground is a banned colour", () => {
    for (const t of THEMES) {
      expect(t.wear[0]).toBe("hero");
      expect(t.ground).not.toMatch(/^#(f7f1e7|faf6ef|f8f2e5|f4f3e7|f6f1e4|fdfbf7)$/i);
    }
  });
});
