# Run a Custom Harness Provider in a Container

Use a custom harness provider when the runner image exposes a CLI that is not
one of Dagu's built-in harness providers, or when the image exposes a wrapper
script around a provider CLI.

The image must contain the configured `binary` in `PATH`.

## Shell Provider Smoke Test

This DAG uses Alpine and a custom provider named `shell`. It verifies that
`harness.run` executes inside the configured container.

```yaml
container:
  image: alpine:3.20
  pull_policy: missing
  env:
    - SMOKE_TOKEN=container-env-ok

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: smoke
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        echo "HARNESS_CONTAINER_SMOKE=ok"
        echo "SMOKE_TOKEN=$SMOKE_TOKEN"
        echo "ALPINE_RELEASE=$(cat /etc/alpine-release)"
```

The output must include:

```text
HARNESS_CONTAINER_SMOKE=ok
SMOKE_TOKEN=container-env-ok
ALPINE_RELEASE=
```

The Alpine release value depends on the image tag.

## Custom CLI Provider

This example assumes the runner image contains `/usr/local/bin/review-agent`.
The CLI receives its prompt as the final command-line argument.

```yaml
env:
  - REVIEW_AGENT_TOKEN: ${REVIEW_AGENT_TOKEN}

harnesses:
  review_agent:
    binary: review-agent
    prefix_args:
      - run
    prompt_mode: arg

steps:
  - id: review
    action: harness.run
    container:
      image: dagu-review-agent:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
      env:
        - REVIEW_AGENT_TOKEN=${env.REVIEW_AGENT_TOKEN}
    with:
      provider: review_agent
      prompt: |
        Review this repository.
```

Dagu builds this command inside the container:

```text
review-agent run "Review this repository."
```

## Prompt as a Flag

If the CLI expects a prompt flag, set `prompt_mode: flag` and `prompt_flag`.

```yaml
harnesses:
  review_agent:
    binary: review-agent
    prefix_args:
      - run
    prompt_mode: flag
    prompt_flag: --prompt
```

With this provider definition, the command shape is:

```text
review-agent run --prompt "Review this repository."
```

## Container Requirements

For the examples above, the image must contain:

- the configured provider binary
- any runtime required by that binary
- any tools the provider is expected to run
- a writable home or cache directory if the provider writes files there

If the provider needs credentials, pass them with `container.env` or mount the
credential files the provider reads.

## Unsupported Prompt Input

Containerized `harness.run` does not support stdin prompt mode. Do not combine
`container:` with:

- `with.stdin`
- `script:`
- a custom provider that sets `prompt_mode: stdin`

Use `prompt_mode: arg` or `prompt_mode: flag` for containerized providers.

## Links

- [Harness overview](../)
- [Harness runner images](./images)
- [Harness container credentials](./credentials)
