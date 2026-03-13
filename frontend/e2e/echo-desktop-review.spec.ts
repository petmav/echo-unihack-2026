import { test, expect } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

test.describe("Echo — Desktop Visual Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });
  });

  test("desktop home full-width", async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "desktop-01-home.png"),
      fullPage: true,
    });
  });

  test("desktop sidebar menu", async ({ page }) => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "desktop-02-menu-sidebar.png"),
      fullPage: true,
    });
  });

  test("desktop results full-width", async ({ page }) => {
    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("Feeling overwhelmed");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "desktop-03-results.png"),
      fullPage: true,
    });
  });

  test("desktop history panel", async ({ page }) => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(400);
    await page.getByText("Past thoughts").click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "desktop-04-history.png"),
      fullPage: true,
    });
  });
});
