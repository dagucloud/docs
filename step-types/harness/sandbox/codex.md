# Run Codex in a Container

This page describes `action: harness.run` with `provider: codex` inside a
Docker or Podman container.

The examples use an image named `dagu-codex-runner:local`. Build that image
before running the DAG examples.

## Requirements

- The Dagu process can reach Docker or Podman.
- The runner image contains `codex` in `PATH`.
- The container can reach the network for real `codex exec` runs.
- Authentication is provided with `CODEX_API_KEY` or a mounted Codex home.

## Build the Runner Image

OpenAI publishes `ghcr.io/openai/codex-universal:latest` as a pullable base
image. Install the Codex CLI on top of it:

```dockerfile
FROM ghcr.io/openai/codex-universal:latest

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

ENV CODEX_NON_INTERACTIVE=1 \
    CODEX_INSTALL_DIR=/usr/local/bin

RUN curl -fsSL https://chatgpt.com/codex/install.sh | sh
RUN codex --version

WORKDIR /workspace
ENTRYPOINT []
CMD ["/bin/bash"]
```

Build and verify the image:

```sh
docker build -t dagu-codex-runner:local -f Dockerfile .
docker run --rm dagu-codex-runner:local codex --version
```

The empty `ENTRYPOINT` prevents the base image entrypoint from rewriting the
command that Dagu runs.

## Verify the Image Through Dagu

This DAG starts a container and calls `codex --version`. It does not call the
Codex API.

```yaml
type: graph

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: codex_version
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
    with:
      provider: shell
      prompt: |
        set -eu
        codex --version
        command -v codex
```

The command must print the Codex CLI version and the path to the `codex`
binary.

## Step-Level Container

Use a step-level container when only the Codex step should receive the
workspace mount and Codex credential.

```yaml
env:
  - CODEX_API_KEY: ${CODEX_API_KEY}

steps:
  - id: review
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
      env:
        - CODEX_API_KEY=${env.CODEX_API_KEY}
    with:
      provider: codex
      prompt: |
        Review this repository and summarize the highest-risk issues.
```

`provider: codex` invokes `codex exec "<prompt>"`. A real run requires Codex
authentication.

## Root-Level Container

Use root-level `container:` when ordinary command steps and Codex should share
the same container filesystem and toolchain.

```yaml
type: graph

container:
  image: dagu-codex-runner:local
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
  - id: node_tools
    run: npm --version

  - id: codex_tools
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        codex --version
        command -v codex
```

This example verifies the shared container path without making a Codex API
request. For a real Codex step, replace the `shell` provider with
`provider: codex` and pass authentication.

If the root-level container receives `CODEX_API_KEY` or a mounted Codex home,
every inherited step in that shared container can read it.

## Authentication

There are two common authentication paths:

| Auth path | Container setup |
|-----------|-----------------|
| API key | Set `CODEX_API_KEY` in `container.env` |
| ChatGPT login | Mount a file-backed Codex home and set `CODEX_HOME` |

### API Key

```yaml
env:
  - CODEX_API_KEY: ${CODEX_API_KEY}

steps:
  - id: review
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
      env:
        - CODEX_API_KEY=${env.CODEX_API_KEY}
    with:
      provider: codex
      prompt: |
        Review this repository.
```

### ChatGPT Login

If `codex login status` on the host says `Logged in using ChatGPT`, a
containerized Dagu step can reuse that login when the login files are available
to the container.

Mount the host Codex home to a separate path and set `CODEX_HOME`:

```sh
docker run --rm \
  -v "${HOME}/.codex:/codex-home" \
  -e CODEX_HOME=/codex-home \
  dagu-codex-runner:local \
  codex login status
```

The same mount in a Dagu step:

```yaml
steps:
  - id: codex_login_status
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
      volumes:
        - ${HOME}/.codex:/codex-home
      env:
        - CODEX_HOME=/codex-home
    with:
      provider: shell
      prompt: |
        set -eu
        codex --version
        codex login status
```

The command must print the Codex CLI version and the login status.

Do not mount the host Codex home over `/root/.codex` in this image. The
Dockerfile above installs the standalone Codex package under `/root/.codex`, so
that mount hides the installed `codex` binary.

If the host Codex login uses an OS keychain instead of file-backed credentials,
the container may not be able to use it. Create a file-backed Codex home for the
Dagu worker:

```sh
mkdir -p "${HOME}/.codex-dagu"
printf 'cli_auth_credentials_store = "file"\n' > "${HOME}/.codex-dagu/config.toml"
CODEX_HOME="${HOME}/.codex-dagu" codex login
```

Then mount that directory:

```yaml
volumes:
  - ${HOME}/.codex-dagu:/codex-home
env:
  - CODEX_HOME=/codex-home
```

In `container.volumes`, `${HOME}` is expanded on the Dagu worker. `/codex-home`
is the literal path inside the container.

## Links

- [Codex provider reference](../codex)
- [Harness runner images](./images)
- [Harness container credentials](./credentials)
