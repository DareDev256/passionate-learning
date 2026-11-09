// Save v2 and the one-time v1 migration.
// v1-save-veteran.json is a REAL v1 save: it was produced by running the Phase 1 code (v2-app-store 0a62e3a, `buildRound` and
// `applyRound`) over six rounds on five days across three worlds, with a fixed clock. It is checked in as data, not regenerated.
import { describe, it, expect, beforeEach, vi } from "vitest";
import v1 from "./fixtures/v1-save-veteran.json";
import { freshSave, migrate, importCap, loadSave, writeSave, reviewCard, SAVE_KEY, LEGACY_KEY, BACKUP_KEY, PRESERVED_KEY, type Save } from "@/lib/save";
import { applyRound } from "@/lib/round";
import { getWorld, cardKey } from "@/content";

function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

const NOW = new Date("2026-11-09T15:00:00");

describe("migrate: a real v1 save", () => {
  const out = migrate(v1);
  it("is a v2 save", () => { expect(out.v).toBe(2); });
  it("keeps xp, days, tokens and settings exactly", () => {
    expect(out.xp).toBe(v1.xp);
    expect(out.xp).toBeGreaterThan(0);
    expect(out.days).toEqual(v1.days);
    expect(out.tokens).toBe(v1.tokens);
    expect(out.settings).toEqual(v1.settings);
  });
  it("keeps every card memory and every unit", () => {
    expect(Object.keys(out.cards).length).toBe(Object.keys(v1.cards).length);
    expect(Object.keys(out.cards).length).toBeGreaterThan(10);
    expect(out.cards).toEqual(v1.cards);
    expect(out.units).toEqual(v1.units);
  });
  it("imports the XP once, capped, flagged unverified", () => {
    expect(out.imported).toEqual({ xp: v1.xp, cap: importCap(out), unverified: true });
    expect(out.imported!.cap).toBeGreaterThanOrEqual(out.imported!.xp); // an honest save is never over its own cap
    expect(out.events).toEqual([]);
    expect(out.flushed).toBe(0);
  });
  it("is not asked the first-launch question again", () => {
    expect(out.profile).toEqual({ goal: null, onboarded: true });
  });
  it("is stable: migrating the result again changes nothing", () => {
    expect(migrate(out)).toEqual(out);
  });
});

describe("migrate: odd inputs", () => {
  it("a bare {v:1} becomes a valid fresh-looking v2 and still gets onboarding", () => {
    const s = migrate({ v: 1 });
    expect(s).toEqual({ ...freshSave(), quests: s.quests });
    expect(s.profile.onboarded).toBe(false);
    expect(s.imported).toBeNull();
  });
  it("junk, null and unknown versions give a fresh save", () => {
    for (const bad of [null, undefined, 4, "x", [], { v: 3 }, { xp: 10 }]) expect(migrate(bad)).toEqual(freshSave());
  });
  it("a v1 save with only settings (the layout test seed) survives", () => {
    expect(migrate({ v: 1, settings: { motion: "reduce" } }).settings.motion).toBe("reduce");
  });
  it("drops malformed events but keeps good ones, and clamps flushed", () => {
    const good = { id: "a", type: "round", unit: "prompt/say-it", cards: ["prompt:pd-001"], correct: [true], durationMs: 1000, clientTs: 5 };
    const s = migrate({ v: 2, events: [good, { ...good, id: 7 }, { ...good, correct: [true, false] }, { ...good, type: "x" }, "no"], flushed: 99 });
    expect(s.events).toEqual([good]);
    expect(s.flushed).toBe(1);
  });
  it("a v2 save with a bad goal falls back to none", () => {
    expect(migrate({ v: 2, profile: { goal: "hack", onboarded: true } }).profile).toEqual({ goal: null, onboarded: true });
  });
  it("yesterday's v1 quest does not carry to today, today's does", () => {
    expect(migrate({ v: 1, quest: { date: "2020-01-01", round: true, review: true, perfect: true } }).quests.rounds).toBe(0);
    const t = freshSave().quests.date;
    expect(migrate({ v: 1, quest: { date: t, round: true, review: true, perfect: false } }).quests).toEqual({ date: t, rounds: 1, reviewed: true, chest: false });
  });
});

