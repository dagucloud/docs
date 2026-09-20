# Data Flow

Data moves through a workflow by parameters, environment values, declared step outputs, files, standard input, and artifacts.

Use scoped value references when Dagu owns the interpolation:

```text
${params.name}
${env.NAME}
${consts.name}
${steps.step_id.outputs.name}
${context.run.id}
```

Bare `$NAME` and `${NAME}` are shell syntax inside `run` scripts. They are still useful for shell-local variables, but examples that need Dagu validation should use the scoped form.

## Parameters

Declare runtime inputs with `params`, then read them with `${params.<name>}` in value-resolved fields.

```yaml
params:
  - name: environment
    type: string
    default: dev
    enum: [dev, staging, prod]
  - name: batch_size
    type: integer
    default: 100
    minimum: 1

steps:
  - id: extract
    run: |
      ./extract.sh \
        --env "${params.environment}" \
        --batch-size "${params.batch_size}"
```

Override named params at runtime:

```bash
dagu enqueue workflow.yaml -- environment=prod batch_size=500
```

## Environment Values

Declare workflow environment values with `env`, then read them with `${env.<NAME>}` when Dagu should resolve the value.

```yaml
env:
  - LOG_LEVEL: debug
  - DATA_DIR: /var/data
  - OUTPUT_DIR: ${env.DATA_DIR}/output

steps:
  - id: process
    run: ./process.sh --log "${env.LOG_LEVEL}" --out "${env.OUTPUT_DIR}"
```

When importing host process environment values into the workflow environment, the root `env` block can still use unqualified environment expansion:

```yaml
env:
  - AWS_REGION: ${AWS_REGION}
  - AWS_PROFILE: ${AWS_PROFILE}
```

After import, use `${env.AWS_REGION}` and `${env.AWS_PROFILE}` in workflow fields.

## Step Outputs

Use declared step outputs for validated data passing between steps.

```yaml
steps:
  - id: get_version
    run: |
      printf 'version=%s\n' "$(cat VERSION)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: build_image
    depends: get_version
    run: docker build -t "myapp:${steps.get_version.outputs.version}" .
```

The consumer must depend on the producer. Step output references do not create dependencies.

### Multiple Outputs

```yaml
steps:
  - id: inspect_build
    run: |
      printf 'version=v1.2.3\n' >> "$DAGU_OUTPUT_FILE"
      printf 'artifact_url=https://example.test/app.tgz\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version
      - name: artifact_url

  - id: deploy
    depends: inspect_build
    run: |
      echo "Deploying ${steps.inspect_build.outputs.version}"
      echo "Artifact: ${steps.inspect_build.outputs.artifact_url}"
```

### JSON Output

Use `type: json` to require a valid JSON value.

```yaml
steps:
  - id: inspect
    run: |
      cat >> "$DAGU_OUTPUT_FILE" <<'EOF'
      metadata<<JSON
      {"image":"api","tag":"v1.2.3"}
      JSON
      EOF
    outputs:
      - name: metadata
        type: json

  - id: print_metadata
    depends: inspect
    env:
      - METADATA: ${steps.inspect.outputs.metadata}
    run: printf '%s\n' "$METADATA"
```

The strict output reference reads a top-level output name. Nested output paths are not part of the strict syntax.

### Human Task Outputs

A [human task](/writing-workflows/human-tasks) derives outputs from its declared form properties. The workflow does not write `DAGU_OUTPUT_FILE` or declare `outputs` on the step.

```yaml
steps:
  - id: choose_region
    action: human.task
    with:
      prompt: Choose the deployment region
      form:
        type: object
        properties:
          region:
            type: string
            enum: [us-east-1, eu-west-1]
        required: [region]

  - id: deploy
    depends: choose_region
    run: ./deploy.sh '${steps.choose_region.outputs.region}'
```

Only declared properties become outputs. The consumer must depend directly or transitively on the human-task step; the output reference does not create the dependency.

### Decision Outputs

A [decision step](/step-types/decision) publishes `answers`, `model`, and `usage` from the provider response, also without `DAGU_OUTPUT_FILE` or a declared `outputs` field.

```yaml
type: graph
steps:
  - id: classify
    action: decision.evaluate
    with:
      provider: openrouter
      model: typesafe/jev-1.13
      state: I was charged twice.
      questions:
        department:
          type: choice
          instructions: Which department should handle this?
          criteria:
            billing: Charges and refunds
            other: Anything else

  - id: notify
    depends: classify
    run: ./notify.sh '${classify.output.answers.department.choice}'
```

