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

test("a hook payload from Claude Code appears live", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Add a checkout page/ })).toBeVisible();
  const hook = (body: object) => request.post(`${BRIDGE}/v1/hooks/claude-code`, { data: body });
  expect(
    (
      await hook({
        session_id: "cloud-1",
        hook_event_name: "SessionStart",
        session_title: "Cloud refactor",
        model: "claude-opus-5",
      })
    ).status(),
  ).toBe(202);
  await hook({
    session_id: "cloud-1",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_use_id: "h1",
    tool_input: { command: "bun test" },
  });
  await page.getByRole("link", { name: /Cloud refactor/ }).click();
  await expect(page.getByRole("region", { name: "Details" }).getByText("bun test")).toBeVisible();
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

test("settings list every harness with its setup, and the bridge can be renamed", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.getByRole("region", { name: "Settings" });
  await expect(panel.getByText("Claude Code", { exact: true })).toBeVisible();
  for (const name of [
    "Codex",
    "Cursor",
    "GitHub Copilot CLI",
    "Gemini CLI",
    "Grok Build",
    "Antigravity",
    "OpenCode",
    "Cline",
    "Windsurf",
  ]) {
    await expect(panel.getByText(name, { exact: true })).toBeVisible();
  }
  await panel.getByRole("listitem").filter({ hasText: "Cursor" }).getByRole("button", { name: "Set up" }).click();
  await expect(panel.getByText("~/.cursor/hooks.json")).toBeVisible();

  await panel.getByRole("tab", { name: "Bridges" }).click();
  await panel.getByRole("button", { name: "Edit" }).click();
  await panel.getByLabel("Name").fill("Laptop");
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByText("Laptop")).toBeVisible();
  await expect(panel.getByText("Connected")).toBeVisible();
});

test("a bridge with a wrong URL is reported and its form validates", async ({ page }) => {
  await page.goto("/settings?tab=bridges");
  const panel = page.getByRole("region", { name: "Settings" });
  await panel.getByRole("button", { name: "Add bridge" }).click();
  await panel.getByLabel("Name").fill("Cloud");
  await panel.getByLabel("URL").fill("not a url");
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByText("Enter a URL that starts with http:// or https://")).toBeVisible();
});

test("filters narrow the session list", async ({ page }) => {
  await page.goto("/");
  const sessions = page.getByRole("region", { name: "Sessions" });
  await expect(sessions.getByRole("link", { name: /Add a checkout page/ })).toBeVisible();
  await sessions.getByLabel("Search sessions").fill("nothing like this");
  await expect(sessions.getByText("No session matches these filters.")).toBeVisible();
  await sessions.getByRole("button", { name: "Clear filters" }).click();
  await expect(sessions.getByLabel("Search sessions")).toHaveValue("");
  await sessions.getByLabel("Search sessions").fill("checkout");
  await expect(sessions.getByRole("link", { name: /Add a checkout page/ })).toBeVisible();
});

test("removing a session deletes it from the bridge", async ({ page, request }) => {
  const at = new Date().toISOString();
  await request.post(`${BRIDGE}/v1/events`, {
    data: { type: "session.started", sessionId: "doomed", harness: "custom", title: "Throwaway run", at },
  });
  await page.goto("/");
  await page.getByRole("link", { name: /Throwaway run/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await details.getByRole("button", { name: "Remove session" }).click();
  await details.getByRole("button", { name: "Remove session" }).last().click();
  await expect(page.getByRole("link", { name: /Throwaway run/ })).toHaveCount(0);
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
