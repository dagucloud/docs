# Data and Variables

Dagu has two different kinds of variable syntax:

- **Dagu value references** are scoped and validated: `${params.name}`, `${env.NAME}`, `${consts.name}`, `${steps.step_id.outputs.name}`, and `${context.run.id}`.
- **Shell variables** are evaluated by the shell or another runtime after Dagu hands off the command: `$NAME`, `${NAME}`, `${NAME:-default}`, and similar shell forms.

Use scoped references in examples where Dagu should validate the source of the value. Use shell syntax only when the shell is intentionally responsible for expansion.

## Import Host Environment Values

Root `env` values may import values from the Dagu process environment:

```yaml
env:
  - AWS_REGION: ${AWS_REGION}
  - AWS_PROFILE: ${AWS_PROFILE}
```

After import, use the scoped environment reference:

```yaml
steps:
  - id: deploy
    run: aws --region "${env.AWS_REGION}" s3 ls
```

For credentials and other sensitive values, prefer `secrets:` instead of copying host values through `env:`.

## Workflow Environment Values

Environment entries are evaluated in order. Later entries can reference earlier entries with `${env.NAME}`.

```yaml
env:
  - BASE_DIR: /tmp/batch
  - INPUT_FILE: ${env.BASE_DIR}/input.csv
  - OUTPUT_DIR: ${env.BASE_DIR}/out

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: process
    run: |
      uv run --python 3.13.9 python main.py \
        --input "${env.INPUT_FILE}" \
        --output "${env.OUTPUT_DIR}"
```

Step-level `env` values can also use scoped references:

```yaml
env:
  - DATA_DIR: /data

steps:
  - id: process_data
    env:
      - INPUT_PATH: ${env.DATA_DIR}/input
      - WORKER_ID: worker_1
    run: ./process.sh "${env.INPUT_PATH}" "${env.WORKER_ID}"
```

## Parameters

Named parameters are runtime inputs. Reference them as `${params.name}`.

```yaml
params:
  - name: environment
    type: string
    default: staging
    enum: [dev, staging, prod]
  - name: batch_size
    type: integer
    default: 100
    minimum: 1

steps:
  - id: run_batch
    run: |
      ./batch.sh \
        --env "${params.environment}" \
        --batch-size "${params.batch_size}"
```

Parameter defaults are literal unless an inline rich parameter uses `eval`.

```yaml
env:
  - BASE_DIR: /srv/data

params:
  - name: output_dir
    eval: "${env.BASE_DIR}/out"
    default: /tmp/out
```

Runtime overrides from the CLI, API, and sub-DAG calls stay literal.

## Parameter JSON Payload

Every step receives the merged parameter payload through `DAGU_PARAMS_JSON`. `DAG_PARAMS_JSON` is also set for compatibility. Use `${env.DAGU_PARAMS_JSON}` when passing that JSON to a value-resolved action field.

```yaml
params:
  - name: environment
    default: dev

steps:
  - id: read_environment
    action: jq.filter
    with:
      filter: '"Environment: \(.environment // "dev")"'
      raw: true
      data: ${env.DAGU_PARAMS_JSON}
```

Inside shell scripts, `$DAGU_PARAMS_JSON` is available as a process environment variable.

## Built-In Run Context

Use `${context.*}` for Dagu-managed metadata about the current run, attempt, step, trigger, path, profile, or push-back scope.

```yaml
handler_on:
  failure:
    run: |
      notify-oncall \
        --dag "${context.dag.name}" \
        --run "${context.run.id}" \
        --log "${context.paths.log_file}"
```

The matching `DAG_*` environment variables are still available for shell scripts. Prefer `${context.*}` in value-resolved YAML fields and `$DAG_*` when the script or subprocess should read its own environment.

## Step Outputs

For validated data passing between steps, declare outputs and write them to `DAGU_OUTPUT_FILE`.

```yaml
steps:
  - id: get_config
    run: |
      printf 'region=us-east-1\n' >> "$DAGU_OUTPUT_FILE"
      printf 'replicas=3\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: region
      - name: replicas

  - id: deploy
    depends: get_config
    run: |
      kubectl set env deployment/app REGION="${steps.get_config.outputs.region}"
      kubectl scale --replicas="${steps.get_config.outputs.replicas}" deployment/app
```

The dependency is required. If `deploy` does not depend on `get_config`, Dagu preserves the reference and can report a `missing_dependency` notice.

## JSON Step Outputs

Use `type: json` when the output value must be valid JSON.

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
    run: printf '%s\n' '${steps.inspect.outputs.metadata}'
```

Strict step-output references address declared top-level output names. Nested paths inside a JSON output are not a strict reference form.

## Files and Artifacts

Use files for larger data. Use artifacts when the run should retain the file for preview or download.

```yaml
artifacts:
  enabled: true

steps:
  - id: generate_report
    run: ./generate-report
    stdout:
      artifact: reports/report.md
```

Publish a small artifact path as an output only when a later step needs the path:

```yaml
steps:
  - id: write_report
    run: |
      path="${context.paths.artifacts_dir}/reports/report.md"
      mkdir -p "$(dirname "$path")"
      ./generate-report > "$path"
      printf 'report_path=%s\n' "$path" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: report_path
```

## Legacy Forms

Older workflows may still use unscoped variables such as `${FOO}`, legacy step references such as `${step.output}`, or frozen built-in context aliases such as `${run.id}`. New documentation examples should prefer scoped references such as `${env.NAME}`, `${steps.step_id.outputs.name}`, and `${context.run.id}` because they give Dagu enough structure to validate names, dependencies, and run-context fields.

## See Also

- [Outputs](/writing-workflows/outputs)
- [Environment Variables](/writing-workflows/environment-variables)
- [Parameters](/writing-workflows/parameters)
- [Runtime Context and Variables](/writing-workflows/runtime-variables)
