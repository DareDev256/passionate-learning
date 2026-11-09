import { test, expect } from "@playwright/test";
import { freshPage, answerFirstCard, seedSave } from "./helpers";

async function firstOpenRound(page: import("@playwright/test").Page) {
  await page.goto("/w/prompt/");
  await freshPage(page);
  await page.locator("a[href*='/play/prompt/']").first().click();
  await page.waitForURL(/\/play\/prompt\//);
}

async function next(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /NEXT/ }).click();
}

test("a round survives a reload: two answered, card three showing", async ({ page }) => {
  await firstOpenRound(page);
  await answerFirstCard(page); await next(page);
  await answerFirstCard(page);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.reload();
  await expect(page.locator(".drawer")).toHaveCount(0);
  const segs = page.locator(".segs i");
  await expect(segs.nth(0)).toHaveClass(/ok|no/);
  await expect(segs.nth(1)).toHaveClass(/ok|no/);
  await expect(segs.nth(2)).toHaveClass(/now/);
});

test("Home offers the round in progress, and tapping it resumes on card three", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.reload();
  await expect(page.locator(".play-cta")).toBeVisible();
  await expect(page.getByRole("region", { name: "Continue your round" })).toHaveCount(0);

  await firstOpenRound(page);
  const roundPath = new URL(page.url()).pathname;
  await answerFirstCard(page); await next(page);
  await answerFirstCard(page);

  await page.goto("/");
  const card = page.getByRole("region", { name: "Continue your round" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Prompt Dojo");
  await expect(card).toContainText("You answered 2 cards so far.");
  await card.getByRole("link", { name: /CONTINUE/ }).click();
  await page.waitForURL((u) => u.pathname === roundPath);
  const segs = page.locator(".segs i");
  await expect(segs.nth(0)).toHaveClass(/ok|no/);
  await expect(segs.nth(1)).toHaveClass(/ok|no/);
  await expect(segs.nth(2)).toHaveClass(/now/);
  await expect(page.locator(".drawer")).toHaveCount(0);
});

test("the quit button asks first once something is answered, and Keep playing closes it", async ({ page }) => {
  await firstOpenRound(page);
  const url = page.url();
  await answerFirstCard(page);
  await page.getByRole("button", { name: "Quit round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave this round?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: "Quit round" }).click();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(dialog).toBeHidden();
});

test("quit with no answers leaves at once, and Leave drops the saved round", async ({ page }) => {
  await firstOpenRound(page);
  await page.getByRole("button", { name: "Quit round" }).click();
  await page.waitForURL(/\/w\/prompt\//);
  await firstOpenRound(page);
  await answerFirstCard(page);
  await page.getByRole("button", { name: "Quit round" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await page.waitForURL(/\/w\/prompt\//);
  expect(await page.evaluate(() => localStorage.getItem("passionate-learning:round"))).toBeNull();
});

test("focus stays on Leave while the timer re-renders under the open sheet", async ({ page }) => {
  await firstOpenRound(page);
  await answerFirstCard(page); await next(page);
  await expect(page.locator(".drawer")).toHaveCount(0); // card 2 is waiting for an answer
  await page.getByRole("button", { name: "Quit round" }).click();
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Leave", exact: true })).toBeFocused();
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "Leave", exact: true })).toBeFocused();
});

test("a round answered to the last card survives a reload and is applied, not thrown away", async ({ page }) => {
  await firstOpenRound(page);
  for (let i = 0; i < 20; i++) {
    await answerFirstCard(page);
    if (await page.getByRole("button", { name: "FINISH ROUND" }).count()) break;
    await next(page);
  }
  await expect(page.getByRole("button", { name: "FINISH ROUND" })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(await page.evaluate(() => localStorage.getItem("passionate-learning:round"))).not.toBeNull();
  await page.reload();
  await expect(page.locator(".recap")).toBeVisible();
  const save = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k !== "passionate-learning:round").map(([, v]) => v).join(""));
  expect(save).toMatch(/"xp":\s*[1-9]/);
  expect(await page.evaluate(() => localStorage.getItem("passionate-learning:round"))).toBeNull();
});

test("Reset progress in Settings drops the round in progress, so Home offers no Continue card", async ({ page }) => {
  await firstOpenRound(page);
  await answerFirstCard(page); await next(page);
  await answerFirstCard(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Continue your round" })).toBeVisible();

  await page.goto("/settings/");
  await page.getByLabel("Type RESET to confirm").fill("RESET");
  await page.getByRole("button", { name: "RESET", exact: true }).click();
  await expect(page.getByText("Progress reset. Fresh start.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("passionate-learning:round"))).toBeNull();

  await page.getByRole("link", { name: "Back to the map" }).click();
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Continue your round" })).toHaveCount(0);
});

test("a stored round for a locked unit is cleared when its page opens", async ({ page }) => {
  await page.goto("/");
  await freshPage(page);
  await page.evaluate(() => localStorage.setItem("passionate-learning:round", JSON.stringify({
    world: "prompt", unit: "recipe", seed: 1, idx: 1, answers: [{ key: "x", correct: true, review: false }],
    spentMs: 1000, roundXp: 10, combo: 1, savedAt: Date.now(),
  })));
  await page.goto("/play/prompt/recipe/");
  await expect(page.getByText('Finish "Say what you mean" first')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("passionate-learning:round"))).toBeNull();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Continue your round" })).toHaveCount(0);
});
