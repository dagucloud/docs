---
description: Reuse unchanged file-producing steps while preserving safe, atomic publication of their outputs.
---

# Build Workflows

Build workflows avoid repeating file transformations whose recipe, declared inputs, and existing output have not changed. They are useful for builds, reports, media pipelines, and other local workflows where each stage produces a regular file at a stable path.

## Try It

Create a directory and an input file:

```bash
mkdir -p build-demo
printf 'alpha\n' > build-demo/source.txt
```

Save this workflow as `build-demo/workflow.yaml`:

```yaml
type: build
working_dir: .

steps:
  - id: uppercase
    inputs:
      - name: source
        path: source.txt
    outputs:
      - name: result
        path: uppercase.txt
    run: |
      #!/bin/sh
      tr '[:lower:]' '[:upper:]' < "${inputs.source}" > "${outputs.result}"

  - id: count
    inputs:
      - name: text
        path: uppercase.txt
    outputs:
      - name: summary
        path: summary.txt
    run: |
      #!/bin/sh
      wc -c < "${inputs.text}" > "${outputs.summary}"
```

Validate and run it twice:

```bash
dagu validate build-demo/workflow.yaml
dagu start build-demo/workflow.yaml
dagu start build-demo/workflow.yaml
```

The first run executes both steps. The second run reports `reuse (matched)` for both because their recipes, inputs, and outputs are unchanged. Preview the same decisions without executing anything:

```bash
dagu dry build-demo/workflow.yaml
```

Change the source and run the workflow again:

```bash
printf 'beta\n' > build-demo/source.txt
dagu start build-demo/workflow.yaml
```

Both steps execute again because their input contents changed. `working_dir: .` resolves from the workflow file's directory, so this example reads and writes inside `build-demo`. The working directory and the parent directories of declared outputs must already exist.

`count` does not need `depends: uppercase`. Its `uppercase.txt` input matches `uppercase`'s output, so Dagu infers that dependency.

## How Reuse Is Decided

A reusable step executes when no prior successful materialization exists. After it succeeds, Dagu records a manifest containing the step recipe, input content hashes, output content hash, and producer run.

On later runs, Dagu reuses the step only when all of these still match:

- the resolved command or script, parameters, non-secret environment, tools, platform, and effective working directory
- the names, paths, and SHA-256 content hashes of every declared input
- the declared output path and the content of the file currently at that path

Changing an input, command, parameter, environment value, tool configuration, working directory, or output file causes the step to execute again. If the final output is missing or modified, Dagu recomputes it; build workflows do not restore a separate cached copy.

A reused step is reported as succeeded. It is not skipped, and `${steps.<id>.outputs.<name>}` still publishes the final output path to dependent steps. Reuse does not create new stdout, stderr, exit-code, or legacy `output`/`outputs` values, so a potentially reusable producer cannot be referenced through `${step_id.stdout}`, `${step_id.stderr}`, `${step_id.exit_code}`, `${step_id.output}`, or `${step_id.outputs}`. Use the declared path reference instead.

## Path References

Build paths have three reference forms:

| Reference | Value | Availability |
|---|---|---|
| `${inputs.<name>}` | Absolute final path of a declared input | The owning step |
| `${outputs.<name>}` | Fresh staging path beside the final output | The owning executor attempt, including `run` and step `env` |
| `${steps.<id>.outputs.<name>}` | Absolute final path after commit or reuse | Dependent steps |

The producer must write to `${outputs.<name>}`, not directly to the final path. Each execution attempt receives a new, initially absent staging path. Dagu verifies the staged file and publishes it to the final path only after the step succeeds.

Do not use `${outputs.<name>}` in `working_dir`, preconditions, retry settings, or other fields evaluated outside an executor attempt.

## Paths and Inferred Dependencies

Paths may be absolute or relative. Relative paths use the workflow's stable working directory or the source DAG file's directory. An inline workflow with relative build paths must be given a stable default working directory, such as `dagu.WithDefaultWorkingDir` in the [embedded Go API](/embedding/go-api).

Path expressions must resolve before step execution. They may use stable values such as parameters and environment values, but cannot use step-output references or command substitution.

Dagu canonicalizes paths before comparing them. This has several consequences:

