import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "../src/env";

describe("env", () => {
  test("treats empty string variables from .env as unset", () => {
    const parsed = parseEnv({
      HOST: "",
      BRIDGE_PORT: "",
      WEB_ORIGIN: "",
      RANCHER_TOKEN: "",
      DATA_DIR: "",
      STATIC_DIR: "",
      SINCE_HOURS: "",
      RETENTION_DAYS: "",
    });
    expect(parsed.DATA_DIR).toBe(join(homedir(), ".rancher"));
    expect(parsed.HOST).toBe("127.0.0.1");
    expect(parsed.BRIDGE_PORT).toBe(4000);
    expect(parsed.WEB_ORIGIN).toBe("http://localhost:5173");
    expect(parsed.SINCE_HOURS).toBe(24);
    expect(parsed.RETENTION_DAYS).toBe(7);
  });
});
