# Harness Runner Images

A harness runner image is a container image that contains the CLI agent binary
and the tools that agent may use during a `harness.run` step.

The runner image is the main unit of repeatability for sandboxed harness
execution. It decides which agent version runs, which language toolchains are
available, which package managers exist, and which default filesystem layout the
agent sees.

## Image Requirements

At minimum, a runner image needs:

- the selected provider binary in `PATH`
- a shell and basic Unix utilities if the provider expects them
- CA certificates for HTTPS access
- any language runtimes, compilers, or package managers the agent should use
- a writable home or cache directory for the container user

The image does not need an `ENTRYPOINT` for harness image mode. Dagu sets the
agent binary as the container entrypoint and passes the provider arguments as
the container command.

For a root-level shared sandbox, the image also needs the tools used by ordinary
workflow steps. If the same DAG runs `npm test` and then `action: harness.run`
with `provider: codex`, the shared image needs both `npm` and `codex`.

## Build a Codex Runner Image

OpenAI publishes `ghcr.io/openai/codex-universal:latest` as a pullable image
that matches the broad language/tooling environment used by Codex cloud
tasks. It is a base environment, not a Dagu-specific runner image, so install
the Codex CLI on top of it.

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

The empty `ENTRYPOINT` is intentional. The `codex-universal` base image starts
through `/opt/entrypoint.sh`, which eventually runs `bash --login "$@"`. That is
useful for an interactive base environment, but a Dagu runner image should let
Docker and Dagu execute the requested command directly.

Build and verify the image:

```sh
docker build -t dagu-codex-runner:local -f Dockerfile .
docker run --rm dagu-codex-runner:local codex --version
```

The image tag `dagu-codex-runner:local` is used by the examples below. For
production, publish the tested image to a registry and use a pinned tag or
digest.

## Verify Through Dagu

This root-level smoke test uses the real Codex runner image but does not call
the Codex API. It verifies that Dagu can start the shared container and execute
the `codex` binary inside it.

```yaml
type: graph

container:
  image: dagu-codex-runner:local
  pull_policy: never

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: codex_version
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        codex --version
        command -v codex
```

Expected output includes the Codex CLI version and the path to the `codex`
binary.

For step-level image mode, put the same container on the harness step:

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

## Use Your ChatGPT Subscription Login

If `codex login status` on the host says `Logged in using ChatGPT`, a
containerized Dagu step can reuse that login by mounting the host Codex home and
setting `CODEX_HOME` inside the runner container.

Mount the host Codex home to a separate path such as `/codex-home`:

```sh
docker run --rm \
  -v "${HOME}/.codex:/codex-home" \
  -e CODEX_HOME=/codex-home \
  dagu-codex-runner:local \
  codex login status
```

In DAG `container.volumes`, Dagu expands `$VAR` and `${VAR}` on the source side
from the Dagu process environment. That means `${HOME}/.codex:/codex-home`
mounts the worker user's Codex home. The container target path and the optional
mode are not expanded.

Do not mount the host Codex home over `/root/.codex` in this runner image. The
Dockerfile above installs the standalone Codex package under `/root/.codex`, so
mounting another directory there hides the installed `codex` binary.

This Dagu smoke test verifies that the mounted ChatGPT login is visible inside
the harness container:

```yaml
type: graph

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

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

Expected output includes `codex-cli ...` and `Logged in using ChatGPT`.

For a real Codex step using the same subscription login:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
        - ${HOME}/.codex:/codex-home
      env:
        - CODEX_HOME=/codex-home
    with:
      provider: codex
      sandbox: read-only
      prompt: |
        Review this repository and summarize the highest-risk issues.
```

Use a read-write mount for the Codex home during real runs. Codex can write
logs, sessions, SQLite state, and refreshed ChatGPT tokens under `CODEX_HOME`.

If the host Codex login uses an OS keychain instead of file-backed credentials,
the container may not be able to use it. In that case, create a dedicated
file-backed Codex home for the Dagu worker:

