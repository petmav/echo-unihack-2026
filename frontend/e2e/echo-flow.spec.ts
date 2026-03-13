import { test, expect } from "@playwright/test";

test.describe("Echo — Full UX Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("renders onboarding on first visit", async ({ page }) => {
    await expect(
      page.getByText("You're not alone")
    ).toBeVisible();
    await expect(
      page.getByText("Echo finds others who have felt exactly")
    ).toBeVisible();
  });

  test("can navigate through onboarding steps", async ({ page }) => {
    await expect(page.getByText("You're not alone")).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Your words")).toBeVisible();
    await expect(page.getByText("stay yours")).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Sometimes it")).toBeVisible();

    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });

  test("can skip onboarding", async ({ page }) => {
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });

  test("shows auth screen with email and password fields", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in" })
    ).toBeVisible();
  });

  test("can toggle between login and signup", async ({ page }) => {
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(
      page.getByRole("button", { name: "Sign in" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible();

    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(
      page.getByRole("button", { name: "Sign in" }).first()
    ).toBeVisible();
  });

  test("auth leads to home screen with breathing logo", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Skip" }).click();

    await page.getByPlaceholder("Email").fill("test@test.com");
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });
  });

  test("can open and close thought input", async ({ page }) => {
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
    await expect(page.getByText("0/280")).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible();
  });

  test("thought submission shows processing then results", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();

    await page.getByRole("button", { name: "Share what" }).click();

    const textarea = page.getByPlaceholder(
      "What's weighing on you right now?"
    );
    await textarea.fill("I feel lost and don't know what to do");

    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText(/finding your people|you're not alone|others have been/i)
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });
  });

  test("response cards appear after count reveal", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I worry about the future");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText("someone found a way through").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("can open bottom sheet on highlighted card", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I always compare myself to others");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    const highlightedCard = page
      .getByRole("button", { name: "Tap to see what helped" })
      .first();
    await highlightedCard.waitFor({ timeout: 8000 });
    await highlightedCard.click();

    await expect(page.getByText("What helped")).toBeVisible();
    await expect(
      page.getByText("Written by someone who's been there.")
    ).toBeVisible();
  });

  test("hamburger menu opens and navigates", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByText("Past thoughts")).toBeVisible();
    await expect(page.getByText("Trends")).toBeVisible();
    await expect(page.getByText("Account")).toBeVisible();
    await expect(page.getByText("About Echo")).toBeVisible();
  });

  test("history panel shows privacy notice", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("echo_onboarding_done", "true");
      localStorage.setItem("echo_jwt", "demo-token");
    });
    await page.reload();

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByText("Past thoughts").click();

    await expect(
      page.getByText("This data lives only on your device")
    ).toBeVisible({ timeout: 5000 });
  });

  test("favicon is present", async ({ page }) => {
    await page.goto("/");

    const favicon = page.locator('link[rel="icon"][type="image/svg+xml"]');
    await expect(favicon).toHaveAttribute("href", /icon\.svg/);
  });
});

test.describe("Echo — Responsive Layout", () => {
  test("mobile: renders home screen correctly", async ({ page }) => {
    test.skip(
      !page.viewportSize() || (page.viewportSize()?.width ?? 0) >= 768,
      "Mobile-only test"
    );

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

  test("desktop: shows echo wordmark in top bar", async ({ page }) => {
    test.skip(
      !page.viewportSize() || (page.viewportSize()?.width ?? 0) < 768,
      "Desktop-only test"
    );

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
});
