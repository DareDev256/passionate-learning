import { test, expect } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test("smoke: home renders the Passionate Learning title and at least one world link", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Passionate Learning/);
  await expect(page.locator("a[href^='/w/']").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
