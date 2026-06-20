# Run Claude Code in a Container

This page describes `action: harness.run` with `provider: claude` inside a
Docker or Podman container.

The examples use an image named `dagu-claude-runner:local`. Build that image
before running the DAG examples.

## Requirements

- The Dagu process can reach Docker or Podman.
- The runner image contains `claude` in `PATH`.
- The container can reach the network for real `claude -p` runs.
- Authentication is provided with `ANTHROPIC_API_KEY`,
  `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, cloud-provider
  environment variables, or a mounted Claude Code credentials directory.

Claude Code's current installation and authentication behavior is documented by
Anthropic:

- [Claude Code setup](https://code.claude.com/docs/en/setup)
- [Claude Code authentication](https://code.claude.com/docs/en/iam)

## Build the Runner Image

Claude Code can be installed as a global npm package. The package requires
Node.js 18 or later.

```dockerfile
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    ripgrep \
    bash \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code
RUN claude --version

WORKDIR /workspace
ENTRYPOINT []
CMD ["bash"]
```

Build and verify the image:

```sh
docker build -t dagu-claude-runner:local -f Dockerfile .
docker run --rm dagu-claude-runner:local claude --version
```

## Verify the Image Through Dagu

This DAG starts a container and calls `claude --version`. It does not make a
model request.

```yaml
type: graph

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: claude_version
    action: harness.run
    container:
      image: dagu-claude-runner:local
      pull_policy: never
    with:
      provider: shell
      prompt: |
        set -eu
        claude --version
        command -v claude
```

The command must print the Claude Code version and the path to the `claude`
binary.

## Step-Level Container

Use a step-level container when only the Claude Code step should receive the
workspace mount and credential.

```yaml
env:
  - ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

steps:
  - id: review
    action: harness.run
    container:
      image: dagu-claude-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
      env:
        - ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}
    with:
      provider: claude
      prompt: |
        Review this repository and summarize the highest-risk issues.
      model: sonnet
```

`provider: claude` invokes `claude -p "<prompt>"`. In non-interactive mode,
Claude Code uses `ANTHROPIC_API_KEY` when that variable is present.

## Root-Level Container

Use root-level `container:` when ordinary command steps and Claude Code should
share the same container filesystem and toolchain.

```yaml
type: graph

container:
  image: dagu-claude-runner:local
  pull_policy: never
  working_dir: /workspace
  volumes:
    - .:/workspace

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: test
    run: npm test

  - id: claude_tools
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        claude --version
        command -v claude
```

This example verifies the shared container path without making a model request.
For a real Claude Code step, replace the `shell` provider with
`provider: claude` and pass authentication.

If the root-level container receives an Anthropic key, bearer token, OAuth
token, or mounted Claude credentials, every inherited step in that shared
container can read it.

## Authentication

Claude Code chooses credentials in the order documented by Anthropic. For Dagu
container runs, the credential must be available inside the container.

### API Key

```yaml
env:
  - ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}
```

### Bearer Token

```yaml
env:
  - ANTHROPIC_AUTH_TOKEN=${env.ANTHROPIC_AUTH_TOKEN}
```

### Long-Lived OAuth Token

Generate the token on the host:

```sh
claude setup-token
```

Then pass it to the container:

```yaml
env:
  - CLAUDE_CODE_OAUTH_TOKEN=${env.CLAUDE_CODE_OAUTH_TOKEN}
```

Anthropic documents that `--bare` does not read `CLAUDE_CODE_OAUTH_TOKEN`. Do
not set `bare: true` in the Dagu step when this token is the only credential.

### Mounted Credentials Directory

On Linux, Claude Code stores credentials under `~/.claude/.credentials.json`
unless `CLAUDE_CONFIG_DIR` is set. Mount the host directory and set
`CLAUDE_CONFIG_DIR` inside the container:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-claude-runner:local
      pull_policy: never
      volumes:
        - ${HOME}/.claude:/claude-config
      env:
        - CLAUDE_CONFIG_DIR=/claude-config
    with:
      provider: claude
      prompt: |
        Review this repository.
```

On macOS, Claude Code stores login credentials in the macOS Keychain. A
container cannot read the host Keychain by mounting `~/.claude`.

In `container.volumes`, `${HOME}` is expanded on the Dagu worker. The
`/claude-config` target is the literal path inside the container.

## Links

- [Claude Code provider reference](../claude)
- [Harness runner images](./images)
- [Harness container credentials](./credentials)
