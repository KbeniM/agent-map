import { defineConfig, devices } from "@playwright/test";

const BRIDGE = "http://localhost:4100";
const WEB = "http://localhost:5174";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: WEB, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // why: headless Chromium has no GPU, and the map needs WebGL through SwiftShader
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
          executablePath: process.env.CHROMIUM_PATH,
        },
      },
    },
  ],
  webServer: [
    {
      command: "bun apps/api/src/index.ts",
      url: `${BRIDGE}/v1/harnesses`,
      reuseExistingServer: false,
      env: {
        BRIDGE_PORT: "4100",
        WEB_ORIGIN: WEB,
        CLAUDE_PROJECTS_DIR: "e2e/fixtures/projects",
        SINCE_HOURS: "1000000",
      },
    },
    {
      command: "bun run --cwd apps/web dev --port 5174 --strictPort",
      url: WEB,
      reuseExistingServer: false,
      env: { VITE_BRIDGE_URL: BRIDGE },
    },
  ],
});

export { BRIDGE };
