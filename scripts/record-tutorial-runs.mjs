// Runs every tutorial lesson DAG on a real Dagu server and saves what each
// run did as replay data for the RunReplay component. Also fails when a
// lesson no longer ends in the status its page describes.
//
//   pnpm record:tutorial [lesson-name ...]
//
// Set DAGU_BIN to choose the Dagu executable.

import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { docsRoot, findDaguBin } from "./dagu-bin.mjs";

const dagDirectory = join(docsRoot, "public", "tutorial", "dags");
const runDirectory = join(docsRoot, "tutorial", "runs");

const POLL_INTERVAL_MS = 100;
const RUN_TIMEOUT_MS = 90_000;
const WAITING_RESPONSE_DELAY_MS = 1_500;
const LOG_LINE_LIMIT = 60;
const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "partially_succeeded",
  "aborted",
  "rejected",
]);
const HANDLER_KEYS = ["onInit", "onSuccess", "onFailure", "onAbort", "onWait", "onExit"];
const IDLE_STATUSES = new Set(["not_started", "waiting", "queued"]);

// Lessons whose run does not simply succeed on its own.
const lessonOverrides = {
  "tutorial-06-failures-and-retries": { expectedStatus: "partially_succeeded" },
  "tutorial-09-approvals": {
    waitingResponses: {
      build: { path: "steps/build/approve", body: {} },
      choose_target: {
        path: "human-tasks/choose_target/complete",
        body: { environment: "production" },
      },
    },
  },
};

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

class DaguServer {
  constructor(daguBin, workDir) {
    this.daguBin = daguBin;
    this.workDir = workDir;
    this.dagsDir = join(workDir, "dags");
  }

  async start() {
    const [port, coordinatorPort] = [await freePort(), await freePort()];
    this.baseUrl = `http://127.0.0.1:${port}/api/v1`;
    this.process = spawn(
      this.daguBin,
      [
        "start-all",
        "--dags", this.dagsDir,
        "--host", "127.0.0.1",
        "--port", String(port),
        "--coordinator.port", String(coordinatorPort),
      ],
      {
        env: {
          ...process.env,
          DAGU_HOME: join(this.workDir, "home"),
          DAGU_AUTH_MODE: "none",
          DAGU_SKIP_EXAMPLES: "true",
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    this.process.stderr.on("data", (chunk) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-4000);
    });
    this.stderrTail = "";

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (this.process.exitCode !== null) {
        break;
      }
      try {
        await this.request("GET", "health");
        return;
      } catch {
        await sleep(250);
      }
    }
    throw new Error(`Dagu server did not become healthy.\n${this.stderrTail}`);
  }

  stop() {
    this.process?.kill("SIGTERM");
  }

  async request(method, path, body) {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }
}

// Reads `action:` and `approval:` per step ID from the first YAML document,
// so the replay can label each node the way the lesson file writes it.
function stepLabels(yaml) {
  const [firstDocument] = yaml.split(/^---\s*$/m);
  const labels = {};
  let current;
  for (const line of firstDocument.split("\n")) {
    const id = line.match(/^ {2}- id:\s*(\S+)/);
    if (id) {
      current = { action: "run", approval: false };
      labels[id[1]] = current;
      continue;
    }
    const action = line.match(/^ {4}action:\s*(\S+)/);
    if (action && current) {
      current.action = action[1];
    }
    if (/^ {4}approval:/.test(line) && current) {
      current.approval = true;
    }
  }
  return labels;
}

function graphSteps(details, labels) {
  return details.nodes.map(({ step }) => {
    const routes = step.router?.routes ?? [];
    return {
      id: step.name,
      depends: step.depends ?? [],
      routesTo: [...new Set(routes.flatMap((route) => route.targets))],
      ...(labels[step.name] ?? { action: "run", approval: false }),
    };
  });
}

function handlerNodes(details) {
  return HANDLER_KEYS.filter((key) => details[key]).map((key) => [key, details[key]]);
}

class Timeline {
  constructor(startedAt) {
    this.startedAt = startedAt;
    this.events = [];
    this.lastStatus = new Map();
  }

  elapsed(time = Date.now()) {
    return Math.max(0, time - this.startedAt);
  }

  push(target, status, t) {
    const previousTime = this.events.findLast((event) => event.target === target)?.t ?? 0;
    this.events.push({ t: Math.max(t, previousTime), target, status });
    this.lastStatus.set(target, status);
  }

  // Server timestamps are more precise than the polling interval, so they
  // place a step's start and finish when the step ran without pausing.
  record(target, status, node) {
    const previous = this.lastStatus.get(target) ?? "not_started";
    if (previous === status && this.lastStatus.has(target)) {
      return;
    }
    const startedAt = node?.startedAt ? this.elapsed(Date.parse(node.startedAt)) : undefined;
    const finishedAt = node?.finishedAt ? this.elapsed(Date.parse(node.finishedAt)) : undefined;
    const settled = !IDLE_STATUSES.has(status) && status !== "running";

    if (previous === "not_started" && status !== "not_started" && startedAt !== undefined) {
      if (status === "running") {
        this.push(target, status, startedAt);
        return;
      }
      if (settled || status === "waiting") {
        this.push(target, "running", startedAt);
      }
    }
    const fromRun = this.lastStatus.get(target) === "running";
    this.push(target, status, settled && fromRun && finishedAt !== undefined ? finishedAt : this.elapsed());
  }

