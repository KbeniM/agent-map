import { expect, test } from "@playwright/test";
import { BRIDGE } from "../playwright.config";

test("lists a Claude Code session from its transcript, with its subagent", async ({ page }) => {
  await page.goto("/");
  const sessions = page.getByRole("region", { name: "Sessions" });
  await expect(sessions.getByRole("link", { name: /Add a checkout page/ })).toContainText("1 subagent · 5 tools");
  await expect(page.locator("canvas")).toBeVisible();
});

test("selecting a session shows its subagent and tool calls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Add a checkout page/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByRole("heading", { name: "Add a checkout page" })).toBeVisible();
  await expect(details.getByRole("link", { name: /scout/ })).toBeVisible();
  await expect(details.getByText("Run the tests")).toBeVisible();

  await expect(details.getByText("Reading the cart first.")).toBeVisible();

  await details.getByRole("link", { name: /scout/ }).click();
  await expect(details.getByRole("heading", { name: "scout" })).toBeVisible();
  await expect(details.getByText("stripe")).toBeVisible();
  await expect(details.getByText("Find payment code").first()).toBeVisible();
  await expect(details.getByText("Payments live in src/pay.ts")).toBeVisible();
});

test("a pushed event from any harness appears live", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Add a checkout page/ })).toBeVisible();
  const at = new Date().toISOString();
  const response = await request.post(`${BRIDGE}/v1/events`, {
    data: [
      { type: "session.started", sessionId: "pushed", harness: "custom", title: "Nightly eval", at },
      { type: "tool.started", sessionId: "pushed", agentId: "pushed", toolId: "p1", name: "search", at },
    ],
  });
  expect(response.status()).toBe(202);
  await page.getByRole("link", { name: /Nightly eval/ }).click();
  await expect(page.getByRole("region", { name: "Details" }).getByText("running")).toBeVisible();
});

test("connect lists the harnesses the bridge reads", async ({ page }) => {
  await page.goto("/connect");
  const panel = page.getByRole("region", { name: "Connect" });
  await expect(panel.getByText("Claude Code")).toBeVisible();
  await expect(panel.getByText("e2e/fixtures/projects")).toBeVisible();
  await expect(panel.getByText("Any harness")).toBeVisible();
});

test("the theme follows the system until the toggle picks one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Theme: System" }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Theme: Light" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
  await expect(html).toHaveClass(/dark/);
});

test("the map switches between 3D and 2D and remembers it", async ({ page }) => {
  await page.goto("/");
  const view = page.getByRole("group", { name: "View" });
  await expect(view.getByRole("button", { name: "3d" })).toHaveAttribute("aria-pressed", "true");
  await view.getByRole("button", { name: "2d" }).click();
  await expect(view.getByRole("button", { name: "2d" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(view.getByRole("button", { name: "2d" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("canvas")).toBeVisible();
});
