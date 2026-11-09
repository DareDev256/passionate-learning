import { describe, it, expect, beforeEach, vi } from "vitest";
import { isNative, haptic } from "@/lib/native";
import { WORLDS, getWorld, cardKey } from "@/content";
import { validateWorlds } from "@/content/validate";
import type { World } from "@/content/types";
import { freshSave, migrate, rankOf, recallMultiplier, reviewCard, isMastered, isCleared, dueKeys, rollQuest, motionClass } from "@/lib/save";
import { isUnitOpen, blockingUnit, unitIndex } from "@/lib/unlock";
import { RESUME_KEY, RESUME_MAX_MS, saveInProgress, loadInProgress, peekInProgress, clearInProgress, type InProgress } from "@/lib/roundResume";
import { buildRound, grade, applyRound, shuffle } from "@/lib/round";

const cap = vi.hoisted(() => ({
  native: false,
  impact: vi.fn(),
  notification: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => cap.native } }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact: cap.impact, notification: cap.notification },
  ImpactStyle: { Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS", Error: "ERROR" },
}));

describe("native seam", () => {
  beforeEach(() => { cap.native = false; cap.impact.mockReset(); cap.notification.mockReset(); });
  it("isNative follows the Capacitor platform", () => {
    expect(isNative()).toBe(false);
    cap.native = true;
    expect(isNative()).toBe(true);
  });
  it("never touches the plugin when haptics are off", async () => {
    cap.native = true;
    await haptic("success", false);
    expect(cap.notification).not.toHaveBeenCalled();
    expect(cap.impact).not.toHaveBeenCalled();
  });
  it("resolves without calling the plugin on web", async () => {
    await expect(haptic("error", true)).resolves.toBeUndefined();
    expect(cap.notification).not.toHaveBeenCalled();
    expect(cap.impact).not.toHaveBeenCalled();
  });
  it("native error and success use the notification types", async () => {
    cap.native = true;
    await haptic("error", true);
    expect(cap.notification).toHaveBeenCalledWith({ type: "ERROR" });
    await haptic("success", true);
    expect(cap.notification).toHaveBeenLastCalledWith({ type: "SUCCESS" });
  });
  it("native tap is a light impact", async () => {
    cap.native = true;
    await haptic("tap", true);
    expect(cap.impact).toHaveBeenCalledWith({ style: "LIGHT" });
    expect(cap.notification).not.toHaveBeenCalled();
  });
  it("swallows a rejected plugin call", async () => {
    cap.native = true;
    cap.notification.mockRejectedValue(new Error("no taptic engine"));
    await expect(haptic("success", true)).resolves.toBeUndefined();
  });
});

