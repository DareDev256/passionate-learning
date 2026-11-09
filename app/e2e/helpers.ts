import { expect, type Page } from "@playwright/test";

export const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 669, h: 951 },
];

/** Clear localStorage, then reload so the app boots with no saved state. */
export async function freshPage(page: Page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

export async function expectNoHorizontalScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
}

/** On a round page: click the first answer control and wait for the feedback drawer. */
export async function answerFirstCard(page: Page) {
  const choice = page.locator(".options .opt, .opt-row .opt, [aria-label='Sentences'] .sentence").first();
  const typed = page.locator("input.type-in");
  await expect(choice.or(typed).first()).toBeVisible();
  if (await typed.count()) {
    await typed.fill("x");
    await page.getByRole("button", { name: "CHECK" }).click();
  } else {
    await choice.click();
  }
  await page.locator(".drawer").waitFor();
}

export const SAVE_V2 = "passionate-learning:v2";

/** The saved v2 progress, parsed. */
export async function readSave(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), SAVE_V2);
}

/** Boots with a v2 save the first-launch card will not interrupt. `patch` merges over a minimal save. */
export async function seedSave(page: Page, patch: Record<string, unknown> = {}) {
  await page.evaluate(([k, p]) => {
    localStorage.clear();
    localStorage.setItem(k as string, JSON.stringify({ v: 2, profile: { goal: null, onboarded: true }, ...(p as object) }));
  }, [SAVE_V2, patch] as const);
}
