# Data Flow

Data moves through a workflow by parameters, environment values, declared step outputs, files, and artifacts.

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

For run-scoped files that users should preview or download, prefer artifacts.

```yaml
steps:
  - id: generate_report
    run: ./generate-report
    stdout:
      artifact: reports/report.md
```

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
- [Environment Variables](/writing-workflows/environment-variables)
- [Parameters](/writing-workflows/parameters)
- [Artifacts](/writing-workflows/artifacts)
