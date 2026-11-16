import { expect, test } from "@playwright/test";
import { BRIDGE } from "../playwright.config";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("lists a Claude Code session from its transcript, with its subagent", async ({ page }) => {
  await page.goto("/");
  const sessions = page.getByRole("region", { name: "Sessions" });
  await expect(sessions.getByRole("link", { name: /Add a checkout page/ })).toContainText("1 subagent · 4 tools");
  await expect(page.locator("canvas")).toBeVisible();
});

test("selecting a session shows its subagent and tool calls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Add a checkout page/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByRole("heading", { name: "Add a checkout page" })).toBeVisible();
  await expect(details.getByRole("link", { name: /scout/ })).toBeVisible();
  await expect(details.getByText("Run the tests")).toBeVisible();

  await details.getByRole("link", { name: /scout/ }).click();
  await expect(details.getByRole("heading", { name: "scout" })).toBeVisible();
  await expect(details.getByText("stripe")).toBeVisible();
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