describe("migrate: damaged card memory and units", () => {
  const cardWith = (over: Record<string, unknown>) => migrate({ v: 1, cards: { "prompt:pd-001": { due: "2026-11-08T00:00:00.000Z", state: 2, reps: 2, seen: 5, correct: 3, ...over } } }).cards["prompt:pd-001"];
  it("a memory with no stability or difficulty becomes a new card, keeping seen and correct, and the scheduler accepts it", () => {
    const c = cardWith({});
    expect(c).toMatchObject({ state: 0, stability: 0, difficulty: 0, reps: 0, seen: 5, correct: 3 });
    expect(() => reviewCard(c, true, NOW, "prompt:pd-001")).not.toThrow();
  });
  it("a bad last_review is dropped and the card still schedules", () => {
    const c = cardWith({ stability: 3, difficulty: 5, last_review: "banana" });
    expect(c.last_review).toBeUndefined();
    expect(() => reviewCard(c, false, NOW, "k")).not.toThrow();
  });
  it("seen as a string cannot turn into concatenation, and correct never exceeds seen", () => {
    const c = cardWith({ seen: "5", correct: 9, stability: 1, difficulty: 5 });
    expect(c.seen).toBe(0);
    expect(c.correct).toBe(0);
  });
  it("an out-of-range state is not trusted", () => {
    expect(cardWith({ stability: 1, difficulty: 5, state: 9 }).state).toBe(0);
  });
  it("a card with no usable due date is dropped, not guessed", () => {
    expect(migrate({ v: 1, cards: { "a:b": { due: "nope", seen: 3 } } }).cards).toEqual({});
  });
  it("a unit with no last array keeps its best and rounds; out-of-range values are clamped", () => {
    expect(migrate({ v: 1, units: { "a/b": { best: 1, rounds: 3 } } }).units["a/b"]).toEqual({ last: [], best: 1, rounds: 3 });
    expect(migrate({ v: 1, units: { "a/b": { last: [0.5], best: 7, rounds: -2 } } }).units["a/b"]).toEqual({ last: [0.5], best: 1, rounds: 0 });
  });
});

