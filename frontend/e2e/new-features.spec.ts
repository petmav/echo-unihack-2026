import { test, expect } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

function setupLoggedIn(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    localStorage.setItem("echo_onboarding_done", "true");
    localStorage.setItem("echo_jwt", "demo-token");
  });
}

function seedThoughtHistory(
  page: import("@playwright/test").Page,
  theme = "self_worth",
  resolved = false
) {
  return page.evaluate(
    ({ theme, resolved }) => {
      const thoughts = [
        {
          message_id: "test-thought-1",
          raw_text: "I keep comparing myself to everyone around me",
          theme_category: theme,
          timestamp: Date.now() - 86400000,
          is_resolved: resolved,
          resolution_text: resolved ? "I learned to focus on my own journey" : undefined,
        },
      ];
      localStorage.setItem("echo_thoughts", JSON.stringify(thoughts));
    },
    { theme, resolved }
  );
}

function seedThoughtHistoryEntries(
  page: import("@playwright/test").Page,
  thoughts: Array<{
    message_id: string;
    raw_text: string;
    theme_category: string;
    timestamp: number;
    is_resolved: boolean;
    resolution_text?: string;
  }>
) {
  return page.evaluate(
    ({ thoughts }) => {
      localStorage.setItem("echo_thoughts", JSON.stringify(thoughts));
    },
    { thoughts }
  );
}

function seedFutureLetter(
  page: import("@playwright/test").Page,
  theme = "self_worth"
) {
  return page.evaluate(
    ({ theme }) => {
      const letters = [
        {
          message_id: "test-thought-1",
          theme_category: theme,
          letter_text:
            "Remember: comparison is the thief of joy. You've been here before and you got through it.",
          timestamp: Date.now() - 604800000,
        },
      ];
      localStorage.setItem("echo_future_letters", JSON.stringify(letters));
    },
    { theme }
  );
}

/* ═══════════════════════════════════════════════
   D. "Breathing With Others" — ambient co-presence
   ═══════════════════════════════════════════════ */

test.describe("Breathing With Others", () => {
  test("shows presence indicator on home screen", async ({ page }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    const presenceText = page.getByTestId("presence-indicator");
    await expect(presenceText).toBeVisible({ timeout: 5000 });
    await expect(presenceText).toContainText("others breathing in this space");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-d-presence.png"),
      fullPage: true,
    });
  });

  test("logo has data-presence-level attribute", async ({ page }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    const logo = page.locator("[data-presence-level]");
    await expect(logo).toBeVisible();

    const level = await logo.getAttribute("data-presence-level");
    expect(Number(level)).toBeGreaterThanOrEqual(0);
    expect(Number(level)).toBeLessThanOrEqual(4);
  });
});

/* ═══════════════════════════════════════════════
   E. "Future You" — local-only future letters
   ═══════════════════════════════════════════════ */

test.describe("Future You", () => {
  test("shows future letter trigger after resolving a thought", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await seedThoughtHistory(page, "self_worth", true);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(400);
    await page.getByText("Past thoughts").click();
    await page.waitForTimeout(500);

    const trigger = page.getByTestId("future-letter-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText("Write a note to your future self");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-e-trigger.png"),
      fullPage: true,
    });
  });

  test("can write and save a future letter", async ({ page }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await seedThoughtHistory(page, "self_worth", true);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(400);
    await page.getByText("Past thoughts").click();
    await page.waitForTimeout(500);

    await page.getByTestId("future-letter-trigger").click();

    const textarea = page.getByTestId("future-letter-textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("You are stronger than you think. Remember that.");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-e-writing.png"),
      fullPage: true,
    });

    await page.getByTestId("future-letter-save").click();

    await expect(
      page.getByText("Note saved — it'll find you when you need it.")
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-e-saved.png"),
      fullPage: true,
    });

    const stored = await page.evaluate(() =>
      localStorage.getItem("echo_future_letters")
    );
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].letter_text).toBe(
      "You are stronger than you think. Remember that."
    );
  });

  test("shows future letter banner when matching theme resurfaces", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await seedFutureLetter(page, "self_worth");
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel worthless again");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const banner = page.getByTestId("future-you-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("A note from past you");
    await expect(banner).toContainText("comparison is the thief of joy");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-e-banner.png"),
      fullPage: true,
    });
  });
});

/* ═══════════════════════════════════════════════
   G. "Quiet wins" — local-only reflection banner
   ═══════════════════════════════════════════════ */

test.describe("Quiet wins", () => {
  test("shows a quiet win banner when a recurring theme returns after a long gap", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    await seedThoughtHistoryEntries(page, [
      {
        message_id: "quiet-self-worth-1",
        raw_text: "I feel small around everyone else",
        theme_category: "self_worth",
        timestamp: now - 18 * dayMs,
        is_resolved: false,
      },
      {
        message_id: "quiet-self-worth-2",
        raw_text: "I keep doubting my own value",
        theme_category: "self_worth",
        timestamp: now - 22 * dayMs,
        is_resolved: true,
        resolution_text: "I spoke to someone I trust.",
      },
      {
        message_id: "quiet-other",
        raw_text: "Work has been loud lately",
        theme_category: "work_stress",
        timestamp: now - 2 * dayMs,
        is_resolved: false,
      },
    ]);

    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel worthless again");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const banner = page.getByTestId("quiet-win-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("A quiet win");
    await expect(banner).toContainText("18 days");
    await expect(banner).toContainText("self worth");
  });
});

