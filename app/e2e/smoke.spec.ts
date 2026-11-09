import { test, expect } from "@playwright/test";
import { expectNoHorizontalScroll, seedSave } from "./helpers";

test("smoke: a fresh launch is the first question, and once answered Home has a play button and the worlds", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Passionate Learning/);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await seedSave(page);
  await page.reload();
  await expect(page.locator(".play-cta")).toBeVisible();
  await expect(page.getByRole("link", { name: "ALL WORLDS" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
