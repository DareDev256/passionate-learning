import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CardView, correctText } from "@/components/CardView";
import { WORLDS } from "@/content";
import type { Card } from "@/content/types";

type CapCard = Extract<Card, { type: "cap" }>;
const card: CapCard = { id: "t-1", type: "cap", claim: "The Great Wall is visible from the Moon.", isCap: true, why: "False. Too narrow." };
const html = (done: Parameters<typeof CardView>[0]["done"] = null) => renderToStaticMarkup(createElement(CardView, { card, done, onAnswer: () => {}, seed: 1 }));

describe("the True or false card", () => {
  it("asks True or false and offers TRUE then FALSE, with no slang or emoji", () => {
    const h = html();
    expect(h).toContain("True or false?");
    expect(h.indexOf(">TRUE<")).toBeGreaterThan(-1);
    expect(h.indexOf(">TRUE<")).toBeLessThan(h.indexOf(">FALSE<"));
    expect(h.replace(/cap-btn/g, "")).not.toMatch(/\bcap\b|facts|🧢|✅/i);
  });
  it("labels the answer TRUE or FALSE", () => {
    expect(correctText(card)).toBe("FALSE");
    expect(correctText({ ...card, isCap: false })).toBe("TRUE");
  });
  it("marks the right button after an answer, whichever side it is on", () => {
    const h = html({ r: { type: "cap", saysCap: false }, ok: false });
    expect(h).toMatch(/opt cap-btn wrong[^>]*>TRUE</);
    expect(h).toMatch(/opt cap-btn right[^>]*>FALSE</);
  });
});

describe("player-facing copy has no cap slang", () => {
  const cards = WORLDS.flatMap((w) => w.units.flatMap((u) => u.cards));
  it("a why that opens with False. or True. agrees with its flag, and none opens with Cap. or Facts.", () => {
    for (const c of cards) {
      if (c.type !== "cap") continue;
      expect(c.why, c.id).not.toMatch(/^(Cap|Facts)\./);
      if (/^(False|True)\./.test(c.why)) expect(c.why.startsWith(c.isCap ? "False." : "True."), c.id).toBe(true);
    }
  });
  it("no card text or world title says cap or no cap", () => {
    for (const w of WORLDS) {
      expect(w.title).not.toMatch(/\bcap\b/i);
      for (const u of w.units) expect(`${u.title} ${u.blurb}`).not.toMatch(/\bcap\b/i);
    }
    for (const c of cards) expect(JSON.stringify(c).replace(/"type":"cap"|"isCap"/g, "")).not.toMatch(/\bcap\b/i);
  });
  it("the world keeps its id so saves and links do not break", () => {
    const w = WORLDS.find((x) => x.id === "cap")!;
    expect(w.title).toBe("Fact Check");
  });
});