describe("content", () => {
  it("the shipped catalogue is valid", () => {
    expect(validateWorlds(WORLDS)).toEqual([]);
  });
  it("has at least four live worlds", () => {
    expect(WORLDS.filter((w) => w.status === "live").length).toBeGreaterThanOrEqual(4);
  });
  it("the validator catches a broken card (mutation check)", () => {
    const broken: World = JSON.parse(JSON.stringify(getWorld("prompt")));
    const c = broken.units[0].cards[0];
    if (c.type === "choice") c.answer = 9;
    broken.units[0].cards[1].why = "";
    broken.units[0].cards[2].id = broken.units[0].cards[3].id;
    const errs = validateWorlds([broken]);
    expect(errs.some((e) => e.includes("answer index out of range"))).toBe(true);
    expect(errs.some((e) => e.includes('real "why"'))).toBe(true);
    expect(errs.some((e) => e.includes("duplicate card id"))).toBe(true);
  });
  it("card keys are unique across every world", () => {
    const keys = WORLDS.flatMap((w) => w.units.flatMap((u) => u.cards.map((c) => cardKey(w.id, c))));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("settings", () => {
  it("fills missing settings with defaults", () => {
    expect(migrate({ v: 1, settings: { sound: false } }).settings).toEqual({ sound: false, haptics: true, motion: "system", name: "" });
  });
  it("rejects malformed haptics and motion", () => {
    const st = migrate({ v: 1, settings: { haptics: "yes", motion: "wild" } }).settings;
    expect(st.haptics).toBe(true);
    expect(st.motion).toBe("system");
  });
  it("keeps valid values and a fresh save is system motion", () => {
    expect(migrate({ v: 1, settings: { haptics: false, motion: "reduce" } }).settings).toMatchObject({ haptics: false, motion: "reduce" });
    expect(freshSave().settings.motion).toBe("system");
    expect(motionClass("reduce")).toBe("reduce-motion");
    expect(motionClass("full")).toBe("");
  });
});

describe("grading", () => {
  const w = getWorld("token")!;
  const predict = w.units[0].cards.find((c) => c.type === "predict")!;
  it("predict: the highest-probability token is correct", () => {
    if (predict.type !== "predict") throw new Error();
    const top = predict.options.reduce((b, o, i) => (o.p > predict.options[b].p ? i : b), 0);
    expect(grade(predict, { type: "predict", index: top })).toBe(true);
    expect(grade(predict, { type: "predict", index: (top + 1) % predict.options.length })).toBe(false);
  });
  it("type: case and punctuation do not matter", () => {
    const t = w.units[0].cards.find((c) => c.type === "type")!;
    expect(grade(t, { type: "type", text: "  LANGUAGE! " })).toBe(true);
    expect(grade(t, { type: "type", text: "lang" })).toBe(false);
  });
  it("order: only the exact order passes", () => {
    const o = w.units[1].cards.find((c) => c.type === "order")!;
    if (o.type !== "order") throw new Error();
    expect(grade(o, { type: "order", order: [...o.steps] })).toBe(true);
    expect(grade(o, { type: "order", order: [...o.steps].reverse() })).toBe(false);
  });
  it("a response of the wrong type never passes", () => {
    expect(grade(predict, { type: "choice", index: 0 })).toBe(false);
  });
});

describe("save", () => {
  it("migrate turns garbage into a fresh save", () => {
    expect(migrate(null)).toEqual(freshSave());
    expect(migrate({ v: 1, xp: -50, days: ["nope", "2026-10-03"], tokens: "x" }).xp).toBe(0);
    expect(migrate({ v: 1, days: ["nope", "2026-10-03", "2026-10-03"] }).days).toEqual(["2026-10-03"]);
    expect(migrate({ v: 1, cards: { "__proto__:x": { due: "z" } } }).cards).toEqual({});
  });
  it("ranks climb E to S", () => {
    expect(rankOf(0).rank).toBe("E");
    expect(rankOf(149).rank).toBe("E");
    expect(rankOf(150).rank).toBe("D");
    expect(rankOf(4000)).toEqual({ rank: "S", floor: 4000, next: null });
  });
  it("recall bonus: 1x fresh, 2x after 7 days, 3x after 30", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const m = reviewCard(undefined, true, now);
    expect(recallMultiplier(m, now)).toBe(1);
    expect(recallMultiplier(m, new Date("2026-10-11T12:00:00Z"))).toBe(2);
    expect(recallMultiplier(m, new Date("2026-11-05T12:00:00Z"))).toBe(3);
  });
  it("mastery needs 90% over the last three rounds; unlock needs one 70% round", () => {
    expect(isMastered({ last: [1, 1], best: 1, rounds: 2 })).toBe(false);
    expect(isMastered({ last: [0.9, 1, 0.9], best: 1, rounds: 3 })).toBe(true);
    expect(isCleared({ last: [0.6], best: 0.6, rounds: 1 })).toBe(false);
    expect(isCleared({ last: [0.7], best: 0.7, rounds: 1 })).toBe(true);
  });
  it("a new day rolls a new daily quest", () => {
    const s = { ...freshSave(), quests: { date: "2026-10-01", rounds: 2, reviewed: true, chest: true } };
    expect(rollQuest(s, new Date("2026-10-03T15:00:00")).quests).toEqual({ date: "2026-10-03", rounds: 0, reviewed: false, chest: false });
  });
});

describe("rounds", () => {
  const world = getWorld("prompt")!;
  const unit = world.units[0];
  it("a round is 8 cards or fewer and stable for a seed", () => {
    const a = buildRound(world, unit, freshSave(), 42);
    const b = buildRound(world, unit, freshSave(), 42);
    expect(a.length).toBeLessThanOrEqual(8);
    expect(a.map((c) => c.key)).toEqual(b.map((c) => c.key));
  });
  it("due cards from other worlds join as reviews", () => {
    let s = freshSave();
    const other = getWorld("cap")!;
    const key = cardKey(other.id, other.units[0].cards[0]);
    s = { ...s, cards: { [key]: reviewCard(undefined, false, new Date("2026-09-01")) } };
    const round = buildRound(world, unit, s, 1);
    expect(round.some((c) => c.key === key && c.review)).toBe(true);
    expect(dueKeys(s).includes(key)).toBe(true);
  });
  it("applyRound: perfect round gives bonus XP, a day, tokens, and the quest", () => {
    const answers = unit.cards.map((c) => ({ key: cardKey(world.id, c), correct: true, review: false }));
    const r = applyRound(freshSave(), world, unit, answers, new Date("2026-10-03T15:00:00"));
    expect(r.accuracy).toBe(1);
    expect(r.xpGained).toBe(answers.length * 10 + 20);
    expect(r.save.days).toEqual(["2026-10-03"]);
    expect(r.tokensGained).toBe(2);
    expect(r.questDone).toEqual({ round: true, review: true, second: false }); // nothing was due, so the review quest is waived
    expect(r.firstOfDay).toBe(true);
  });
  it("speed bonus: under 60s with half right pays 15 XP; slow or sloppy pays nothing extra", () => {
    const answers = unit.cards.map((c, i) => ({ key: cardKey(world.id, c), correct: i % 2 === 0, review: false }));
    const fast = applyRound(freshSave(), world, unit, answers, new Date("2026-10-03T15:00:00"), 41);
    const slow = applyRound(freshSave(), world, unit, answers, new Date("2026-10-03T15:00:00"), 75);
    expect(fast.speedBonus).toBe(15);
    expect(slow.speedBonus).toBe(0);
    expect(fast.xpGained - slow.xpGained).toBe(15);
    const sloppy = unit.cards.map((c) => ({ key: cardKey(world.id, c), correct: false, review: false }));
    expect(applyRound(freshSave(), world, unit, sloppy, new Date(), 20).speedBonus).toBe(0);
  });
  it("missing a day resets nothing", () => {
    const answers = unit.cards.map((c) => ({ key: cardKey(world.id, c), correct: true, review: false }));
    const r1 = applyRound(freshSave(), world, unit, answers, new Date("2026-10-01T15:00:00"));
    const r2 = applyRound(r1.save, world, unit, answers, new Date("2026-10-05T15:00:00"));
    expect(r2.save.days).toEqual(["2026-10-01", "2026-10-05"]);
    expect(r2.save.xp).toBeGreaterThan(r1.save.xp);
  });
  it("shuffle keeps every item", () => {
    expect(shuffle([1, 2, 3, 4, 5], 7).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("unit lock", () => {
  const prompt = getWorld("prompt")!;
  const [first, second] = prompt.units;
  it("the first unit is always open", () => {
    expect(unitIndex(prompt, first.id)).toBe(0);
    expect(isUnitOpen(prompt, first.id, freshSave())).toBe(true);
  });
  it("the second unit is locked on a fresh save", () => {
    expect(isUnitOpen(prompt, second.id, freshSave())).toBe(false);
  });
  it("clearing the first unit opens the second", () => {
    const s = freshSave();
    s.units["prompt/say-it"] = { last: [0.7], best: 0.7, rounds: 1 };
    expect(isUnitOpen(prompt, second.id, s)).toBe(true);
    expect(blockingUnit(prompt, second.id, s)).toBeNull();
  });
  it("blockingUnit names the unit to finish first", () => {
    expect(blockingUnit(prompt, second.id, freshSave())?.id).toBe("say-it");
    expect(blockingUnit(prompt, first.id, freshSave())).toBeNull();
  });
  it("an unknown unit is not open", () => {
    expect(isUnitOpen(prompt, "nope", freshSave())).toBe(false);
  });
});

describe("roundResume", () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
    } as Storage;
  });
  const now = 1_000_000_000_000;
  const p: InProgress = { world: "prompt", unit: "basics", seed: 42, idx: 2, answers: [{ key: "a", correct: true, review: false }, { key: "b", correct: false, review: true }], spentMs: 9000, roundXp: 10, combo: 0, savedAt: now };
  it("round-trips the same object", () => {
    saveInProgress(p);
    expect(loadInProgress("prompt", "basics", now)).toEqual(p);
  });
  it("returns null for another unit", () => {
    saveInProgress(p);
    expect(loadInProgress("prompt", "other", now)).toBeNull();
    expect(loadInProgress("other", "basics", now)).toBeNull();
  });
  it("returns null once older than 30 minutes", () => {
    saveInProgress(p);
    expect(loadInProgress("prompt", "basics", now + RESUME_MAX_MS - 1000)).not.toBeNull();
    expect(loadInProgress("prompt", "basics", now + 31 * 60 * 1000)).toBeNull();
  });
  it("returns null for corrupt JSON without throwing", () => {
    mem.set(RESUME_KEY, "{not json");
    expect(loadInProgress("prompt", "basics", now)).toBeNull();
    mem.set(RESUME_KEY, "null");
    expect(loadInProgress("prompt", "basics", now)).toBeNull();
  });
  it("clear removes it", () => {
    saveInProgress(p); clearInProgress();
    expect(loadInProgress("prompt", "basics", now)).toBeNull();
  });
  it("peek returns the stored round for any unit", () => {
    saveInProgress(p);
    expect(peekInProgress(now)).toEqual(p);
    const other = { ...p, world: "token", unit: "what-is-a-token" };
    saveInProgress(other);
    expect(peekInProgress(now)).toEqual(other);
  });
  it("peek returns null when nothing is stored", () => {
    expect(peekInProgress(now)).toBeNull();
  });
  it("peek returns null for corrupt or malformed data without throwing", () => {
    mem.set(RESUME_KEY, "{not json");
    expect(peekInProgress(now)).toBeNull();
    mem.set(RESUME_KEY, "null");
    expect(peekInProgress(now)).toBeNull();
    mem.set(RESUME_KEY, JSON.stringify({ ...p, world: 7 }));
    expect(peekInProgress(now)).toBeNull();
    mem.set(RESUME_KEY, JSON.stringify({ ...p, answers: "two" }));
    expect(peekInProgress(now)).toBeNull();
  });
  it("peek returns null once older than 30 minutes", () => {
    saveInProgress(p);
    expect(peekInProgress(now + RESUME_MAX_MS)).not.toBeNull();
    expect(peekInProgress(now + RESUME_MAX_MS + 1)).toBeNull();
  });
});
