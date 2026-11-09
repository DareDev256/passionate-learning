import { test, expect } from "@playwright/test";
import { freshPage, expectNoHorizontalScroll, readSave, seedSave } from "./helpers";

test("Sound off persists after reload", async ({ page }) => {
  await page.goto("/settings/");
  await freshPage(page);
  const sound = page.getByRole("switch", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-checked", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Sound" })).toHaveAttribute("aria-checked", "false");
  await expectNoHorizontalScroll(page);
});

test("Motion Reduce puts reduce-motion on html, and it survives a reload", async ({ page }) => {
  await page.goto("/settings/");
  await freshPage(page);
  await expect(page.locator("html")).not.toHaveClass(/reduce-motion/);
  await page.getByRole("button", { name: "REDUCE" }).click();
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
});

test("Reset needs RESET typed, then home asks the first question again and settings are kept", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("passionate-learning:v1", JSON.stringify({ v: 1, xp: 500, settings: { sound: false, name: "Ada" } })));
  await page.goto("/settings/");
  const btn = page.getByRole("button", { name: "RESET", exact: true });
  await expect(btn).toBeDisabled();
  await page.getByLabel("Type RESET to confirm").fill("reset");
  await expect(btn).toBeDisabled();
  await page.getByLabel("Type RESET to confirm").fill("RESET");
  await btn.click();
  await expect(page.getByRole("switch", { name: "Sound" })).toHaveAttribute("aria-checked", "false");
  expect((await readSave(page)).xp).toBe(0);
  // The old v1 backup must not be able to bring the reset save back.
  expect(await page.evaluate(() => ["passionate-learning:v1", "passionate-learning:v1-backup"].map((k) => localStorage.getItem(k)))).toEqual([null, null]);
  await page.getByRole("link", { name: "Back to the map" }).click();
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toBeVisible();
});

test("a v1 save from the old app is upgraded on first load, keeps its rank, and skips the first question", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("passionate-learning:v1", JSON.stringify({ v: 1, xp: 500, days: ["2026-10-01", "2026-10-09"], tokens: 7, settings: { sound: false, name: "Ada" } })));
  await page.reload();
  await expect(page.locator(".chip.rank")).toContainText("C");
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toHaveCount(0);
  const save = await readSave(page);
  expect(save).toMatchObject({ v: 2, xp: 500, tokens: 7, days: ["2026-10-01", "2026-10-09"], imported: { xp: 500, unverified: true } });
  expect(await page.evaluate(() => [localStorage.getItem("passionate-learning:v1"), localStorage.getItem("passionate-learning:v1-backup") !== null])).toEqual([null, true]);
});

test("home has a settings button; privacy and support render", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.reload();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.goto("/privacy/");
  await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeVisible();
  await expect(page.getByText("No ads. No tracking. No analytics.")).toBeVisible();
  await page.goto("/support/");
  await expect(page.getByRole("heading", { name: "Support", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "james@stiersolutions.ca" })).toBeVisible();
  await page.goto("/about/");
  await expect(page.getByRole("link", { name: "privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "support" })).toBeVisible();
});
