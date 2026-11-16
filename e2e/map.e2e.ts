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
  const sessions = page.getByRole("region", { name: "Sessions" });
  const initialBox = await sessions.boundingBox();
  const resizeSessions = page.getByRole("separator", { name: "Resize Sessions panel" });
  await resizeSessions.focus();
  await resizeSessions.press("ArrowRight");
  const resizedBox = await sessions.boundingBox();
  expect(resizedBox?.width).toBeGreaterThan(initialBox?.width ?? 0);

  await page.getByRole("link", { name: /Add a checkout page/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByRole("heading", { name: "Add a checkout page" })).toBeVisible();

  const subagents = details.getByRole("button", { name: "Subagents" });
  await expect(subagents).toHaveAttribute("aria-expanded", "true");
  await expect(details.getByRole("link", { name: /scout/ })).toBeVisible();
  await subagents.click();
  await expect(subagents).toHaveAttribute("aria-expanded", "false");
  await expect(details.getByRole("link", { name: /scout/ })).toBeHidden();
  await subagents.click();
  await expect(subagents).toHaveAttribute("aria-expanded", "true");

  await expect(details.getByText("Run the tests")).toBeVisible();
  await expect(details.getByText("Reading the cart first.")).toBeVisible();

  await details.getByRole("button", { name: "Tool calls display" }).click();
  await page.getByRole("menuitemradio", { name: "Tools: Simple" }).click();
  await expect(details.getByText("Run the tests")).toBeHidden();
  await expect(details.getByText("Bash", { exact: true }).first()).toBeVisible();

  await details.getByRole("button", { name: "Tool calls display" }).click();
  await page.getByRole("menuitemradio", { name: "Tools: Off" }).click();
  await expect(details.getByText("Bash", { exact: true })).toHaveCount(0);
  await expect(details.getByText("Reading the cart first.")).toBeVisible();

  await details.getByRole("button", { name: "Tool calls display" }).click();
  await page.getByRole("menuitemradio", { name: "Tools: Detailed" }).click();
  await expect(details.getByText("Run the tests")).toBeVisible();

  const toolsSection = details.getByRole("button", { name: /Tools/ }).first();
  await toolsSection.click();
  await expect(details.getByRole("button", { name: /Bash/ })).toBeVisible();

  const activity = details.getByRole("button", { name: "Activity" });
  await expect(activity).toHaveAttribute("aria-expanded", "true");
  await activity.click();
  await expect(activity).toHaveAttribute("aria-expanded", "false");
  await expect(details.getByText("Run the tests")).toBeHidden();
  await activity.click();
  await expect(activity).toHaveAttribute("aria-expanded", "true");
  await expect(details.getByText("Run the tests")).toBeVisible();

  await details.getByRole("link", { name: /scout/ }).click();
  await expect(details.getByRole("heading", { name: "scout" })).toBeVisible();
  await expect(details.getByText("stripe")).toBeVisible();
  await expect(details.getByText("Find payment code").first()).toBeVisible();
  await expect(details.getByText("Payments live in src/pay.ts")).toBeVisible();
  await details.getByRole("link", { name: "Add a checkout page" }).click();
  await expect(details.getByRole("heading", { name: "Add a checkout page" })).toBeVisible();
});

