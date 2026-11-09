import { test, expect } from "@playwright/test";
import { expectNoHorizontalScroll, seedSave } from "./helpers";

const mem = (seen: number, correct: number) => ({ due: "2026-11-20T00:00:00.000Z", stability: 9, difficulty: 5, elapsed_days: 0, scheduled_days: 9, reps: 3, lapses: 0, state: 2, last_review: "2026-11-08T00:00:00.000Z", seen, correct });

test("a new player's profile shows honest empties, never a fake 0%", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.goto("/profile/");
  await expect(page.getByRole("heading", { name: "You" })).toBeVisible();
  await expect(page.getByLabel("Rank", { exact: true })).toContainText("E");
  await expect(page.locator(".pf-stats .stat").nth(3)).toContainText("n/a");
  await expect(page.locator(".pf-worlds li").first()).toContainText("not yet");
  await expect(page.getByRole("heading", { name: /Achievements/ })).toContainText("0 of");
  await expect(page.locator(".pf-ach li.earned")).toHaveCount(0);
  await expect(page.getByText("Days played only ever counts up")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("a played profile shows rank, days, accuracy per world and earned badges", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, {
    xp: 520, days: ["2026-10-20", "2026-10-22", "2026-11-02"], settings: { sound: true, haptics: true, motion: "system", name: "Dee" },
    cards: { "prompt:pd-001": mem(4, 3), "prompt:pd-002": mem(4, 1), "token:tt-001": mem(2, 2) },
    units: { "prompt/say-it": { last: [1], best: 1, rounds: 2 } },
    imported: { xp: 520, cap: 900, unverified: true },
  });
  await page.goto("/profile/");
  await expect(page.getByRole("heading", { name: "Dee" })).toBeVisible();
  await expect(page.getByLabel("Rank", { exact: true })).toContainText("C");
  await expect(page.locator(".pf-stats .stat").first()).toContainText("3");
  const prompt = page.locator(".pf-worlds li", { hasText: "Prompt Dojo" });
  await expect(prompt).toContainText("50%"); // 4 right of 8
  await expect(page.locator(".pf-worlds li", { hasText: "Token Temple" })).toContainText("100%");
  await expect(page.locator(".pf-worlds li", { hasText: "Circuit Lab" })).toContainText("not yet");
  await expect(page.locator(".pf-ach li.earned", { hasText: "Flawless" })).toHaveCount(1);
  await expect(page.locator(".pf-ach li.earned", { hasText: "Three days" })).toHaveCount(1);
  await expect(page.locator(".pf-ach li.locked", { hasText: "Seven days" })).toHaveCount(1);
  await expect(page.getByText("Your XP from an earlier version came with you")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("the rank chip on Home opens the profile", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, { xp: 200 });
  await page.reload();
  await page.locator(".chip.rank").click();
  await expect(page).toHaveURL(/\/profile\/$/);
});
