import { describe, it, expect } from "vitest";
import { freshSave, reviewCard, type Save } from "@/lib/save";
import { applyRound, applyFix, missedKeys, FIX_XP } from "@/lib/round";
import { unlockMessage, rightNeeded } from "@/lib/unlock";
import { questsOf } from "@/lib/quests";
import { getWorld, cardKey } from "@/content";

const prompt = getWorld("prompt")!;
const first = prompt.units[0];
const NOW = new Date("2026-11-09T15:00:00");

describe("unlockMessage", () => {
  it("67% says it is under the line and how many right to get over it", () => {
    const m = unlockMessage(prompt, first.id, 4 / 6, 6, false);
    expect(m.kind).toBe("need");
    expect(m.text).toContain("67%");
    expect(m.text).toContain("70%");
    expect(m.text).toContain(prompt.units[1].title);
    expect(m.text).toContain("5 of 6");
  });
  it("rightNeeded rounds up to the first score at or over 70%", () => {
    expect(rightNeeded(8)).toBe(6);
    expect(rightNeeded(10)).toBe(7);
    expect(rightNeeded(6)).toBe(5);
    expect(rightNeeded(1)).toBe(1);
  });
  it("clearing a unit names the one it opens", () => {
    const m = unlockMessage(prompt, first.id, 0.75, 8, false);
    expect(m.kind).toBe("opened");
    expect(m.text).toContain(prompt.units[1].title);
  });
  it("a repeat of an already-cleared unit does not announce an unlock again, even on a bad round", () => {
    expect(unlockMessage(prompt, first.id, 0.5, 8, true).kind).toBe("open-already");
    expect(unlockMessage(prompt, first.id, 1, 8, true).kind).toBe("open-already");
  });
  it("the last unit of a world says so", () => {
    const last = prompt.units[prompt.units.length - 1];
    expect(unlockMessage(prompt, last.id, 0.9, 8, false).kind).toBe("last");
  });
  it("the last unit under the line says what clearing it needs", () => {
    const last = prompt.units[prompt.units.length - 1];
    const m = unlockMessage(prompt, last.id, 0.5, 8, false);
    expect(m.kind).toBe("need");
    expect(m.text).toContain("clears this unit");
    expect(m.text).toContain("6 of 8");
  });
  it("never uses an em or en dash", () => {
    for (const [a, w] of [[0.5, false], [0.8, false], [0.8, true]] as const) expect(unlockMessage(prompt, first.id, a, 8, w).text).not.toMatch(/[–—]/);
  });
});

describe("missedKeys and applyFix", () => {
  const answers = first.cards.slice(0, 5).map((c, i) => ({ key: cardKey(prompt.id, c), correct: i % 2 === 0, review: false }));
  it("lists the wrong cards once each, in the order met", () => {
    expect(missedKeys(answers)).toEqual([answers[1].key, answers[3].key]);
    expect(missedKeys([...answers, answers[1]])).toEqual([answers[1].key, answers[3].key]);
  });
  it("a perfect round misses nothing", () => {
    expect(missedKeys(answers.map((a) => ({ ...a, correct: true })))).toEqual([]);
  });
  const played: Save = applyRound(freshSave(), prompt, first, answers, NOW, 40).save;
  const fixes = missedKeys(answers).map((key) => ({ key, correct: true, review: false }));
  it("a fix pass reviews the cards and pays FIX_XP per right one", () => {
    const f = applyFix(played, "prompt/say-it", fixes, NOW, 12);
    expect(f.correct).toBe(2);
    expect(f.xpGained).toBe(2 * FIX_XP);
    expect(f.save.xp).toBe(played.xp + 2 * FIX_XP);
    for (const a of fixes) expect(f.save.cards[a.key].reps).toBe(played.cards[a.key].reps + 1);
  });
  it("RULE: a fix pass never touches unit progress, days played, tokens or the round quests", () => {
    const f = applyFix(played, "prompt/say-it", fixes, NOW, 12);
    expect(f.save.units).toEqual(played.units);
    expect(f.save.days).toEqual(played.days);
    expect(f.save.tokens).toBe(played.tokens);
    expect(f.save.quests.rounds).toBe(played.quests.rounds);
    expect(questsOf(f.save, NOW).second).toBe(false);
  });
  it("a fix pass appends one fix event and does not mutate the input", () => {
    const before = played.events.length;
    const f = applyFix(played, "prompt/say-it", fixes, NOW, 12);
    expect(f.save.events).toHaveLength(before + 1);
    expect(f.save.events[before]).toMatchObject({ type: "fix", unit: "prompt/say-it", cards: fixes.map((a) => a.key), correct: [true, true], durationMs: 12000 });
    expect(played.events).toHaveLength(before);
  });
  it("it ticks the review quest, so a fix pass clears a review", () => {
    const due: Save = { ...freshSave(), cards: { "cap:x-1": reviewCard(undefined, false, new Date("2026-10-01"), "cap:x-1") } };
    const g = applyRound(due, prompt, first, answers, NOW).save; // an unanswered due card keeps the review quest open
    expect(g.quests.reviewed).toBe(false);
    expect(applyFix(g, "prompt/say-it", fixes, NOW).save.quests.reviewed).toBe(true);
  });
  it("a wrong answer in a fix pass is still recorded, and pays nothing", () => {
    const f = applyFix(played, "prompt/say-it", fixes.map((a) => ({ ...a, correct: false })), NOW);
    expect(f.xpGained).toBe(0);
    expect(f.save.cards[fixes[0].key].lapses).toBeGreaterThanOrEqual(played.cards[fixes[0].key].lapses);
  });
});