describe("loadSave", () => {
  let store: Map<string, string>;
  beforeEach(() => { store = installStorage(); });

  it("migrates a v1 key once: writes v2, keeps the payload as a backup, removes the old key", () => {
    const raw = JSON.stringify(v1);
    store.set(LEGACY_KEY, raw);
    const s = loadSave(NOW);
    expect(s.v).toBe(2);
    expect(s.xp).toBe(v1.xp);
    expect(JSON.parse(store.get(SAVE_KEY)!).v).toBe(2);
    expect(store.get(BACKUP_KEY)).toBe(raw);
    expect(store.has(LEGACY_KEY)).toBe(false);
  });
  it("loading twice gives the same save and does not re-import", () => {
    store.set(LEGACY_KEY, JSON.stringify(v1));
    const a = loadSave(NOW);
    const b = loadSave(NOW);
    expect(b).toEqual(a);
    expect(b.imported).toEqual(a.imported);
  });
  it("GUARD: an existing v2 save is never replaced by a v1 one", () => {
    const mine: Save = { ...freshSave(), xp: 999, profile: { goal: "work", onboarded: true } };
    store.set(SAVE_KEY, JSON.stringify(mine));
    store.set(LEGACY_KEY, JSON.stringify(v1));
    const s = loadSave(NOW);
    expect(s.xp).toBe(999);
    expect(s.imported).toBeNull();
    expect(store.get(LEGACY_KEY)).toBe(JSON.stringify(v1)); // and the old key is left alone
  });
  it("a corrupt v2 key with a v1 backup recovers from the backup", () => {
    store.set(SAVE_KEY, "{not json");
    store.set(BACKUP_KEY, JSON.stringify(v1));
    expect(loadSave(NOW).xp).toBe(v1.xp);
  });
  it("an unreadable or newer-version v2 key is preserved before anything overwrites it", () => {
    store.set(SAVE_KEY, JSON.stringify({ v: 3, xp: 5000 }));
    store.set(BACKUP_KEY, JSON.stringify(v1));
    loadSave(NOW);
    expect(JSON.parse(store.get(PRESERVED_KEY)!)).toEqual({ v: 3, xp: 5000 });
  });
  it("an existing backup is never overwritten by a later v1 key", () => {
    store.set(BACKUP_KEY, "first");
    store.set(LEGACY_KEY, JSON.stringify({ ...v1, xp: 1 }));
    loadSave(NOW);
    expect(store.get(BACKUP_KEY)).toBe("first");
    expect(store.has(LEGACY_KEY)).toBe(true);
  });
  it("a corrupt v2 key and nothing else gives a fresh save, not a crash", () => {
    store.set(SAVE_KEY, "{not json");
    expect(loadSave(NOW).xp).toBe(0);
  });
  it("a corrupt v1 key gives a fresh save and leaves the key for a human to find", () => {
    store.set(LEGACY_KEY, "{nope");
    expect(loadSave(NOW).xp).toBe(0);
    expect(store.get(LEGACY_KEY)).toBe("{nope");
  });
  it("if the v2 write fails the v1 data is kept, so the next launch can try again", () => {
    store.set(LEGACY_KEY, JSON.stringify(v1));
    const real = localStorage.setItem;
    (localStorage as Storage).setItem = () => { throw new Error("quota"); };
    const s = loadSave(NOW);
    (localStorage as Storage).setItem = real;
    expect(s.xp).toBe(v1.xp);
    expect(store.has(LEGACY_KEY)).toBe(true);
  });
  it("nothing stored gives a fresh save", () => {
    expect(loadSave(NOW)).toEqual({ ...freshSave(), quests: loadSave(NOW).quests });
  });
  it("writeSave then loadSave round-trips", () => {
    const s: Save = { ...migrate(v1), quests: { date: "2026-11-09", rounds: 1, reviewed: true, chest: false } };
    writeSave(s);
    expect(loadSave(NOW)).toEqual(s);
  });
});

describe("the event log", () => {
  const world = getWorld("prompt")!;
  const unit = world.units[0];
  it("applyRound appends exactly one round event that lines up with the answers", () => {
    const answers = unit.cards.slice(0, 4).map((c, i) => ({ key: cardKey(world.id, c), correct: i !== 1, review: false }));
    const before = freshSave();
    const r = applyRound(before, world, unit, answers, NOW, 41.2);
    expect(r.save.events).toHaveLength(1);
    const e = r.save.events[0];
    expect(e).toMatchObject({ type: "round", unit: "prompt/say-it", cards: answers.map((a) => a.key), correct: [true, false, true, true], durationMs: 41200, clientTs: NOW.getTime() });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(before.events).toHaveLength(0); // the input save is not mutated
  });
  it("events only ever append", () => {
    const answers = unit.cards.slice(0, 2).map((c) => ({ key: cardKey(world.id, c), correct: true, review: false }));
    const r1 = applyRound(freshSave(), world, unit, answers, NOW);
    const r2 = applyRound(r1.save, world, unit, answers, NOW);
    expect(r2.save.events).toHaveLength(2);
    expect(r2.save.events[0]).toEqual(r1.save.events[0]);
    expect(r2.save.events[0].id).not.toBe(r2.save.events[1].id);
  });
  it("a veteran's next round lands on top of their imported XP", () => {
    const vet = migrate(v1);
    const answers = unit.cards.slice(0, 3).map((c) => ({ key: cardKey(world.id, c), correct: true, review: false }));
    const r = applyRound(vet, world, unit, answers, NOW);
    expect(r.save.xp).toBe(vet.xp + r.xpGained);
    expect(r.save.imported).toEqual(vet.imported);
  });
});

describe("forgetLegacy", () => {
  it("removes the backup so a reset cannot be undone by the next load", async () => {
    const store = installStorage();
    const { forgetLegacy } = await import("@/lib/save");
    store.set(BACKUP_KEY, JSON.stringify(v1));
    store.set(LEGACY_KEY, JSON.stringify(v1));
    forgetLegacy();
    expect(store.size).toBe(0);
  });
});
