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
