import { test, expect } from "@playwright/test";
import { answerFirstCard, expectNoHorizontalScroll, readSave, seedSave } from "./helpers";

test("home is one path: the next node is lit, a few wait ahead, the worlds are a tap deeper", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.reload();
  await expect(page.locator(".hp-now")).toContainText("UP NEXT");
  await expect(page.locator(".hp-now .play-cta")).toBeVisible();
  expect(await page.locator(".hp-ahead li").count()).toBeLessThanOrEqual(3);
  await expect(page.locator(".world")).toHaveCount(0); // the nine-world grid is not on Home
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: "ALL WORLDS" }).click();
  await expect(page).toHaveURL(/\/worlds\/$/);
  expect(await page.locator(".world").count()).toBeGreaterThanOrEqual(9);
  await expectNoHorizontalScroll(page);
});

test("clearing the lit unit moves the light", async ({ page }) => {
  await page.goto("/");
  await seedSave(page, { units: { "prompt/say-it": { last: [0.8], best: 0.8, rounds: 1 } } });
  await page.reload();
  await expect(page.locator(".hp-cleared")).toContainText("1 unit cleared");
  await expect(page.locator(".hp-now")).toContainText("The recipe");
});

test("the play button opens the lit unit", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.reload();
  await page.locator(".hp-now .play-cta").click();
  await page.waitForURL(/\/play\//);
  await expect(page.locator(".prompt, .opt, input.type-in, .sentence").first()).toBeVisible();
});

test("three quests and a chest: a round ticks two, a second round opens the chest once", async ({ page }) => {
  await page.goto("/");
  await seedSave(page);
  await page.reload();
  const quests = page.getByRole("list", { name: "Today's quests" });
  await expect(quests.locator("li.done")).toHaveCount(0);
  await expect(page.getByText("0 of 3 done")).toBeVisible();
  await expect(page.getByText("A missed day resets nothing")).toBeVisible();
  for (let round = 0; round < 2; round++) {
    await page.locator(".hp-now .play-cta").click();
    await page.waitForURL(/\/play\//);
    for (let i = 0; i < 12; i++) {
      await answerFirstCard(page);
      const fin = page.getByRole("button", { name: "FINISH ROUND" });
      if (await fin.count()) { await fin.click(); break; }
      await page.getByRole("button", { name: /NEXT/ }).click();
    }
    await expect(page.locator(".recap")).toBeVisible();
    await page.goto("/");
    if (round === 0) await expect(quests.locator("li.done")).toHaveCount(2); // round + review (nothing was due)
  }
  await expect(quests.locator("li.done")).toHaveCount(3);
  // The label must be readable, not just present: a role-name click passed while the text was dark on dark (2026-11-09).
  const chestBtn = page.getByRole("button", { name: "OPEN CHEST" });
  await expect(chestBtn).toBeEnabled();
  const ratio = await chestBtn.evaluate((el) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const cs = getComputedStyle(el);
    const [a, b] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  if (page.viewportSize()?.width === 390) {
    await page.waitForTimeout(500); // let the System window finish its open animation
    await page.screenshot({ path: "docs/screenshots/2026-11-09_p2/08-home-chest-ready-390.png", fullPage: true });
  }
  const tokensBefore = (await readSave(page)).tokens;
  await page.getByRole("button", { name: "OPEN CHEST" }).click();
  await expect(page.getByText("Chest opened.")).toBeVisible();
  expect((await readSave(page)).tokens).toBe(tokensBefore + 5);
  await expect(page.getByTitle("Arcade tokens")).toContainText(String(tokensBefore + 5)); // the top bar moves too
  await expect(page.getByRole("button", { name: "OPEN CHEST" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Chest opened.")).toBeVisible();
  expect((await readSave(page)).tokens).toBe(tokensBefore + 5);
});
