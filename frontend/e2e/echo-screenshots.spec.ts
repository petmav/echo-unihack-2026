import { test, expect } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

test.describe("Echo — Visual Review Screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("capture onboarding screen", async ({ page }) => {
    await expect(page.getByText("You're not alone")).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-onboarding.png"),
      fullPage: true,
    });
  });

  test("capture auth screen", async ({ page }) => {
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-auth.png"),
      fullPage: true,
    });
  });

  test("capture home screen with breathing logo", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-home.png"),
      fullPage: true,
    });
  });

  test("capture thought input overlay", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await expect(
      page.getByPlaceholder("What's weighing on you right now?")
    ).toBeVisible();

    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel like nobody really understands me");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-thought-input.png"),
      fullPage: true,
    });
  });

  test("capture processing and results flow", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I keep comparing myself to others");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-processing.png"),
      fullPage: true,
    });

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06-results.png"),
      fullPage: true,
    });
  });

  test("capture hamburger menu", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-menu.png"),
      fullPage: true,
    });
  });

  test("capture bottom sheet (what helped)", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel lost");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    const card = page
      .getByRole("button", { name: "Tap to see what helped" })
      .first();
    await card.waitFor({ timeout: 8000 });
    await card.click();

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08-bottom-sheet.png"),
      fullPage: true,
    });
  });
});
