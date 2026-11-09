import { describe, it, expect } from "vitest";
import { GOALS, needsOnboarding, startFor } from "@/lib/onboarding";
import { freshSave, migrate } from "@/lib/save";
import { getWorld } from "@/content";
import { isUnitOpen } from "@/lib/unlock";
import { pathWindow, pathNodes, worldOrder } from "@/lib/path";
import v1 from "./fixtures/v1-save-veteran.json";

describe("onboarding", () => {
  it("a brand new save needs it", () => { expect(needsOnboarding(freshSave())).toBe(true); });
  it("a migrated veteran never sees it", () => { expect(needsOnboarding(migrate(v1))).toBe(false); });
  it("a bare v1 save with no progress still sees it once", () => { expect(needsOnboarding(migrate({ v: 1 }))).toBe(true); });
  it("answering or skipping it ends it", () => {
    expect(needsOnboarding({ ...freshSave(), profile: { goal: "work", onboarded: true } })).toBe(false);
    expect(needsOnboarding({ ...freshSave(), profile: { goal: null, onboarded: true } })).toBe(false);
  });
  it("any XP, day or unit progress ends it even if the flag is missing", () => {
    expect(needsOnboarding({ ...freshSave(), xp: 10 })).toBe(false);
    expect(needsOnboarding({ ...freshSave(), days: ["2026-11-01"] })).toBe(false);
  });
  it("four goals, each sending the player to a live world whose first unit is open on a fresh save", () => {
    expect(GOALS.map((g) => g.id)).toEqual(["work", "curious", "protect", "build"]);
    for (const g of GOALS) {
      const { worldId, unitId } = startFor(g.id);
      const w = getWorld(worldId)!;
      expect(w.status).toBe("live");
      expect(w.units[0].id).toBe(unitId);
      expect(isUnitOpen(w, unitId, freshSave())).toBe(true);
    }
  });
  it("no goal copy uses an em or en dash", () => {
    for (const g of GOALS) expect(`${g.label} ${g.line}`).not.toMatch(/[–—]/);
  });
});

describe("the home path", () => {
  it("a fresh save lights the first unit of the first live world", () => {
    const v = pathWindow(freshSave());
    expect(v.cleared).toBe(0);
    expect(v.current!.world.id).toBe(worldOrder(freshSave())[0].id);
    expect(v.current!.unit.id).toBe(v.current!.world.units[0].id);
    expect(v.current!.open).toBe(true);
  });
  it("the player's goal world leads the path", () => {
    const s = { ...freshSave(), profile: { goal: "protect" as const, onboarded: true } };
    expect(pathWindow(s).current!.world.id).toBe("cap");
    expect(worldOrder(s)).toHaveLength(worldOrder(freshSave()).length); // nothing dropped or doubled
    expect(new Set(worldOrder(s).map((w) => w.id)).size).toBe(worldOrder(s).length);
  });
  it("clearing the lit unit moves the light to the next and counts one cleared", () => {
    const s = freshSave();
    const first = pathWindow(s).current!;
    s.units[`${first.world.id}/${first.unit.id}`] = { last: [0.8], best: 0.8, rounds: 1 };
    const v = pathWindow(s);
    expect(v.cleared).toBe(1);
    expect(v.current!.unit.id).not.toBe(first.unit.id);
  });
  it("never shows more than the asked number ahead, and ahead nodes follow the lit one in order", () => {
    const s = freshSave();
    const all = pathNodes(s);
    for (const n of [0, 1, 3, 5]) expect(pathWindow(s, n).ahead).toHaveLength(n);
    expect(pathWindow(s, 3).ahead.map((x) => x.unit.id)).toEqual(all.slice(1, 4).map((x) => x.unit.id));
  });
  it("a locked unit ahead is marked not open", () => {
    const v = pathWindow(freshSave());
    expect(v.ahead[0].open).toBe(false); // second unit of the same world waits for the first
  });
  it("when every unit is cleared there is no lit node", () => {
    const s = freshSave();
    for (const n of pathNodes(s)) s.units[`${n.world.id}/${n.unit.id}`] = { last: [1], best: 1, rounds: 1 };
    const v = pathWindow(s);
    expect(v.current).toBeNull();
    expect(v.cleared).toBe(pathNodes(s).length);
  });
});
