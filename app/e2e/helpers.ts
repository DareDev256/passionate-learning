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
