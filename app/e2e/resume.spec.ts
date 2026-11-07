import { test, expect } from "@playwright/test";
import { freshPage, answerFirstCard } from "./helpers";

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
