import { describe, it, expect } from "vitest";
import { freshSave, reviewCard, type Save } from "@/lib/save";
import { applyRound } from "@/lib/round";
import { questsOf, openChest, CHEST_TOKENS } from "@/lib/quests";
import { getWorld, cardKey } from "@/content";

const world = getWorld("prompt")!;
const unit = world.units[0];
const right = unit.cards.slice(0, 4).map((c) => ({ key: cardKey(world.id, c), correct: true, review: false }));
const T = (h: number) => new Date(`2026-11-09T${String(h).padStart(2, "0")}:00:00`);

describe("quests", () => {
  it("a fresh save has nothing done", () => {
    expect(questsOf(freshSave(), T(9))).toMatchObject({ round: false, review: false, second: false, done: 0, allDone: false, chestOpened: false });
  });
  it("one round is a whole day: it ticks round, and review too when nothing was due", () => {
    const s = applyRound(freshSave(), world, unit, right, T(9)).save;
    expect(questsOf(s, T(9))).toMatchObject({ round: true, review: true, second: false, done: 2 });
  });
  it("with a card due, the review quest waits for a review answer", () => {
    const other = getWorld("cap")!;
    const k = cardKey(other.id, other.units[0].cards[0]);
    const due: Save = { ...freshSave(), cards: { [k]: reviewCard(undefined, false, new Date("2026-10-01T10:00:00"), k) } };
    const noReview = applyRound(due, world, unit, right, T(9));
    expect(questsOf(noReview.save, T(9)).review).toBe(false);
    const withReview = applyRound(due, world, unit, [...right, { key: k, correct: true, review: true }], T(9));
    expect(questsOf(withReview.save, T(9)).review).toBe(true);
    expect(withReview.questDone.review).toBe(true);
  });
  it("a second round ticks the third quest and all three open the chest", () => {
    const r1 = applyRound(freshSave(), world, unit, right, T(9));
    const r2 = applyRound(r1.save, world, unit, right, T(10));
    expect(r2.questDone).toEqual({ round: false, review: false, second: true });
    expect(questsOf(r2.save, T(10)).allDone).toBe(true);
  });
  it("the chest stays shut until all three are done", () => {
    const s = applyRound(freshSave(), world, unit, right, T(9)).save;
    expect(openChest(s, T(9))).toBe(s);
  });
  it("the chest pays exactly CHEST_TOKENS, once", () => {
    const s = applyRound(applyRound(freshSave(), world, unit, right, T(9)).save, world, unit, right, T(10)).save;
    const opened = openChest(s, T(10));
    expect(opened.tokens).toBe(s.tokens + CHEST_TOKENS);
    expect(questsOf(opened, T(10)).chestOpened).toBe(true);
    expect(openChest(opened, T(11)).tokens).toBe(opened.tokens);
  });
  it("a new day brings new quests and a closed chest; XP, days and tokens stay", () => {
    const s = openChest(applyRound(applyRound(freshSave(), world, unit, right, T(9)).save, world, unit, right, T(10)).save, T(10));
    const tomorrow = new Date("2026-11-10T08:00:00");
    expect(questsOf(s, tomorrow)).toMatchObject({ done: 0, chestOpened: false });
    expect(openChest(s, tomorrow)).toBe(s); // nothing done yet today, so nothing to open
    expect(s.xp).toBeGreaterThan(0);
  });
  it("yesterday's finished quests do not count today even before a round", () => {
    const s = applyRound(freshSave(), world, unit, right, T(9)).save;
    expect(questsOf(s, new Date("2026-11-11T09:00:00")).done).toBe(0);
  });
});
