import { test, expect, type Page } from "@playwright/test";
import { answerFirstCard, expectNoHorizontalScroll, readSave, seedSave } from "./helpers";

/**
 * token/next-word with seed 4 always deals tt-001, tt-005, tt-006, tt-002, tt-003, tt-004 (see layout.spec).
 * The resume record lets a test start with five cards already answered WRONG, so the recap has a known miss list.
 */
async function roundWithFiveMisses(page: Page) {
  await page.goto("/");
  await seedSave(page);
  const keys = ["tt-001", "tt-005", "tt-006", "tt-002", "tt-003"].map((k) => `token:${k}`);
  await page.evaluate((ks) => localStorage.setItem("passionate-learning:round", JSON.stringify({
    world: "token", unit: "next-word", seed: 4, idx: 5, answers: ks.map((key) => ({ key, correct: false, review: false })),
    spentMs: 20000, roundXp: 0, combo: 0, savedAt: Date.now(),
  })), keys);
  await page.goto("/play/token/next-word/");
  // tt-004 ("What is a token?") has its right answer at index 1, so option 0 is a known miss on a card never seen before.
  await page.locator(".options .opt").first().click();
  await page.locator(".drawer.bad").waitFor();
  await expect(page.locator(".drawer .again")).toHaveText("You will see this again tomorrow.");
  await page.getByRole("button", { name: "FINISH ROUND" }).click();
  await expect(page.locator(".recap")).toBeVisible();
}

test("the recap lists every missed card with the answer and the why", async ({ page }) => {
  await roundWithFiveMisses(page);
  const missed = page.locator(".missed-card");
  await expect(missed).toHaveCount(6);
  await expect(missed.first().locator(".missed-a")).toContainText("ANSWER:");
  await expect(missed.first().locator(".missed-why")).not.toBeEmpty();
  await expect(page.getByRole("button", { name: /FIX YOUR MISTAKES/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("the recap says what unlocks next and what it needs", async ({ page }) => {
  await roundWithFiveMisses(page);
  const line = page.getByTestId("unlock-line");
  await expect(line).toContainText("70%");
  await expect(line).toContainText("The dials");
  await expect(line).toContainText("5 of 6");
  await expect(line).toContainText("0%");
});

test("fix your mistakes runs a pass over only the missed cards and leaves unit progress alone", async ({ page }) => {
  await roundWithFiveMisses(page);
  const before = await readSave(page);
  expect(before.units["token/next-word"].rounds).toBe(1);
  const count = await page.locator(".missed-card").count();
  await page.getByRole("button", { name: /FIX YOUR MISTAKES/ }).click();
  await expect(page.getByText(/FIX YOUR MISTAKES: no timer/)).toBeVisible();
  await expect(page.locator(".segs i")).toHaveCount(count);
  for (let i = 0; i < count; i++) {
    await answerFirstCard(page);
    if (await page.locator(".drawer.bad").count()) await expect(page.locator(".drawer .again")).toContainText(/You will see this again (tomorrow|on |in your next round)/);
    await page.getByRole("button", { name: /NEXT|FINISH/ }).click();
  }
  await expect(page.getByRole("heading", { name: /FIXED\.|GOOD TRY\./ })).toBeVisible();
  const after = await readSave(page);
  expect(after.units).toEqual(before.units);
  expect(after.days).toEqual(before.days);
  expect(after.events.map((e: { type: string }) => e.type)).toEqual(["round", "fix"]);
  await expectNoHorizontalScroll(page);
});

test("a right answer says nothing about when the card comes back", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.goto("/play/token/next-word/");
  // Fresh round: every card is unseen. tt-001 is dealt first with seed 4.
  await page.evaluate(() => localStorage.setItem("passionate-learning:round", JSON.stringify({ world: "token", unit: "next-word", seed: 4, idx: 0, answers: [], spentMs: 0, roundXp: 0, combo: 0, savedAt: Date.now() })));
  await page.reload();
  await page.locator(".options .opt", { hasText: "jelly" }).click(); // tt-001 "peanut butter and ___": jelly is right
  await page.locator(".drawer.good").waitFor();
  await expect(page.locator(".drawer .again")).toHaveCount(0);
});