Those three names are readable as strict references such as `${steps.classify.outputs.answers}`. Reaching a field inside an answer needs the `${classify.output....}` path form shown above.

## Files

Use files when the data is large or when another process expects a file path.

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: generate
    run: uv run --python 3.13.9 python generate.py > /tmp/data.json

  - id: process
    depends: generate
    run: uv run --python 3.13.9 python process.py < /tmp/data.json
```

When files live at stable paths and unchanged transformations should be reused across runs, use a [build workflow](/writing-workflows/incremental-workflows). Build file declarations infer dependencies and publish an output only after its producer succeeds.

For run-scoped files that users should preview or download, prefer artifacts.

```yaml
steps:
  - id: generate_report
    run: ./generate-report
    stdout:
      artifact: reports/report.md
```

## Standard Input

Use `stdin` when a command reads from standard input rather than from a path argument.
It names a file, and Dagu pipes that file's contents to the step process.

```yaml
steps:
  - id: generate
    run: ./generate > data.json

  - id: process
    depends: generate
    stdin: data.json
    run: ./process
```

Without `stdin`, the same wiring needs a shell redirect inside `run`, which means the
step depends on the selected shell and on quoting the path correctly. A step that does
not set `stdin` receives empty standard input.

`${step_id.stdout}` is the path to that step's captured stdout file, not the text it
printed. That makes it the natural source for `stdin`, and it removes the
`cat "${step_id.stdout}" | command` pattern:

```yaml
steps:
  - id: fetch
    run: ./fetch-report

  - id: summarize
    depends: fetch
    stdin: ${fetch.stdout}
    run: ./summarize
```

### Path Resolution

The path is value-resolved before the command starts.

- A leading `~` expands to the user home directory.
- A relative path resolves against the step working directory, not the workflow file
  directory.
- `$NAME` resolves from the step environment scope. The host process environment is not
  a fallback, which matches `stdout` and `stderr`.

Each entry of an array-form `run` reads the file from its start, so every command in the
step sees the same content.

```yaml
steps:
  - id: inspect
    stdin: payload.json
    run:
      - jq .id
      - jq .status
```

### Which Steps Accept It

Only `run` steps accept `stdin`. Any other action rejects it when the workflow is built,
so a mistake surfaces at `dagu validate` rather than at run time.

- `ssh` does not accept it. The remote shell reads its own script from the session's
  standard input channel, so there is no free channel for a file.
- A root-level `container:` makes every step that inherits it a container step, so no
  step in that workflow accepts `stdin`.
- Harness steps use `with.stdin`, which is inline text rather than a file path. See
  [Harness](/step-types/harness/).

### When It Fails

The step fails, rather than quietly running with empty standard input, when:

- the file cannot be opened for reading
- the path resolves to an empty value
- the path still carries an unresolved reference

That last case is the opposite of `run`, where an unresolved reference is preserved as
literal text. A silently empty standard input is indistinguishable from an unset field,
so `stdin` reports the problem instead.

A step that a [build workflow](/writing-workflows/incremental-workflows) may reuse cannot
be referenced through `${step_id.stdout}` at all, because a reused step produces no new
stdout file. Use a declared path output as the `stdin` source instead.

## Runtime Metadata

Dagu exposes run metadata through the canonical `${context.*}` namespace and also projects selected values into the step environment.

Use `${context.*}` when Dagu should resolve the value before handing a field to the executor:

```yaml
steps:
  - id: archive_log
    run: cp "${context.paths.log_file}" "/backup/${context.run.id}.log"
```

Inside a shell script, native shell syntax is also valid when the process environment should provide the value:

```yaml
steps:
  - id: archive_log
    run: cp "$DAG_RUN_LOG_FILE" "/backup/${DAG_RUN_ID}.log"
```

See [Runtime Context and Variables](/writing-workflows/runtime-variables) for the complete list.

## Output Size

Declared outputs are intended for small values such as ids, paths, status strings, or compact JSON. Large command output should go to a file or artifact.

```yaml
max_output_size: 1048576

steps:
  - id: large_report
    run: ./generate-huge-report
    stdout:
      artifact: reports/huge-report.md
```

## Related Pages

- [Outputs](/writing-workflows/outputs)
- [Build Workflows](/writing-workflows/incremental-workflows)
- [Environment Variables](/writing-workflows/environment-variables)
- [Parameters](/writing-workflows/parameters)
- [Artifacts](/writing-workflows/artifacts)
- [Shell](/step-types/shell)
- [Template Variables](/writing-workflows/template-variables)
