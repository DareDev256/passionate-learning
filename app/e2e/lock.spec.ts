import { test, expect } from "@playwright/test";
import { freshPage, expectNoHorizontalScroll } from "./helpers";

// The app has no `.card` class: a card is a prompt plus answer controls, so check for those too.
const CARD_PARTS = ".card, h1.prompt, .opt, input.type-in, .sentence";
const MSG = 'Finish "Say what you mean" first';

test("a locked unit by direct URL shows what to finish first, never a card", async ({ page }) => {
  await page.goto("/play/prompt/recipe/");
  await freshPage(page);
  await expect(page.getByText(MSG)).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to Prompt Dojo/ })).toBeVisible();
  await expect(page.locator(CARD_PARTS)).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("tapping a locked node on the world map stays put and toasts", async ({ page }) => {
  await page.goto("/w/prompt/");
  await freshPage(page);
  const url = page.url();
  await page.getByRole("button", { name: /locked/ }).first().click();
  await expect(page.locator(".locked-toast")).toHaveText(MSG);
  expect(page.url()).toBe(url);
  await expect(page.locator(".locked-toast")).toBeHidden({ timeout: 4000 });
});

test("the toast still shows under reduced motion, without the shake", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/w/prompt/");
  await freshPage(page);
  const node = page.getByRole("button", { name: /locked/ }).first();
  await node.click();
  await expect(page.locator(".locked-toast")).toBeVisible();
  await expect(node).not.toHaveClass(/shake/);
});

test("the first unit is not locked", async ({ page }) => {
  await page.goto("/play/prompt/say-it/");
  await freshPage(page);
  await expect(page.locator(CARD_PARTS).first()).toBeVisible();
});