/* ═══════════════════════════════════════════════
   H. Local emotion trends
   ═══════════════════════════════════════════════ */

test.describe("Emotion trends", () => {
  test("switches between weekly, monthly, and yearly emotion views", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    await seedThoughtHistoryEntries(page, [
      {
        message_id: "trend-week-1",
        raw_text: "I keep doubting myself",
        theme_category: "self_worth",
        timestamp: now - dayMs,
        is_resolved: false,
      },
      {
        message_id: "trend-week-2",
        raw_text: "Work has been loud in my head",
        theme_category: "self_worth",
        timestamp: now - 3 * dayMs,
        is_resolved: true,
        resolution_text: "I slowed down and asked for help.",
      },
      {
        message_id: "trend-month",
        raw_text: "My family expectations are crushing me",
        theme_category: "family_pressure",
        timestamp: now - 10 * dayMs,
        is_resolved: false,
      },
      {
        message_id: "trend-year",
        raw_text: "I still miss them more than I say",
        theme_category: "relationship_loss",
        timestamp: now - 40 * dayMs,
        is_resolved: true,
        resolution_text: "I stopped pretending I was over it.",
      },
    ]);

    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(400);
    await page.getByText("Trends").click();
    await page.waitForTimeout(500);

    await expect(page.getByTestId("trend-range-weekly")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByText("This week")).toBeVisible();
    await expect(page.getByTestId("trend-dominant-theme")).toContainText(
      "Self-worth"
    );

    await page.getByTestId("trend-range-monthly").click();
    await expect(page.getByText("This month")).toBeVisible();
    await expect(page.getByText("Family pressure")).toBeVisible();

    await page.getByTestId("trend-range-yearly").click();
    await expect(page.getByText("This year")).toBeVisible();
    await expect(page.getByText("Relationship loss")).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════
   F. "Guardrails of Care" — safety resource layer
   ═══════════════════════════════════════════════ */

test.describe("Guardrails of Care", () => {
  test("shows safety banner for self_harm keyword phrase", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I don't want to be here anymore");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const safetyBanner = page.getByTestId("safety-banner");
    await expect(safetyBanner).toBeVisible();
    await expect(safetyBanner).toContainText("help is available");
    await expect(safetyBanner).toContainText("Lifeline");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-f-safety-banner.png"),
      fullPage: true,
    });
  });

  test("shows safety banner for suicidal_ideation phrase", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I don't want to live like this");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const safetyBanner = page.getByTestId("safety-banner");
    await expect(safetyBanner).toBeVisible();
    await expect(safetyBanner).toContainText("Crisis Text Line");
  });

  test("safety banner shows all contact resources", async ({ page }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I want to disappear from everything");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const safetyBanner = page.getByTestId("safety-banner");
    await expect(safetyBanner).toBeVisible();
    await expect(safetyBanner).toContainText("13 11 14");
    await expect(safetyBanner).toContainText("741741");
    await expect(safetyBanner).toContainText("1300 22 4636");
    await expect(safetyBanner).toContainText("Find help near you");
    await expect(safetyBanner).toContainText("not logged or recorded");
  });

  test("safety banner does NOT appear for non-risk themes", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel stressed about work");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const safetyBanner = page.getByTestId("safety-banner");
    await expect(safetyBanner).not.toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-f-no-banner.png"),
      fullPage: true,
    });
  });
});

/* ═══════════════════════════════════════════════
   E+F combined: demo seed letter + keyword detection
   ═══════════════════════════════════════════════ */

test.describe("Demo seeding", () => {
  test("demo mode auto-seeds future letter on first submission", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    const beforeLetters = await page.evaluate(() =>
      localStorage.getItem("echo_future_letters")
    );
    expect(beforeLetters).toBeNull();

    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel lost");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    const afterLetters = await page.evaluate(() =>
      localStorage.getItem("echo_future_letters")
    );
    expect(afterLetters).toBeTruthy();
    const parsed = JSON.parse(afterLetters!);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0].theme_category).toBe("self_worth");
    expect(parsed[0].letter_text).toContain("comparing yourself");
  });

  test("seeded future letter appears on second submission", async ({
    page,
  }) => {
    await page.goto("/");
    await setupLoggedIn(page);
    await page.reload();

    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    /* First submission — seeds the letter */
    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I feel overwhelmed");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    /* Return home */
    await page.getByRole("button", { name: "Return home" }).click();
    await expect(
      page.getByText("tap to share what's on your mind")
    ).toBeVisible({ timeout: 5000 });

    /* Second submission — letter should appear */
    await page.getByRole("button", { name: "Share what" }).click();
    await page
      .getByPlaceholder("What's weighing on you right now?")
      .fill("I keep comparing myself to everyone around me");
    await page.getByRole("button", { name: "Submit thought" }).click();

    await expect(
      page.getByText("people have felt something like this")
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const banner = page.getByTestId("future-you-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("A note from past you");
    await expect(banner).toContainText("comparing yourself");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "feature-e-demo-seed.png"),
      fullPage: true,
    });
  });
});
