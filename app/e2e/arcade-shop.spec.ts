import { test, expect } from "@playwright/test";
import { expectNoHorizontalScroll, readSave, seedSave } from "./helpers";

test("the shop buys and equips a theme, and it shows on Home and after a reload", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, { tokens: 8 });
  await page.goto("/arcade/");
  await expect(page.getByTestId("tokens")).toHaveText("8");
  await page.locator('[data-theme-id="blackout"] .shop-btn').click();
  await expect(page.getByTestId("tokens")).toHaveText("2");
  await expect(page.locator('[data-theme-id="blackout"] .shop-btn')).toHaveText("ON NOW");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blackout");
  const save = await readSave(page);
  expect(save.themes).toEqual({ owned: ["notebook", "blackout"], equipped: "blackout" });
  expect(save.events.map((e: { type: string }) => e.type)).toEqual(["buy", "equip"]);
  await expectNoHorizontalScroll(page);
  // Back to Notebook is free, then Blackout again is free too.
  await page.locator('[data-theme-id="notebook"] .shop-btn').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "notebook");
  await expect(page.getByTestId("tokens")).toHaveText("2");
  await page.locator('[data-theme-id="blackout"] .shop-btn').click();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blackout");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(0, 0, 0)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blackout");
});

test("tokens never go negative: a theme the player cannot afford cannot be bought", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, { tokens: 2 });
  await page.goto("/arcade/");
  const btn = page.locator('[data-theme-id="redline"] .shop-btn');
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText("8 MORE TOKENS");
  await btn.click({ force: true });
  await expect(page.getByTestId("tokens")).toHaveText("2");
  const save = await readSave(page);
  expect(save.tokens).toBe(2);
  expect(JSON.stringify(save)).not.toContain("redline");
});

test("a game costs one token and the last token cannot go below zero", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, { tokens: 1 });
  await page.goto("/arcade/");
  await page.getByRole("button", { name: /SPEND 1 TOKEN/ }).click();
  await expect(page.locator("iframe[title=\"What's Poppin\"]")).toHaveAttribute("src", /theme=notebook/);
  expect((await readSave(page)).tokens).toBe(0);
  await page.getByRole("button", { name: /BACK TO LEARNING/ }).click();
  await expect(page.getByRole("button", { name: /SPEND 1 TOKEN/ })).toBeDisabled();
  expect((await readSave(page)).tokens).toBe(0);
});
