# Run Harness Agents in Docker Sandboxes (sbx)

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) (`sbx`) runs an agent
CLI inside a microVM. A custom harness provider can call `sbx exec`, so Dagu
starts `sbx` on the worker and the agent runs inside the sandbox.

Compared with a harness `container:`:

| | Harness `container:` | Docker Sandboxes |
|-|----------------------|------------------|
| Isolation | Container that shares the host kernel | MicroVM with its own kernel |
| API keys | Passed into the container through `container.env` or mounted files | Stored on the host. A host proxy adds them to outgoing HTTPS requests, and the sandbox sees only a placeholder. |
| Network | Container network mode | Allowlist managed with `sbx policy` |
| Lifecycle | Dagu creates and removes the container | You or the DAG create and remove the sandbox with `sbx` |
| Hosts | Any host with Docker or Podman | Apple silicon macOS, Windows 11, Ubuntu 24.04 or later with KVM |

The examples on this page were checked with `sbx` 0.49.

## Requirements

- One of the hosts Docker supports for local sandboxes: macOS 14 or later on
  Apple silicon, Windows 11 on x86-64 with Windows Hypervisor Platform enabled,
  or Ubuntu 24.04 or later with KVM. See
  [Install Docker Sandboxes](https://docs.docker.com/ai/sandboxes/install/).
- A Docker account.
- `sbx` in the `PATH` of the Dagu process that executes the step. That is the
  server, scheduler, or worker process, not your shell.

A Dagu process that runs inside a container or a Kubernetes pod cannot start
sandboxes unless that environment supports nested virtualization. With
distributed execution, install `sbx` and sign in on each worker that runs these
steps, then route the steps there with `worker_selector`.

## One-Time Setup

On macOS:

```sh
brew trust docker/tap
brew install docker/tap/sbx
sbx login
sbx policy init balanced
echo "$ANTHROPIC_API_KEY" | sbx secret set anthropic
```

- `sbx login` opens a browser. On a host without a browser, sign in with a
  Docker personal access token:
  `echo "$DOCKER_PAT" | sbx login --username <docker-id> --password-stdin`.
- `sbx policy init balanced` allows AI services and package registries and
  blocks other outbound traffic. Add hosts with `sbx policy allow`.
- `sbx secret set` stores the key in the OS keychain. It applies to every local
  sandbox, including sandboxes that already exist. Other services include
  `openai`, `google`, `github`, and `copilot`. Run `sbx secret set --help` for
  the full list.

To use a Claude subscription instead of an API key, sign in once inside a
long-lived sandbox (see the next section). Run
`sbx run --name dagu-claude claude`, enter `/login`, then exit. The login state
stays in that sandbox until it is removed.

## Long-Lived Sandbox

Create the sandbox once, with the repository as its workspace:

```sh
sbx create --name dagu-claude claude /path/to/repo
```

Then point a custom harness provider at it:

```yaml
working_dir: /path/to/repo

harnesses:
  claude_sbx:
    binary: sbx
    prefix_args: [exec, dagu-claude, claude, --dangerously-skip-permissions]
    prompt_mode: flag
    prompt_flag: -p

handler_on:
  exit:
    run: sbx stop dagu-claude

steps:
  - id: review
    action: harness.run
    output: REVIEW
    with:
      provider: claude_sbx
      model: sonnet
      prompt: |
        Review the uncommitted changes and list concrete bugs.
```

Dagu runs this command on the worker:

```text
sbx exec dagu-claude claude --dangerously-skip-permissions -p "Review the uncommitted changes..." --model sonnet
```

- The workspace appears inside the sandbox at the same absolute path as on the
  host. `sbx exec` starts in that directory. Add `-w <path>` after `exec` to
  start somewhere else.
- `sbx exec` starts a stopped sandbox first. Installed tools, caches, and agent
  login state are kept.
- The agent's stdout becomes the step's stdout, so `output:` captures it. Its
  exit code becomes the step's exit code, so retries and `with.fallback` work
  as they do for a host provider.
- Claude Code in `-p` mode cannot answer approval prompts.
  `--dangerously-skip-permissions` lets it edit files and run commands, and the
  sandbox limits what those commands can reach.

The `exit` handler matters. When a step is stopped or times out, Dagu ends the
`sbx exec` process on the worker, but the agent inside the sandbox keeps
running. `sbx stop` halts everything in the sandbox. The next run starts it
again in a few seconds.

Give each DAG its own sandbox. The `exit` handler of one DAG would otherwise
stop an agent that another DAG is running.

## Fresh Sandbox per Run

Create the sandbox in a step and remove it in the `exit` handler. With
`--clone`, the agent works on a private Git clone inside the sandbox, and the
host repository is mounted read-only.

```yaml
type: chain
working_dir: /path/to/repo

harnesses:
  claude_sbx:
    binary: sbx
    prefix_args: [exec, dagu-fix, claude, --dangerously-skip-permissions]
    prompt_mode: flag
    prompt_flag: -p

handler_on:
  exit:
    run: sbx rm --force dagu-fix

steps:
  - id: sandbox
    run: |
      sbx rm --force dagu-fix >/dev/null 2>&1 || true
      sbx create --name dagu-fix --clone --no-progress claude .

  - id: fix
    action: harness.run
    with:
      provider: claude_sbx
      prompt: |
        Fix the failing unit tests and commit the change.

  - id: collect
    run: |
      git fetch sandbox-dagu-fix
      git branch -f dagu-fix "sandbox-dagu-fix/$(git branch --show-current)"
```

- `sbx create --clone` adds a Git remote named `sandbox-<name>` to the host
  repository. The clone starts on the host's current branch.
- The `collect` step copies the agent's commits to the local branch
  `dagu-fix`. `sbx rm` removes the remote, so fetch before the `exit` handler
  runs.
- The first command in the `sandbox` step removes a sandbox left behind by a
  run that ended without its `exit` handler, such as a run interrupted by a
  host restart.
- Creating a sandbox boots a VM and may pull the agent image, so it takes
  longer than `sbx exec` into an existing sandbox.

Drop `--clone` to mount the repository read-write instead. The agent's edits
then appear in the host working tree immediately.

## Environment Variables

DAG `env:`, params, and step outputs reach the `sbx exec` process on the
worker, not the agent inside the sandbox. To pass a variable through, add
`-e NAME` after `exec`. A bare name takes the value from the step's
environment:

```yaml
env:
  - TICKET_ID: PROJ-123

harnesses:
  claude_sbx:
    binary: sbx
    prefix_args: [exec, -e, TICKET_ID, dagu-claude, claude, --dangerously-skip-permissions]
    prompt_mode: flag
    prompt_flag: -p

steps:
  - id: triage
    action: harness.run
    with:
      provider: claude_sbx
      prompt: |
        Run ./scripts/fetch-ticket.sh, which reads the TICKET_ID
        environment variable, and summarize the root cause.
```

Do not pass API keys with `-e`. The value enters the sandbox, where the agent
and anything it runs can read it. Store keys with `sbx secret set` instead.

## Other Agents

The provider shape is the same for every agent: `exec`, the sandbox name, then
the agent's non-interactive command.

| Agent | `sbx create` agent | `prefix_args` | Prompt | `sbx secret set` service |
|-------|--------------------|---------------|--------|--------------------------|
| Claude Code | `claude` | `[exec, NAME, claude, --dangerously-skip-permissions]` | `prompt_mode: flag`, `prompt_flag: -p` | `anthropic` |
| Codex | `codex` | `[exec, NAME, codex, exec]` | `prompt_mode: arg` | `openai` |
| Gemini CLI | `gemini` | `[exec, NAME, gemini]` | `prompt_mode: flag`, `prompt_flag: -p` | `google` |
| GitHub Copilot CLI | `copilot` | `[exec, NAME, copilot]` | `prompt_mode: flag`, `prompt_flag: -p` | `copilot` |
| OpenCode | `opencode` | `[exec, NAME, opencode, run]` | `prompt_mode: arg` | the model provider's service |

Add each agent's own flag for running without approval prompts, as
`--dangerously-skip-permissions` does for Claude Code. Run `sbx create --help`
for the full list of agents.

## Limitations

- Stopping or timing out a step does not stop the agent inside the sandbox.
  Use `sbx stop` or `sbx rm --force` in an `exit` handler, as in the examples
  above.
- The DAG or the operator creates, reuses, and removes the sandbox with `sbx`,
  as in the examples above.
- Do not combine these providers with a harness `container:`. With
  `container:`, Dagu runs the provider binary inside the container, where
  `sbx` is not available.
- `sbx` is under active development, and its flags have changed between
  releases. Check `sbx version` on every worker after an upgrade.

## Troubleshooting

| Message | Fix |
|---------|-----|
| `error: not signed in to Docker` | Run `sbx login` as the user that runs Dagu. |
| `error: global network policy has not been initialized` | Run `sbx policy init balanced`. |
| `Not logged in · Please run /login` | Run `sbx secret set anthropic`, or sign in with `/login` inside `sbx run --name NAME claude`. |
| `error: sandbox 'NAME' not found` | Create the sandbox first, or check the name with `sbx ls`. |
| `error: sandbox 'NAME' already exists` | Reuse it with `sbx exec`, or remove it with `sbx rm --force NAME`. |
| A request from the agent is blocked | Allow the host with `sbx policy allow`. `sbx policy log` shows blocked requests. |

## Links

- [Harness sandboxed execution](./)
- [Harness overview](../)
- [Custom CLI provider](./custom-provider)
- [Lifecycle handlers](/writing-workflows/lifecycle-handlers)
- [Docker Sandboxes documentation](https://docs.docker.com/ai/sandboxes/)