```sh
mkdir -p /Users/alice/.codex-dagu
printf 'cli_auth_credentials_store = "file"\n' > /Users/alice/.codex-dagu/config.toml
CODEX_HOME=/Users/alice/.codex-dagu codex login
```

Then mount `${HOME}/.codex-dagu:/codex-home` in the DAG.

## Run Codex in a Step Sandbox

Use a step-level container when only the Codex attempt should receive its
credential. For API-key automation, pass `CODEX_API_KEY` only to that step:

```yaml
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
        - CODEX_API_KEY=${CODEX_API_KEY}
    with:
      provider: codex
      prompt: |
        Review this repository.
```

`provider: codex` invokes `codex exec "<prompt>"`, so a real run requires
Codex authentication. Use either the ChatGPT subscription mount above or
`CODEX_API_KEY`, depending on how the Dagu worker should authenticate.

## Use as a Root-Level Shared Sandbox

Use a root-level container when command steps and Codex should share one
filesystem and toolchain. This example verifies the shared toolchain without
calling the Codex API:

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

If the root-level container also receives `CODEX_API_KEY` or a mounted Codex
home, every step in that shared container can read it. That is acceptable only
for trusted workflows. For repository-controlled commands such as dependency
lifecycle scripts, prefer the step-level shape above.

## Other Provider Images

For other CLI providers, use the same pattern:

- start from a base image that contains the language/tooling stack needed by
  the workflow
- install the provider CLI using that provider's official instructions
- make sure the provider binary is in `PATH`
- keep credentials out of the image
- pass credentials only to the step or shared container that needs them

Custom harness providers are useful when the image exposes a wrapper script
instead of the upstream CLI directly. Define the wrapper under top-level
`harnesses:` and use an image that actually contains that wrapper binary.

## Credentials

There are two common Codex authentication paths:

| Auth path | Use when | Container setup |
|-----------|----------|-----------------|
| ChatGPT subscription login | Use the same Codex entitlement as `codex login` on the worker | Mount a file-backed Codex home and set `CODEX_HOME` |
| API key | Use usage-based OpenAI Platform billing for automation | Set `CODEX_API_KEY` only on the Codex step |

For API-key automation:

```yaml
container:
  env:
    - CODEX_API_KEY=${CODEX_API_KEY}
```

Avoid baking tokens into the image. Image layers are easy to copy, cache, and
inspect. For file-based credentials, mount only the specific file or directory
the provider needs, and prefer read-only mounts.

For ChatGPT subscription auth:

```yaml
container:
  volumes:
    - ${HOME}/.codex:/codex-home
  env:
    - CODEX_HOME=/codex-home
```

Treat `auth.json` and ChatGPT access tokens like passwords. Do not bake them
into images, commit them to repositories, or mount them into untrusted
root-level shared containers.

## Workspace Mounts

Use read-only mounts for review-only tasks:

```yaml
volumes:
  - .:/workspace:ro
```

Use read-write mounts only when the agent is expected to modify files:

```yaml
volumes:
  - .:/workspace
```

Avoid mounting broad host paths such as the user's home directory. Mounting the
container daemon socket into the runner image gives the agent control over the
daemon and should be treated as privileged.

## Image Tags

Use pinned tags or digests for production workflows. During local testing, use
the image tag built above:

```yaml
container:
  image: dagu-codex-runner:local
  pull_policy: never
```

Floating tags such as `latest` are convenient during development, but they make
past DAG runs harder to reproduce. After publishing the tested image to a
registry, reference that published immutable tag or digest from production DAGs.

## Provider Notes

Built-in CLI provider names such as `codex`, `claude`, `copilot`, `opencode`,
and `pi` tell Dagu how to build the command line. They do not install those
binaries into the image. The image author is responsible for installing the
matching CLI.

For `provider: builtin`, no runner image is used. The built-in provider runs
inside the Dagu process and cannot be combined with root-level or step-level
`container:`.

Custom harness providers can be useful for image-specific wrapper scripts. Keep
the provider binary name stable in the DAG and let the image decide what that
wrapper does.