  // Events sorted by time and shifted so the run starts at zero.
  finish() {
    const sorted = [...this.events].sort((a, b) => a.t - b.t);
    const origin = sorted.find((event) => event.status !== "not_started")?.t ?? 0;
    return sorted.map((event) => ({ ...event, t: Math.max(0, event.t - origin) }));
  }

  observe(details) {
    this.record("$run", details.statusLabel);
    for (const node of details.nodes) {
      this.record(node.step.name, node.statusLabel, node);
    }
    for (const [key, node] of handlerNodes(details)) {
      this.record(key, node.statusLabel, node);
    }
  }
}

async function stepLog(server, runPath, stepName, stream) {
  try {
    const log = await server.request(
      "GET",
      `${runPath}/steps/${encodeURIComponent(stepName)}/log?stream=${stream}&tail=${LOG_LINE_LIMIT}`,
    );
    return log.content ?? "";
  } catch {
    return "";
  }
}

async function stepOutputs(server, runPath, stepName) {
  try {
    const { outputs } = await server.request(
      "GET",
      `${runPath}/steps/${encodeURIComponent(stepName)}/outputs`,
    );
    return Object.fromEntries(outputs.map(({ name, value }) => [name, value]));
  } catch {
    return {};
  }
}

async function nodeResult(server, runPath, node) {
  const name = node.step.name;
  return {
    status: node.statusLabel,
    retries: node.retryCount ?? 0,
    executions: node.doneCount ?? 0,
    stdout: await stepLog(server, runPath, name, "stdout"),
    stderr: await stepLog(server, runPath, name, "stderr"),
    outputs: await stepOutputs(server, runPath, name),
    subRuns: (node.subRuns ?? []).map(({ dagName, params }) => ({ dag: dagName, params })),
  };
}

async function recordLesson(server, name, override) {
  const labels = stepLabels(readFileSync(join(server.dagsDir, `${name}.yaml`), "utf8"));
  const timeline = new Timeline(Date.now());
  const { dagRunId } = await server.request("POST", `dags/${name}/start`, {});
  const runPath = `dag-runs/${name}/${dagRunId}`;
  const answered = new Map();
  const deadline = Date.now() + RUN_TIMEOUT_MS;

  let details;
  while (Date.now() < deadline) {
    try {
      ({ dagRunDetails: details } = await server.request("GET", runPath));
    } catch {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    timeline.observe(details);
    if (TERMINAL_STATUSES.has(details.statusLabel)) {
      break;
    }

    for (const node of details.nodes) {
      const response = override.waitingResponses?.[node.step.name];
      if (node.statusLabel !== "waiting" || !response) {
        continue;
      }
      const waitingSince = answered.get(node.step.name) ?? Date.now();
      answered.set(node.step.name, waitingSince);
      if (waitingSince !== -1 && Date.now() - waitingSince >= WAITING_RESPONSE_DELAY_MS) {
        await server.request("POST", `${runPath}/${response.path}`, response.body);
        answered.set(node.step.name, -1);
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (!details || !TERMINAL_STATUSES.has(details.statusLabel)) {
    throw new Error(`${name}: run ${dagRunId} did not finish within ${RUN_TIMEOUT_MS} ms`);
  }

  const results = {};
  for (const node of details.nodes) {
    results[node.step.name] = await nodeResult(server, runPath, node);
  }
  for (const [key, node] of handlerNodes(details)) {
    results[key] = await nodeResult(server, runPath, node);
  }

  const events = timeline.finish();
  return {
    dag: name,
    status: details.statusLabel,
    durationMs: events.at(-1)?.t ?? 0,
    steps: graphSteps(details, labels),
    handlers: handlerNodes(details).map(([key]) => key),
    events,
    results,
  };
}

function lessonNames() {
  const requested = new Set(process.argv.slice(2));
  return readdirSync(dagDirectory)
    .filter((entry) => extname(entry) === ".yaml")
    .map((entry) => basename(entry, ".yaml"))
    .filter((name) => requested.size === 0 || requested.has(name))
    .sort();
}

async function main() {
  const daguBin = findDaguBin();
  const version = spawnSync(daguBin, ["version"], { encoding: "utf8" });
  if (version.status !== 0) {
    throw new Error(`Cannot run ${daguBin}: ${version.stderr || version.error?.message}`);
  }
  console.log(`Recording with ${daguBin} (${version.stdout.trim()})`);

  const workDir = mkdtempSync(join(tmpdir(), "dagu-tutorial-"));
  cpSync(dagDirectory, join(workDir, "dags"), { recursive: true });
  mkdirSync(runDirectory, { recursive: true });

  const server = new DaguServer(daguBin, workDir);
  const failures = [];
  try {
    await server.start();
    for (const name of lessonNames()) {
      const override = lessonOverrides[name] ?? {};
      const expectedStatus = override.expectedStatus ?? "succeeded";
      try {
        const replay = await recordLesson(server, name, override);
        writeFileSync(join(runDirectory, `${name}.json`), `${JSON.stringify(replay, null, 2)}\n`);
        const mark = replay.status === expectedStatus ? "ok" : "UNEXPECTED";
        console.log(`${mark.padEnd(10)} ${name}: ${replay.status} in ${replay.durationMs} ms`);
        if (replay.status !== expectedStatus) {
          failures.push(`${name}: expected ${expectedStatus}, got ${replay.status}`);
        }
      } catch (error) {
        failures.push(`${name}: ${error.message}`);
      }
    }
  } finally {
    server.stop();
    rmSync(workDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\n${failures.join("\n")}`);
    process.exit(1);
  }
}

await main();
