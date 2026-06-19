# Harness Container Credentials

A containerized `harness.run` step receives only the credentials made available
to its container. Dagu does not copy host login state into a container unless the
DAG mounts the files or passes the environment variables required by the
provider.

## Environment Variables

Use `container.env` for API keys and provider tokens:

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
        - PROVIDER_API_KEY=${PROVIDER_API_KEY}
    with:
      provider: your_provider
      prompt: |
        Review this repository.
```

`PROVIDER_API_KEY=${PROVIDER_API_KEY}` is evaluated by Dagu before the container
starts. The value must be available to the Dagu process that executes the run.

## Mounted Credential Directories

Some CLIs store login state in files. Mount the directory the CLI reads, then
set the provider's home or config variable if that CLI supports one.

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-provider-runner:local
      pull_policy: never
      volumes:
        - ${HOME}/.provider:/provider-home
      env:
        - PROVIDER_HOME=/provider-home
    with:
      provider: your_provider
      prompt: |
        Review this repository.
```

In `container.volumes`, Dagu expands `$VAR` and `${VAR}` only in the host-side
source. In the example above, `${HOME}/.provider` is resolved on the Dagu
worker. `/provider-home` is passed to the container runtime as a literal
container path.

## Step-Level Visibility

Use a step-level `container:` when one harness attempt should receive a
credential:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-provider-runner:local
      pull_policy: never
      env:
        - PROVIDER_API_KEY=${PROVIDER_API_KEY}
    with:
      provider: your_provider
      prompt: |
        Review this repository.
```

Only that step receives `PROVIDER_API_KEY` through this container definition.

## Root-Level Visibility

Use root-level `container:` only when every inherited step in the shared
container may receive the same credential:

```yaml
container:
  image: dagu-provider-runner:local
  pull_policy: never
  env:
    - PROVIDER_API_KEY=${PROVIDER_API_KEY}

steps:
  - id: test
    run: npm test

  - id: review
    action: harness.run
    with:
      provider: your_provider
      prompt: |
        Review this repository.
```

Both `test` and `review` run inside the shared container and can read
`PROVIDER_API_KEY`.

## Provider-Specific Credential Shapes

- [Codex](./codex#authentication)
- [Claude Code](./claude-code#authentication)
- [OpenCode](./opencode#authentication)
