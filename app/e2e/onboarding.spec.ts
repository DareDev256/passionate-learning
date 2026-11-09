import { test, expect } from "@playwright/test";
import { expectNoHorizontalScroll, freshPage, readSave, seedSave } from "./helpers";

test("a fresh launch is one question, with no world list and no sign-in", async ({ page }) => {
  await page.goto("/");
  await freshPage(page);
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /For work/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Just curious/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Protect myself/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Build stuff/ })).toBeVisible();
  await expect(page.locator(".world")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

const GOALS: [RegExp, string, string][] = [
  [/For work/, "work", "prompt"],
  [/Just curious/, "curious", "token"],
  [/Protect myself/, "protect", "cap"],
  [/Build stuff/, "build", "tools"],
];
for (const [label, goal, world] of GOALS) {
  test(`"${goal}" is one tap to a card in ${world}`, async ({ page }) => {
    await page.goto("/");
    await freshPage(page);
    await page.getByRole("button", { name: label }).click();
    await page.waitForURL(new RegExp(`/play/${world}/`));
    await expect(page.locator(".prompt, .opt, input.type-in, .sentence").first()).toBeVisible();
    expect((await readSave(page)).profile).toEqual({ goal, onboarded: true });
  });
}

test("after answering, going home never shows the question again, and the goal world leads the path", async ({ page }) => {
  await page.goto("/");
  await freshPage(page);
  await page.getByRole("button", { name: /Protect myself/ }).click();
  await page.waitForURL(/\/play\/cap\//);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toHaveCount(0);
  await expect(page.locator(".hp-now")).toContainText("Fact Check");
});

test("Show me around first skips the question and never asks again", async ({ page }) => {
  await page.goto("/");
  await freshPage(page);
  await page.getByRole("button", { name: "Show me around first" }).click();
  await expect(page.locator(".hp-now")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toHaveCount(0);
  expect((await readSave(page)).profile).toEqual({ goal: null, onboarded: true });
});

test("a returning player never sees the first question flash", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, { xp: 300 });
  await page.reload();
  await expect(page.locator(".hp-now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toHaveCount(0);
});
