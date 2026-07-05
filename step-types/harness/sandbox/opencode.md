# Run OpenCode in a Container

This page describes `action: harness.run` with `provider: opencode` inside a
Docker or Podman container.

The examples use an image named `dagu-opencode-runner:local`. Build that image
before running the DAG examples.

## Requirements

- The Dagu process can reach Docker or Podman.
- The runner image contains `opencode` in `PATH`.
- The container can reach the network for real `opencode run` requests.
- OpenCode has provider credentials inside the container.

OpenCode's current installation, CLI, and credential behavior is documented by
OpenCode:

- [OpenCode install](https://opencode.ai/docs/)
- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [OpenCode providers](https://opencode.ai/docs/providers/)

## Build the Runner Image

OpenCode can be installed as a global npm package named `opencode-ai`.

```dockerfile
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    bash \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai
RUN opencode --version

WORKDIR /workspace
ENTRYPOINT []
CMD ["bash"]
```

Build and verify the image:

```sh
docker build -t dagu-opencode-runner:local -f Dockerfile .
docker run --rm dagu-opencode-runner:local opencode --version
```

## Verify the Image Through Dagu

This DAG starts a container and calls `opencode --version`. It does not make a
model request.

```yaml
harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: opencode_version
    action: harness.run
    container:
      image: dagu-opencode-runner:local
      pull_policy: never
    with:
      provider: shell
      prompt: |
        set -eu
        opencode --version
        command -v opencode
```

The command must print the OpenCode version and the path to the `opencode`
binary.

## Step-Level Container

Use a step-level container when only the OpenCode step should receive the
workspace mount and provider credentials.

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-opencode-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
        - ${HOME}/.local/share/opencode:/root/.local/share/opencode:ro
    with:
      provider: opencode
      prompt: |
        Review this repository and summarize the highest-risk issues.
      model: anthropic/claude-sonnet-4-5
```

`provider: opencode` invokes `opencode run "<prompt>"`. OpenCode documents that
`opencode auth login` stores provider credentials in
`~/.local/share/opencode/auth.json`. The mount above exposes the host OpenCode
credentials to the root user inside this example image.

If the image runs as a non-root user, mount the credentials directory at that
user's `~/.local/share/opencode` path instead.

## Root-Level Container

Use root-level `container:` when ordinary command steps and OpenCode should
share the same container filesystem and toolchain.

```yaml
container:
  image: dagu-opencode-runner:local
  pull_policy: never
  working_dir: /workspace
  volumes:
    - .:/workspace
    - ${HOME}/.local/share/opencode:/root/.local/share/opencode:ro

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: test
    run: npm test

  - id: opencode_tools
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        opencode --version
        command -v opencode
```

This example verifies the shared container path without making a model request.
For a real OpenCode step, replace the `shell` provider with
`provider: opencode`.

The mounted OpenCode credentials are readable by every inherited step inside
the shared container.

## Authentication

OpenCode can load provider credentials from:

- `~/.local/share/opencode/auth.json`
- environment variables used by the selected provider
- a project `.env` file

Use OpenCode's provider documentation for the exact variable names required by
the selected model provider.

Mounted OpenCode credentials:

```yaml
volumes:
  - ${HOME}/.local/share/opencode:/root/.local/share/opencode:ro
```

Provider environment variables:

```yaml
env:
  - ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

container:
  image: dagu-opencode-runner:local
  env:
    - ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}
```

Or on a step-level container:

```yaml
env:
  - ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}
```

The `ANTHROPIC_API_KEY` example is only for an OpenCode configuration that uses
Anthropic as the model provider. Use the variable required by the provider in
the OpenCode model name.

In `container.volumes`, `${HOME}` is expanded on the Dagu worker.
`/root/.local/share/opencode` is the literal path inside the container.

## Links

- [OpenCode provider reference](../opencode)
- [Harness runner images](./images)
- [Harness container credentials](./credentials)
