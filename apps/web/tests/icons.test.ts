import { describe, expect, test } from "bun:test";
import { HugeiconsIcon } from "@hugeicons/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AGENT_ICON, iconMarkup, toolIcon } from "../src/lib/icons";

describe("iconMarkup", () => {
  test("matches the markup HugeiconsIcon renders", () => {
    for (const icon of [AGENT_ICON, toolIcon("Read"), toolIcon("Bash"), toolIcon("mcp__github__get_issue")]) {
      const rendered = renderToStaticMarkup(
        createElement(HugeiconsIcon, { icon, size: 128, color: "white", strokeWidth: 1.75 }),
      );
      expect(iconMarkup(icon, 128, 1.75)).toBe(rendered.replace(' class=""', ""));
    }
  });
});
