import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const excludedDirectories = new Set([
  ".dagu-source",
  ".git",
  "node_modules",
  "superpowers",
]);
const markdownFiles = [];

function findDaguBin() {
  const configuredBin = process.env.DAGU_BIN || process.argv[2];
  if (configuredBin) {
    return configuredBin;
  }

  const siblingBuild = resolve(docsRoot, "..", ".local", "bin", "dagu");
  try {
    accessSync(siblingBuild, constants.X_OK);
    return siblingBuild;
  } catch {
    return "dagu";
  }
}

const daguBin = findDaguBin();

function commandOutput(result) {
  return [result.stdout, result.stderr]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");
}

const versionResult = spawnSync(daguBin, ["version"], { encoding: "utf8" });
if (versionResult.status !== 0) {
  console.error(formatCommandFailure(versionResult));
  process.exit(1);
}
const validatorVersion = commandOutput(versionResult);
const validatorLabel = `${daguBin} (${validatorVersion})`;
console.log(`Using Dagu validator: ${validatorLabel}`);

function validationEnvironment(homeDir) {
  return {
    ...process.env,
    DAGU_AUTH_MODE: "none",
    DAGU_HOME: homeDir,
    DAGU_SKIP_EXAMPLES: "true",
  };
}

const compatibilityDir = mkdtempSync(join(tmpdir(), "dagu-doc-validator-"));
let compatibilityFailure = "";
try {
  const compatibilityFixture = join(compatibilityDir, "workflow.yaml");
  writeFileSync(
    compatibilityFixture,
    'steps:\n  - id: compatibility_check\n    run: echo "ok"\n',
  );
  const compatibilityResult = spawnSync(
    daguBin,
    ["validate", compatibilityFixture],
    {
      encoding: "utf8",
      env: validationEnvironment(join(compatibilityDir, "home")),
      timeout: 20_000,
    },
  );
  if (compatibilityResult.status !== 0) {
    compatibilityFailure =
      formatCommandFailure(compatibilityResult).slice(0, 800) ||
      "The compatibility check did not complete successfully.";
  }
} finally {
  rmSync(compatibilityDir, { recursive: true, force: true });
}

if (compatibilityFailure) {
  console.error(
    `The selected Dagu binary cannot validate the workflow syntax used by these docs.\n` +
      `Set DAGU_BIN to a current Dagu build and run the command again.\n\n` +
      compatibilityFailure,
  );
  process.exit(1);
}

function collectMarkdown(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (extname(path) === ".md") {
      markdownFiles.push(path);
    }
    return;
  }

  for (const entry of readdirSync(path)) {
    if (!excludedDirectories.has(entry)) {
      collectMarkdown(join(path, entry));
    }
  }
}

function isWorkflow(yaml) {
  return (
    /^steps:\s*(?:#.*)?$/m.test(yaml) ||
    /^type:\s*(?:graph|chain|agent|build)\b/m.test(yaml)
  );
}

function isExcluded(source, fenceStart) {
  const prefix = source.slice(0, fenceStart);
  return /<!--\s*dagu-example:\s*no-validate\b[\s\S]*?-->\s*$/.test(prefix);
}

function formatCommandFailure(result) {
  if (result.error?.code === "ENOENT") {
    return `Dagu executable not found: ${daguBin}`;
  }
  if (result.error) {
    return result.error.message;
  }

  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

collectMarkdown(docsRoot);

const fixtureDir = mkdtempSync(join(tmpdir(), "dagu-doc-examples-"));
const failures = [];
let candidateCount = 0;
let excludedCount = 0;

try {
  for (const file of markdownFiles.sort()) {
    const source = readFileSync(file, "utf8");
    const fencePattern = /^```(?:yaml|yml)(?:[^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
    let match;

    while ((match = fencePattern.exec(source)) !== null) {
      const yaml = match[1];
      if (!isWorkflow(yaml)) {
        continue;
      }

      if (isExcluded(source, match.index)) {
        excludedCount++;
        continue;
      }

      candidateCount++;
      const line = source.slice(0, match.index).split("\n").length;
      const fixture = join(
        fixtureDir,
        `${String(candidateCount).padStart(4, "0")}.yaml`,
      );
      writeFileSync(fixture, yaml);

      const result = spawnSync(daguBin, ["validate", fixture], {
        encoding: "utf8",
        env: validationEnvironment(join(fixtureDir, "home")),
        timeout: 20_000,
      });

      if (result.status !== 0) {
        failures.push({
          file: relative(docsRoot, file),
          line,
          output: formatCommandFailure(result),
        });
      }
    }
  }
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\nDagu validator: ${validatorLabel}`);
  for (const failure of failures) {
    console.error(`\n${failure.file}:${failure.line}`);
    console.error(failure.output);
  }
  console.error(
    `\nFailed to validate ${failures.length} of ${candidateCount} workflow examples.`,
  );
  process.exit(1);
}

console.log(
  `Validated ${candidateCount} workflow examples (${excludedCount} explicitly contextual or invalid examples skipped).`,
);
