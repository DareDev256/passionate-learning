import { describe, it, expect } from "vitest";
import v1 from "./fixtures/v1-save-veteran.json";
import { freshSave, migrate, type Save } from "@/lib/save";
import { achievementsOf } from "@/lib/achievements";
import { worldAccuracy, totals } from "@/lib/stats";
import { liveWorlds } from "@/content";

const earned = (s: Save) => achievementsOf(s).filter((a) => a.earned).map((a) => a.id);

describe("worldAccuracy", () => {
  it("a fresh save has nothing answered anywhere, and reads null rather than 0%", () => {
    const rows = worldAccuracy(freshSave());
    expect(rows).toHaveLength(liveWorlds().length);
    for (const r of rows) expect(r).toMatchObject({ seen: 0, correct: 0, accuracy: null });
  });
  it("sums seen and correct per world from card memory, and ignores other worlds", () => {
    const s = migrate(v1);
    const rows = Object.fromEntries(worldAccuracy(s).map((r) => [r.world.id, r]));
    const expectFor = (id: string) => Object.entries(s.cards).filter(([k]) => k.startsWith(`${id}:`)).reduce((a, [, m]) => ({ seen: a.seen + m.seen, correct: a.correct + m.correct }), { seen: 0, correct: 0 });
    for (const id of ["prompt", "token", "cap"]) {
      const e = expectFor(id);
      expect(e.seen).toBeGreaterThan(0);
      expect(rows[id].seen).toBe(e.seen);
      expect(rows[id].accuracy).toBeCloseTo(e.correct / e.seen, 10);
    }
    expect(rows.circuit.accuracy).toBeNull();
  });
});

describe("totals", () => {
  it("a veteran's rounds, cards and days come from the imported save", () => {
    const t = totals(migrate(v1));
    expect(t.rounds).toBe(Object.values(v1.units).reduce((n, u) => n + u.rounds, 0));
    expect(t.days).toBe(v1.days.length);
    expect(t.cardsLearned).toBe(Object.keys(v1.cards).length);
    expect(t.accuracy).toBeGreaterThan(0);
  });
});

describe("achievements", () => {
  it("a fresh save earns none and every badge says how to earn it", () => {
    expect(earned(freshSave())).toEqual([]);
    for (const a of achievementsOf(freshSave())) { expect(a.how.length).toBeGreaterThan(10); expect(`${a.label} ${a.how}`).not.toMatch(/[–—]/); }
  });
  it("a migrated v1 save earns what it already did, from units and cards, not events", () => {
    const s = migrate(v1);
    expect(s.events).toEqual([]);
    expect(earned(s)).toEqual(expect.arrayContaining(["first-round", "perfect", "days-3", "rank-d"]));
    expect(earned(s)).not.toContain("fixer");
    expect(earned(s)).not.toContain("rank-s");
  });
  it("a fix event earns Put it right", () => {
    const s: Save = { ...freshSave(), events: [{ id: "x", type: "fix", unit: "prompt/say-it", cards: ["prompt:pd-001"], correct: [true], durationMs: 1, clientTs: 1 }] };
    expect(earned(s)).toContain("fixer");
  });
  it("days badges follow days played and never go away", () => {
    const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    expect(earned({ ...freshSave(), days: days(2) })).not.toContain("days-3");
    expect(earned({ ...freshSave(), days: days(3) })).toContain("days-3");
    expect(earned({ ...freshSave(), days: days(30) })).toEqual(expect.arrayContaining(["days-3", "days-7", "days-30"]));
  });
  it("ranks follow XP", () => {
    expect(earned({ ...freshSave(), xp: 149 })).not.toContain("rank-d");
    expect(earned({ ...freshSave(), xp: 1000 })).toEqual(expect.arrayContaining(["rank-d", "rank-b"]));
  });
  it("clearing every unit of a world earns World cleared", () => {
    const w = liveWorlds()[0];
    const s = freshSave();
    for (const u of w.units) s.units[`${w.id}/${u.id}`] = { last: [0.8], best: 0.8, rounds: 1 };
    expect(earned(s)).toContain("world");
  });
});
