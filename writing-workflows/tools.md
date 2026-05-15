---
title: Tools
---

# Tools

Use top-level `tools` when a workflow depends on portable command-line binaries whose versions matter. Dagu installs the declared tools before the DAG run starts, prepends the resolved tool directory to `PATH` for that DAG run, and then runs your steps.

This keeps the workflow definition reproducible: the DAG records the tools it needs instead of relying on whatever happens to be installed on a worker.

::: tip
You do not need to install the `aqua` CLI separately. Dagu uses aqua internally and still runs as a single binary.
:::

## Quick Example

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: inspect
    run: jq --version

  - id: transform
    run: jq '.items[] | .name' data.json
```

The package is installed before the first step runs. The `jq` binary is then available to every host command step through `PATH`.

## When to Use Tools

Use `tools` for portable CLIs where the exact binary version affects correctness, security, or reproducibility:

- JSON/YAML processors such as `jq` and `yq`
- linters, formatters, release helpers, and code generators
- converters and small build utilities available through the aqua registry
- profiling or diagnostic tools such as `pprof`

Do not use `tools` for commands that intentionally depend on user or worker preconfiguration, local profiles, plugins, login state, or credentials. Treat those commands as worker prerequisites instead. Examples include `gcloud`, cloud CLIs with local profiles, and AI agent CLIs such as Claude Code, Codex, Gemini CLI, OpenCode, or Aider.

If a CLI can be installed as a pure binary but still needs credentials, `tools` only handles the binary. Provide credentials separately with [environment variables](/writing-workflows/environment-variables) or [secrets](/writing-workflows/secrets).

## Syntax

For the common case, use package shorthand:

```yaml
tools:
  - jqlang/jq@jq-1.7.1
  - mikefarah/yq@v4.45.1
```

Each entry is:

```text
<aqua-package>@<version-or-ref>
```

`provider` is optional and defaults to `aqua`.

## Pin Versions

Every package must have a pinned version or ref. The floating value `latest` is rejected.

For release-asset packages, the version is usually a release tag:

```yaml
tools:
  - jqlang/jq@jq-1.7.1
```

For packages that support source refs, prefer an immutable commit SHA:

```yaml
tools:
  - google/pprof@d04f2422c8a17569c14e84da0fae252d9529826b
```

Tags are convenient, but a commit SHA is a stronger reproducibility boundary when the package supports it.

## Package Object Form

Use object form when you need an explicit display name or command list:

```yaml
tools:
  packages:
    - package: jqlang/jq
      version: jq-1.7.1
      commands: [jq]
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `package` | Yes | Aqua package name, for example `jqlang/jq`. |
| `version` | Yes | Pinned aqua version, release tag, or supported source ref. |
| `commands` | No | Command names exposed to steps. Omit for the common case; Dagu infers commands from aqua registry metadata. |
| `name` | No | Display name. Defaults to the first command or the package basename. |
| `registry` | No | Registry name for the package. Defaults to the configured registry. |

`commands` must contain executable names only, not paths or shell fragments. For example, `jq` is valid; `bin/jq` and `jq --version` are not.

## Registry

When `registry` is omitted, Dagu uses its pinned standard aqua registry commit. This gives a stable registry snapshot without making every DAG repeat the registry ref.

You can override the standard registry ref:

```yaml
tools:
  registry:
    type: standard
    ref: 5e2f56743d66abe9dfc7c56d35086511b7dc92d8
  packages:
    - jqlang/jq@jq-1.7.1
```

For a custom registry file hosted in GitHub contents, use `github_content`:

```yaml
tools:
  registry:
    type: github_content
    repo_owner: example
    repo_name: aqua-registry
    ref: 9f73f3c0b6a3b2f6f8f2db3c77d8f2f79e420f5a
    path: registry.yaml
  packages:
    - example/tool@v1.2.3
```

For custom registries, `registry.ref` is required. Prefer a commit SHA for immutability.

## Runtime Behavior

Before the DAG starts, Dagu:

1. Generates an aqua config for the DAG's `tools`.
2. Computes a toolset hash from the tool declaration and worker platform.
3. Installs the tools into the worker-local data directory.
4. Writes a manifest of resolved commands.
5. Prepends the toolset `bin` directory to `PATH` for that DAG run.

The cache layout is:

```text
<data-dir>/tools/aqua/root/
<data-dir>/tools/aqua/locks/
<data-dir>/tools/aqua/envs/<os>-<arch>/<toolset-hash>/
```

In distributed shared-nothing mode, each worker uses its own local data directory. A worker installs the toolset the first time it runs a DAG requiring it, then reuses the cache for later runs with the same platform and toolset hash.

Cache hits reuse the manifest and command shims without taking an install lock. When a toolset must be prepared, Dagu uses worker-local locks for the toolset environment, missing registry cache entries, cold aqua-proxy bootstrap, and overlapping package/version/platform installs. Independent toolsets with disjoint packages can prepare in parallel on the same worker.

## Sub-DAGs

`tools` is scoped to one DAG run. A sub-DAG is a separate DAG run, so it does not inherit the parent DAG's managed tool environment.

If a child DAG uses a managed command, declare `tools` in the child DAG too:

```yaml
steps:
  - action: dag.run
    with:
      dag: child_parse
---
name: child_parse
tools:
  - jqlang/jq@jq-1.7.1
steps:
  - id: parse
    run: jq '.items[]' input.json
```

If the parent also runs `jq` in its own steps, declare the same tool in the parent as well. This is not a runtime duplication problem: the worker cache is keyed by platform and toolset hash, so the same package is reused on the same worker after installation.

This rule also applies to inline sub-DAGs in the same YAML file. Each YAML document is its own DAG definition for tool declarations.

In distributed shared-nothing mode, the worker that executes the child DAG prepares the child DAG's tools in that worker's local data directory. Different workers maintain independent caches, and later runs on the same worker reuse the local cache.

## Current Limitations

DAG tools currently apply to host-executed command steps. They are not supported yet with:

- DAG-level `container`
- step-level `container`
- `docker.run` or `container.run`
- `k8s.run` or `kubernetes.run`
- `ssh.run`

For those execution modes, install the needed binary inside the container image, Kubernetes image, or remote host instead.

## Troubleshooting

If a command is not found:

- confirm the package exists in the selected aqua registry
- confirm the package supports the worker OS and architecture
- use object form with `commands` if Dagu cannot infer the executable name
- check that the step runs on the host, not in a container, Kubernetes job, or SSH session

If the worker has no network access, pre-warm the worker cache by running the DAG once in an environment with registry and package download access.
