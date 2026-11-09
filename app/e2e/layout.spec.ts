import { test, expect, type Page } from "@playwright/test";
import { freshPage, answerFirstCard, expectNoHorizontalScroll } from "./helpers";

const PAGES = ["/", "/worlds/", "/profile/", "/w/prompt/", "/w/circuit/", "/about/", "/settings/", "/privacy/", "/support/", "/does-not-exist/"];
const ROUNDS = ["/play/prompt/say-it/", "/play/circuit/parts/"];
const OPTIONS = ".options .opt, .opt-row .opt, [aria-label='Sentences'] .sentence";

/**
 * token/next-word with seed 4 always deals the same cards: tt-001 first (a predict card whose right answer is
 * option 1 and which carries a tall meme, so its drawer is the tallest there is), then tt-005 tt-006 tt-002 tt-003 tt-004.
 * Task 4's resume record restores that seed, so no test hook ships in the app.
 */
async function seededTokenRound(page: Page, motion: "reduce" | "system") {
  await page.goto("/play/token/next-word/");
  await page.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem("passionate-learning:v1", JSON.stringify({ v: 1, settings: { motion: m } })); // a v1 save on purpose: it is upgraded on load
    localStorage.setItem("passionate-learning:round", JSON.stringify({ world: "token", unit: "next-word", seed: 4, idx: 0, answers: [], spentMs: 0, roundXp: 0, combo: 0, savedAt: Date.now() }));
  }, motion);
  await page.reload();
  await expect(page.locator(OPTIONS).first()).toBeVisible();
}

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
}

test("a RIGHT answer leaves no sideways scroll once its animations end (the ring must not overshoot)", async ({ page }) => {
  await seededTokenRound(page, "system"); // full motion on purpose: the ring only exists while animating
  await page.locator(".options .opt").first().click(); // "jelly" is the right answer for tt-001
  await page.locator(".drawer").waitFor();
  await expect(page.locator(".opt.right")).toHaveCount(1);
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number))
    .map((a) => a.finished.catch(() => undefined))));
  await expectNoHorizontalScroll(page);
});

test("the drawer never covers an option, on any card (669 only, tall meme drawer met)", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("669"), "the tall drawer only collides with options at the Duo width");
  await seededTokenRound(page, "reduce"); // reduce-motion: no slide-in and no smooth scroll to time against
  let memes = 0;
  for (let i = 0; i < 6; i++) {
    await answerFirstCard(page);
    if (await page.locator(".drawer.has-meme").count()) memes++;
    await expect.poll(async () => {
      const top = await page.locator(".drawer").evaluate((d) => d.getBoundingClientRect().top);
      const bottoms = await page.locator(OPTIONS).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
      return Math.max(...bottoms, 0) <= top + 0.5;
    }, { message: `card ${i + 1}: an option sits under the drawer` }).toBe(true);
    await page.getByRole("button", { name: /NEXT|FINISH/ }).click();
    if (await page.locator(".recap").count()) break;
  }
  expect(memes, "the round must include a meme card, or this test proves nothing").toBeGreaterThan(0);
});

test("the 404 is branded and leads home", async ({ page }) => {
  await page.goto("/does-not-exist/");
  await expect(page.getByRole("heading", { name: "This page wandered off" })).toBeVisible();
  await page.getByRole("link", { name: /MAP/ }).click();
  await expect(page).toHaveURL(/\/$/);
});
