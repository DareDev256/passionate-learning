import { describe, it, expect } from "vitest";
import { dueLabel } from "@/lib/due";
import { reviewCard, freshSave, type CardMemory } from "@/lib/save";
import { applyRound } from "@/lib/round";
import { getWorld, cardKey } from "@/content";

const NOW = new Date("2026-11-09T15:00:00"); // a Monday

describe("dueLabel", () => {
  it("today or earlier is the next round", () => {
    expect(dueLabel(new Date("2026-11-09T23:00:00"), NOW)).toBe("in your next round");
    expect(dueLabel(new Date("2026-11-01T10:00:00"), NOW)).toBe("in your next round");
  });
  it("tomorrow", () => { expect(dueLabel(new Date("2026-11-10T00:30:00"), NOW)).toBe("tomorrow"); });
  it("two to six days is the weekday", () => {
    expect(dueLabel(new Date("2026-11-12T09:00:00"), NOW)).toBe("on Thursday");
    expect(dueLabel(new Date("2026-11-15T09:00:00"), NOW)).toBe("on Sunday");
  });
  it("a week or more is a date", () => {
    expect(dueLabel(new Date("2026-11-16T09:00:00"), NOW)).toBe("on Nov 16");
    expect(dueLabel(new Date("2026-12-24T09:00:00"), NOW)).toBe("on Dec 24");
  });
  it("uses calendar days, not 24-hour blocks", () => {
    expect(dueLabel(new Date("2026-11-10T01:00:00"), new Date("2026-11-09T23:59:00"))).toBe("tomorrow");
  });
});

describe("what the drawer says is what gets stored", () => {
  const world = getWorld("prompt")!;
  const unit = world.units[0];
  const key = cardKey(world.id, unit.cards[0]);
  // A card learned 10 days ago and now missed: the lapse interval is fuzzed, so this is the case that could disagree.
  const old: CardMemory = reviewCard(reviewCard(undefined, true, new Date("2026-10-20T10:00:00"), key), true, new Date("2026-10-30T10:00:00"), key);
  it("a miss on a fresh card is due tomorrow", () => {
    expect(dueLabel(new Date(reviewCard(undefined, false, NOW, key).due), NOW)).toBe("tomorrow");
  });
  it("the drawer's preview and the saved date give the same label, even a few seconds later", () => {
    const preview = dueLabel(new Date(reviewCard(old, false, NOW, key).due), NOW);
    const later = new Date(NOW.getTime() + 25000);
    const save = { ...freshSave(), cards: { [key]: old } };
    const stored = applyRound(save, world, unit, [{ key, correct: false, review: false }], later).save.cards[key].due;
    expect(dueLabel(new Date(stored), later)).toBe(preview);
    expect(preview).not.toBe("in your next round");
  });
});