test("renders markdown messages cleanly without speaker labels", async ({ page, request }) => {
  const at = new Date().toISOString();
  await request.post(`${BRIDGE}/v1/events`, {
    data: [
      { type: "session.started", sessionId: "md-1", harness: "codex", title: "Markdown run", cwd: "/repo/app", at },
      { type: "message", sessionId: "md-1", agentId: "md-1", role: "user", text: "Check **table**", at },
      {
        type: "message",
        sessionId: "md-1",
        agentId: "md-1",
        role: "assistant",
        model: "gpt-5",
        text: "| Col | Value |\n| --- | --- |\n| Speed | `fast` |",
        at: new Date(Date.now() + 10).toISOString(),
      },
    ],
  });
  await page.goto("/");
  await page.getByRole("link", { name: /Markdown run/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByText("codex", { exact: true })).toBeVisible();
  await expect(details.getByText("gpt-5", { exact: true })).toBeVisible();
  await expect(details.getByText("/repo/app", { exact: true })).toBeVisible();
  await expect(details.locator("table")).toBeVisible();
  await expect(details.locator("th", { hasText: "Col" })).toBeVisible();
  await expect(details.locator("code", { hasText: "fast" })).toBeVisible();
  await expect(details.locator("strong", { hasText: "table" })).toBeVisible();
  await expect(details.getByText("You", { exact: true })).toHaveCount(0);
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
  await expect(panel.getByText("T3 Code", { exact: true })).toBeVisible();
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
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove session" }).click();
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

test("display settings expose dropdown customization and reset defaults", async ({ page }) => {
  await page.goto("/settings?tab=display");
  const panel = page.getByRole("region", { name: "Settings" });
  await expect(panel.getByRole("slider", { name: "Connector animation speed" })).toBeVisible();
  await expect(panel.getByRole("slider", { name: "Pan speed" })).toBeVisible();

  await panel.getByRole("button", { name: "Graph spacing" }).click();
  await page.getByRole("menuitemradio", { name: "Spread" }).click();
  await expect(panel.getByRole("button", { name: "Graph spacing" })).toContainText("Spread");

  await panel.getByRole("button", { name: "Node labels" }).click();
  await page.getByRole("menuitemradio", { name: "Hidden" }).click();
  await expect(panel.getByRole("button", { name: "Node labels" })).toContainText("Hidden");

  await panel.getByRole("button", { name: "Reset display defaults" }).click();
  await expect(panel.getByRole("button", { name: "Graph spacing" })).toContainText("Balanced");
  await expect(panel.getByRole("button", { name: "Node labels" })).toContainText("All agents");
});

test("graph toolbar pauses physics and error filter isolates failed sessions", async ({ page, request }) => {
  const at = new Date().toISOString();
  await request.post(`${BRIDGE}/v1/events`, {
    data: [
      { type: "session.started", sessionId: "ok-1", harness: "codex", title: "Clean build", at },
      { type: "tool.started", sessionId: "ok-1", agentId: "ok-1", toolId: "o1", name: "Bash", at },
      { type: "tool.finished", sessionId: "ok-1", toolId: "o1", ok: true, at },
      { type: "session.started", sessionId: "err-1", harness: "codex", title: "Failing build", at },
      { type: "tool.started", sessionId: "err-1", agentId: "err-1", toolId: "e1", name: "Bash", at },
      { type: "tool.finished", sessionId: "err-1", toolId: "e1", ok: false, at },
    ],
  });
  await page.goto("/");

  const pause = page.getByRole("button", { name: "Pause physics" });
  await pause.click();
  await expect(page.getByRole("button", { name: "Resume physics" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Fit graph" }).click();
  await page.getByRole("button", { name: "Reset layout" }).click();

  const sessions = page.getByRole("region", { name: "Sessions" });
  await expect(sessions.getByRole("link", { name: /Clean build/ })).toBeVisible();
  await sessions.getByRole("switch", { name: "Errors only" }).click();
  await expect(sessions.getByRole("link", { name: /Failing build/ })).toBeVisible();
  await expect(sessions.getByRole("link", { name: /Clean build/ })).toHaveCount(0);

  await sessions.getByRole("link", { name: /Failing build/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByRole("button", { name: "Filter failed tools" })).toContainText("Errors (1)");
});

test("clicking an open top-left menu closes it and clicking again reopens it", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  const sessionsLink = nav.getByRole("link", { name: "Sessions" });
  const settingsLink = nav.getByRole("link", { name: "Settings" });

  await expect(page.getByRole("region", { name: "Sessions" })).toBeVisible();
  await expect(sessionsLink).toHaveAttribute("aria-expanded", "true");

  await sessionsLink.click();
  await expect(page.getByRole("region", { name: "Sessions" })).toHaveCount(0);
  await expect(sessionsLink).toHaveAttribute("aria-expanded", "false");

  await sessionsLink.click();
  await expect(page.getByRole("region", { name: "Sessions" })).toBeVisible();
  await expect(sessionsLink).toHaveAttribute("aria-expanded", "true");

  await sessionsLink.click();
  await expect(page.getByRole("region", { name: "Sessions" })).toHaveCount(0);
  await settingsLink.click();
  await expect(page.getByRole("region", { name: "Settings" })).toBeVisible();
  await expect(settingsLink).toHaveAttribute("aria-expanded", "true");

  await settingsLink.click();
  await expect(page.getByRole("region", { name: "Settings" })).toHaveCount(0);
  await expect(settingsLink).toHaveAttribute("aria-expanded", "false");

  await settingsLink.click();
  await expect(page.getByRole("region", { name: "Settings" })).toBeVisible();
});

test("activity displays oldest-first like a chat and shows Scroll to end when scrolled up", async ({
  page,
  request,
}) => {
  const base = Date.now();
  const events: object[] = [
    {
      type: "session.started",
      sessionId: "chat-1",
      harness: "codex",
      title: "Chat activity",
      at: new Date(base).toISOString(),
    },
  ];
  for (let i = 1; i <= 25; i++) {
    events.push({
      type: "message",
      sessionId: "chat-1",
      agentId: "chat-1",
      role: i % 2 === 1 ? "user" : "assistant",
      text: `Step message ${i}`,
      at: new Date(base + i * 1000).toISOString(),
    });
  }
  await request.post(`${BRIDGE}/v1/events`, { data: events });

  await page.goto("/");
  await page.getByRole("link", { name: /Chat activity/ }).click();
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByText("Step message 25", { exact: true })).toBeVisible();

  const viewport = details.locator('[data-slot="scroll-area-viewport"]');
  await expect
    .poll(() => viewport.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
    .toBeLessThanOrEqual(24);
  await expect(details.getByRole("button", { name: "Scroll to end" })).toHaveCount(0);

  const firstBeforeLatest = await details.evaluate((root) => {
    const texts = [...root.querySelectorAll("p")].map((el) => el.textContent?.trim());
    return texts.indexOf("Step message 1") < texts.indexOf("Step message 25");
  });
  expect(firstBeforeLatest).toBe(true);

  await viewport.evaluate((el) => {
    el.scrollTop = 0;
  });
  const scrollToEndBtn = details.getByRole("button", { name: "Scroll to end" });
  await expect(scrollToEndBtn).toBeVisible();

  await scrollToEndBtn.click();
  await expect
    .poll(() => viewport.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
    .toBeLessThanOrEqual(24);
  await expect(scrollToEndBtn).toHaveCount(0);
});
