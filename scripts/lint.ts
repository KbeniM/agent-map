import { Glob } from "bun";

type Rule = {
  name: string;
  files: string[];
  allow?: string[];
  check: (line: string, previous: string) => boolean;
};

const CODE = ["{apps,packages}/*/{src,tests}/**/*.{ts,tsx,css}", "e2e/**/*.ts", "scripts/**/*.ts", "*.ts"];
const UI = ["apps/web/src/**/*.tsx"];
const GENERATED = ["apps/web/src/routeTree.gen.ts"];
const SHADCN = ["apps/web/src/components/ui/"];
const MANIFESTS = ["package.json", "{apps,packages}/*/package.json"];

const DIRECTIVE = /^\s*(\/\/\/ <reference|\/\/ biome-ignore|\/\/ @ts-expect-error)/;
const PONYTAIL = /^\s*(\/\/|\/\*) (why: \S|shortcut: [^,]+, \S)/;
const isComment = (line: string) => /^\s*(\/\/|\/\*|\{\/\*)/.test(line);
const withoutStrings = (line: string) => line.replace(/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'|`(\\.|[^`\\])*`/g, '""');
const isProse = (line: string) => isComment(line) && !DIRECTIVE.test(line);
const badLineComment = (line: string, previous: string) => isProse(line) && (!PONYTAIL.test(line) || isProse(previous));
const trailingComment = (line: string) =>
  /\S\s*(\/\/|\/\*)\s/.test(withoutStrings(line).replace(/^\s*(\/\/|\/\*|\{\/\*).*/, ""));

const RULES: Rule[] = [
  {
    name: "comment: only one-line `// why: …` or `// shortcut: <limit>, <upgrade>`",
    files: CODE,
    allow: [...GENERATED, ...SHADCN],
    check: (line, previous) => badLineComment(line, previous) || trailingComment(line),
  },
  {
    name: "naming: `type`, never `kind`",
    allow: ["scripts/lint.ts", ...GENERATED],
    files: CODE,
    check: (line) =>
      /\bkind\b\s*[?:=]|["'`_]kind\b|\b\w*Kind\b|\bkind[A-Z]/.test(withoutStrings(line)) || /["'`]kind["'`]/.test(line),
  },
  {
    name: "design: no hard-coded hex colour in a component; use a token",
    files: UI,
    allow: SHADCN,
    check: (line) => /#[0-9a-fA-F]{3,8}\b/.test(line),
  },
  {
    name: "design: no raw text-size utility; use `type-*`",
    files: UI,
    allow: SHADCN,
    check: (line) => /\btext-(xs|sm|base|lg|[2-9]?xl)\b/.test(line),
  },
  {
    name: "design: no status badge or pill; state is plain text",
    files: UI,
    allow: SHADCN,
    check: (line) => /\bBadge\b|components\/ui\/badge/.test(line),
  },
  {
    name: "architecture: web reaches harnesses only through the bridge, and imports only its types",
    files: UI.concat("apps/web/src/**/*.ts"),
    check: (line) =>
      /from ["'](node:)?(fs|child_process)/.test(line) || /^import (?!type ).*from ["']@api\//.test(line),
  },
  {
    name: "dependencies: exact versions only",
    files: MANIFESTS,
    check: (line) => /":\s*"[\^~]/.test(line),
  },
];

const violations: string[] = [];

for (const rule of RULES) {
  for (const pattern of rule.files) {
    for await (const scanned of new Glob(pattern).scan({ dot: false })) {
      const file = scanned.replaceAll("\\", "/");
      if (file.includes("node_modules") || rule.allow?.some((allowed) => file.startsWith(allowed))) continue;
      const lines = (await Bun.file(file).text()).split("\n");
      lines.forEach((line, i) => {
        if (rule.check(line, lines[i - 1] ?? "")) {
          violations.push(`${file}:${i + 1}  ${rule.name}\n    ${line.trim()}`);
        }
      });
    }
  }
}

for await (const file of new Glob("{apps,packages}/*/src/**/*.test.{ts,tsx}").scan()) {
  violations.push(`${file}  tests: test files live in the workspace's tests/ folder`);
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  console.error(`\n${violations.length} lint violation(s). Rules: docs/coding-standards.md`);
  process.exit(1);
}