- `artifact.bin` and `./artifact.bin` identify the same output.
- Only one step may produce a given canonical output path.
- A step cannot declare the same canonical path as both its input and output.
- Matching producer outputs and consumer inputs add dependencies to the graph.
- Step output references such as `${steps.build.outputs.image}` add dependencies the same way. See [Dependencies](/writing-workflows/outputs#dependencies).
- Explicit and inferred dependencies must form an acyclic graph.

An inferred dependency, from a matching path or a step output reference, controls ordering, while the declared input content and resolved values control reuse. An explicit `depends` entry also acts as a control dependency: if that upstream step executes during the current run, the dependent step executes too, even when its declared file inputs are unchanged. Use explicit dependencies for non-file prerequisites that should participate in the reuse decision. When a step needs only a producer's declared file, rely on the inferred dependency.

Inputs must be regular, non-symlink files. Outputs may be absent before execution, but an existing output must also be a regular, non-symlink file. Missing inputs fail evaluation. The parent directory of an output must exist before the run starts.

## Which Steps Can Be Reused

A step is eligible for reuse when it:

- has an `id`
- declares exactly one output, and that output has `path`
- runs a host command or shell without a DAG-level or step-level container
- does not publish dynamic or scalar outputs
- does not use secrets, repeat, human tasks, approvals, `parallel`, `foreach`, or a child DAG lifecycle

Other valid steps in a build workflow execute normally and show an `always` decision. Path declarations themselves are supported only on host command and shell steps; built-in actions and containerized steps cannot declare build paths.

Build execution is currently local-only. A distributed execution request is rejected because workers do not yet share the required file fencing. If the server's default execution mode is distributed, set `worker_selector: local` on the workflow.

## Publication, Retries, and Concurrent Runs

Dagu holds shared locks for declared inputs and an exclusive lock for the output while it evaluates and executes a path-backed step. Build runs using the same local Dagu data store therefore cannot publish conflicting materializations. Dagu also verifies input contents again before commit, so an external change fails the attempt instead of publishing an inconsistent output.

`stdout`, `stderr`, `stdout.artifact`, and `stderr.artifact` destinations cannot resolve to a declared build input or output. This keeps stream capture from modifying an input or final materialization before verification and commit.

Each retry gets a fresh staging path. If an attempt fails, times out, or is aborted, Dagu removes its staging file and leaves the previous final output and manifest unchanged. Before commit, Dagu also verifies that the declared inputs did not change during execution.

Path-output steps cannot use `continue_on.mark_success`. Treating a failed attempt as successful would let dependent steps observe an old or missing final output without a new commit.

## Preview or Disable Reuse

Use `dagu dry` to preview build decisions without executing commands or creating locks, staging files, manifests, or run history:

```bash
dagu dry report-pipeline.yaml
```

A downstream decision can be `deferred` when its input depends on an upstream step that the dry run predicts will execute. The actual run evaluates it after the upstream output is known.

Use `--no-reuse` to recompute every otherwise eligible step for one run. Successful steps safely replace their materializations; failures still preserve the previous output.

```bash
dagu start --no-reuse report-pipeline.yaml
dagu enqueue --no-reuse report-pipeline.yaml
dagu dry --no-reuse report-pipeline.yaml
```

The Web UI exposes the same behavior as **Disable reuse for this run** in the start and enqueue dialogs. REST and MCP `dagu_execute` clients can send `noReuse: true`, and embedded applications can pass `dagu.WithNoReuse(true)`.

## Inspect Decisions

The CLI and Web UI show an `execute`, `reuse`, `always`, `deferred`, or `none` decision separately from the step's lifecycle status. The step detail includes a stable reason and a human-readable explanation. Reused steps also link to the DAG run that produced the materialization.

Common decisions include:

| Decision and reason | Meaning |
|---|---|
| `execute (manifest_missing)` | No successful materialization exists yet; this is normal on the first run. |
| `reuse (matched)` | The recipe, inputs, manifest, and current output match; the executor did not run. |
| `execute (input_changed)` | At least one declared input has different content. |
| `execute (recipe_changed)` | A command, parameter, environment value, tool, platform, or working directory changed. |
| `execute (output_missing)` | The final output was removed, so Dagu recomputes it instead of restoring a cached copy. |
| `execute (output_changed)` | The final output no longer matches the committed materialization. |
| `execute (control_dependency_ran)` | An explicit dependency executed during this run. |
| `execute (reuse_disabled)` | The run used `--no-reuse` or the equivalent API option. |
| `always (ineligible)` | The step is valid in a build workflow but does not meet the reuse requirements. |
| `deferred (upstream_would_execute)` | A dry run cannot decide until an upstream producer creates its output. |
| `none (precondition_not_met)` | A precondition prevented the step from reaching a reuse or execute decision. |

The REST DAG-run response exposes the same data under each node's `build` field. See [REST API](/web-ui/api#build-execution-data) for the response shape.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `input_missing` | The declared input does not exist or is not a regular file. Check its path and the workflow's working directory. |
| `verify staged output` after a successful command | The command did not create `${outputs.<name>}`. Write to the staging reference instead of the final declared path. |
| `relative materialization path ... has no stable working directory` | An inline workflow used a relative path. Supply an absolute path or a stable default working directory. |
| `multiple producers` | Two output declarations resolve to the same canonical path. Give each produced file one owner. |
| Unexpected `always (ineligible)` | Check the eligibility list above, especially extra outputs, secrets, containers, repeat, and nested execution. |
| Build workflows require local execution | Add `worker_selector: local` when the server defaults to distributed execution. |
| A step executes even though its file inputs did not change | Check whether an explicit dependency executed. Remove redundant `depends` entries when the matching input/output path already expresses the dependency. |

## Related Pages

- [Data Flow](/writing-workflows/data-flow)
- [Outputs](/writing-workflows/outputs)
- [Durable Execution](/writing-workflows/durable-execution)
- [YAML Specification](/writing-workflows/yaml-specification)
