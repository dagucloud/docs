# Harness Runner Images

A harness runner image is a container image that contains the CLI binary used by
`action: harness.run`.

For a built-in CLI provider such as `codex`, `claude`, `copilot`, `opencode`, or
`pi`, the provider name tells Dagu how to build the command line. It does not
install that CLI. The image must already contain the matching binary in `PATH`.

For a custom provider under top-level `harnesses:`, the image must contain the
configured `binary`.

## Image Contract

A runner image must contain:

- the provider binary in `PATH`
- any runtime required by that binary
- CA certificates if the provider connects to HTTPS endpoints
- the tools the agent is expected to run, such as `git`, package managers, test
  tools, compilers, or linters
- a writable home or cache directory if the provider writes config, sessions,
  logs, or token refresh data

For root-level `container:`, the same image is also used by ordinary command
steps that inherit the shared container. If a DAG runs `npm test` and then
`action: harness.run` with `provider: claude`, the image needs both `npm` and
`claude`.

## Entrypoint

A runner image can define an `ENTRYPOINT`, but Dagu does not rely on it for
`harness.run` image mode. The harness provider command is built from the Dagu
provider configuration.

For a provider smoke test, use a custom `shell` provider and call the installed
CLI explicitly. This verifies the image without making a model request.

```yaml
type: graph

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

env:
  - PROVIDER_API_KEY: ${PROVIDER_API_KEY}

steps:
  - id: verify_runner
    action: harness.run
    container:
      image: dagu-agent-runner:local
      pull_policy: never
    with:
      provider: shell
      prompt: |
        set -eu
        command -v YOUR_PROVIDER_BINARY
        YOUR_PROVIDER_BINARY --version
```

Replace `YOUR_PROVIDER_BINARY` with the binary installed in the image, such as
`codex`, `claude`, or `opencode`.

## Workspace Mounts

Use a container path that matches `container.working_dir`.

Review-only workflow:

```yaml
container:
  working_dir: /workspace
  volumes:
    - .:/workspace:ro
```

Workflow that can modify files:

```yaml
container:
  working_dir: /workspace
  volumes:
    - .:/workspace
```

The host-side source in `container.volumes` can use `$VAR` or `${VAR}`. Dagu
expands those variables before it calls the container runtime. The container
target path and the optional `ro` or `rw` mode are not expanded.

## Credentials

Do not bake credentials into an image. Pass provider credentials at run time
with `container.env` or a mounted credentials directory.

Step-level container:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-provider-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
      env:
        - PROVIDER_API_KEY=${env.PROVIDER_API_KEY}
    with:
      provider: your_provider
      prompt: |
        Review the repository.
```

Root-level container:

```yaml
env:
  - PROVIDER_API_KEY: ${PROVIDER_API_KEY}

container:
  image: dagu-provider-runner:local
  pull_policy: never
  working_dir: /workspace
  volumes:
    - .:/workspace:ro
  env:
    - PROVIDER_API_KEY=${env.PROVIDER_API_KEY}
```

With a root-level container, every inherited command step and CLI harness step
inside that shared container can read `PROVIDER_API_KEY`. If only one harness
step should receive a credential, put `container:` on that step instead.

## Provider Pages

Provider-specific pages show concrete image and DAG examples:

- [Codex](./codex)
- [Claude Code](./claude-code)
- [OpenCode](./opencode)
- [Custom CLI provider](./custom-provider)
