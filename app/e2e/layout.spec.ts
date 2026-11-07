import { test, expect } from "@playwright/test";
import { freshPage, answerFirstCard, expectNoHorizontalScroll } from "./helpers";

const PAGES = ["/", "/w/prompt/", "/w/circuit/", "/about/", "/settings/", "/privacy/", "/support/", "/does-not-exist/"];
const ROUNDS = ["/play/prompt/say-it/", "/play/circuit/parts/", "/play/token/next-word/"];

for (const path of PAGES) {
  test(`no sideways scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  });
}

for (const path of ROUNDS) {
  test(`round ${path}: no sideways scroll before and after answering`, async ({ page }) => {
    await page.goto(path);
    await freshPage(page);
    await expectNoHorizontalScroll(page);
    await answerFirstCard(page);
    await expectNoHorizontalScroll(page);
  });

  test(`round ${path}: the drawer never covers an option, on any card`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(path);
    await freshPage(page);
    for (let i = 0; i < 8; i++) {
      await answerFirstCard(page);
      await page.waitForTimeout(450); // drawer slide-in and the scroll that follows
      const drawerTop = await page.locator(".drawer").evaluate((d) => d.getBoundingClientRect().top);
      const bottoms = await page.locator(".options .opt, .opt-row .opt, [aria-label='Sentences'] .sentence").evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect().bottom));
      for (const b of bottoms) expect(b, `card ${i + 1}`).toBeLessThanOrEqual(drawerTop + 0.5);
      await page.getByRole("button", { name: /NEXT|FINISH/ }).click();
      if (await page.locator(".recap").count()) break;
    }
  });
}

test("the 404 is branded and leads home", async ({ page }) => {
  await page.goto("/does-not-exist/");
  await expect(page.getByRole("heading", { name: "This page wandered off" })).toBeVisible();
  await page.getByRole("link", { name: /MAP/ }).click();
  await expect(page).toHaveURL(/\/$/);
});
