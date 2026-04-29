# Data Flow

How data moves through your workflows - from parameters to outputs, between steps, and across workflows.

## Overview

Dagu provides multiple mechanisms for passing data through workflows:

- Output Variables - Capture command output for use in later steps
- Environment Variables - Define variables accessible to all steps
- Parameters - Pass runtime values into workflows
- File-based Passing - Redirect output to files
- JSON Path References - Access nested data structures
- Step ID References - Reference step properties and files
- Sub DAG Outputs - Capture results from sub-workflows
- DAG Run Outputs - Collect string-form outputs into a structured file for viewing and API access

## Output Variables

Capture command output and use it in subsequent steps:

```yaml
steps:
  - command: cat VERSION
    output: VERSION

  - command: docker build -t myapp:${VERSION} .
```

### How It Works

1. Command stdout is captured (up to `max_output_size` limit)
2. Stored in the variable name specified by `output`
3. Available to all downstream steps via `${VARIABLE_NAME}`
4. Trailing newlines are automatically trimmed
5. String-form `output: NAME` values are collected into `outputs.json` for the DAG run (see [DAG Run Outputs](#dag-run-outputs))

### String vs Object Form

The `output` field supports both string and object forms:

```yaml
steps:
  # Simple string form
  - id: get_version
    command: cat VERSION
    output: VERSION

  # Object form publishes structured step-scoped output
  - id: inspect_build
    script: |
      printf '{"version":"v1.2.3","artifact":{"url":"https://example.test/app.tgz"}}'
    output:
      version:
        from: stdout
        decode: json
        select: .version
      artifact:
        from: stdout
        decode: json
        select: .artifact
```

String form captures stdout into one flat variable and includes it in `outputs.json`.

Object form publishes structured step output for `${step_id.output.*}` references. Each entry can be:

- a literal value
- `from: stdout`
- `from: stderr`
- `from: file`

with optional `decode: json|yaml|text` and `select: .path.to.value`.

### Multiple Outputs

String-form `output: NAME` captures one flat variable per step. Use object-form output when one step should publish multiple structured values:

```yaml
type: graph
steps:
  - id: count_users
    command: wc -l < users.txt
    output: USER_COUNT

  - id: count_orders
    command: wc -l < orders.txt
    output: ORDER_COUNT

  - id: report
    command: |
      echo "Users: ${USER_COUNT}"
      echo "Orders: ${ORDER_COUNT}"
    depends:
      - count_users
      - count_orders
```

## JSON Path References

Access nested values in JSON output using dot notation:

```yaml
steps:
  - command: |
      echo '{
        "database": {
          "host": "localhost",
          "port": 5432,
          "credentials": {
            "username": "app_user"
          }
        }
      }'
    output: CONFIG
    
  - command: |
      psql -h ${CONFIG.database.host} \
           -p ${CONFIG.database.port} \
           -U ${CONFIG.database.credentials.username}
```

### Array Access

Access array elements by index:

```yaml
steps:
  - command: |
      echo '[
        {"name": "web1", "ip": "10.0.1.1"},
        {"name": "web2", "ip": "10.0.1.2"}
      ]'
    output: SERVERS
    
  - command: ping -c 1 ${SERVERS[0].ip}
```

## Environment Variables

### DAG-Level Variables

Define variables available to all steps:

```yaml
env:
  - LOG_LEVEL: debug
  - DATA_DIR: /var/data
  - API_URL: https://api.example.com

steps:
  - command: python process.py --log=${LOG_LEVEL} --data=${DATA_DIR}
```

### Variable Expansion

Reference other variables:

```yaml
env:
  - BASE_DIR: ${HOME}/project
  - DATA_DIR: ${BASE_DIR}/data
  - OUTPUT_DIR: ${BASE_DIR}/output
  - CONFIG_FILE: ${DATA_DIR}/config.yaml
```

### Command Substitution

Execute commands and use their output:

```yaml
env:
  - TODAY: "`date +%Y-%m-%d`"
  - GIT_COMMIT: "`git rev-parse HEAD`"
  - HOSTNAME: "`hostname -f`"

steps:
  - command: tar -czf backup-${TODAY}-${GIT_COMMIT}.tar.gz data/
```

## Parameters

### Named Parameters

Define parameters with defaults:

```yaml
params:
  - ENVIRONMENT: dev
  - BATCH_SIZE: 100
  - DRY_RUN: false

steps:
  - command: |
      echo "Processing data" \
        --env=${ENVIRONMENT} \
        --batch=${BATCH_SIZE} \
        --dry-run=${DRY_RUN}
```

Override at runtime:
```bash
dagu start workflow.yaml -- ENVIRONMENT=prod BATCH_SIZE=500
```

### Dynamic Values

Use `env:` for computed values. DAG-level `params:` are treated as literal input and do not evaluate backticks or `${VAR}`.

```yaml
env:
  - DATE: "`date +%Y-%m-%d`"
  - RUN_ID: "`uuidgen`"
  - USER: "`whoami`"
```

## Step ID References

Reference step properties using the `id` field:

```yaml
steps:
  - id: risky
    command: 'sh -c "if [ $((RANDOM % 2)) -eq 0 ]; then echo Success; else echo Failed && exit 1; fi"'
    continue_on:
      failure: true

  - command: |
      if [ "${risky.exit_code}" = "0" ]; then
        echo "Success! Checking output..."
        cat ${risky.stdout}  # Read content from the file
      else
        echo "Failed with code ${risky.exit_code}"
        echo "Error log:"
        cat ${risky.stderr}  # Read content from the file
      fi
```

Available properties:
- `${id.exit_code}` - Exit code of the step (as a string, e.g., `"0"` or `"1"`)
- `${id.stdout}` - Path to stdout log file
- `${id.stderr}` - Path to stderr log file
- `${id.output}` - Captured string output or structured object-form payload (requires `output:` on the referenced step)

> **Important**: `${id.stdout}` and `${id.stderr}` return **file paths**, not the actual output content. Use `cat ${id.stdout}` to read the content. To capture output content directly into a variable for use in subsequent steps, use the `output:` field instead.

### Step Output References

When a step has an `output:` field, downstream steps can access it via `${id.output}`:

```yaml
type: graph
steps:
  - id: extract_title
    output: RESULT
    script: |
      printf 'Quarterly Revenue'

  - id: extract_summary
    output: RESULT
    script: |
      printf 'Revenue grew 18 percent year over year.'

  - id: report
    depends: [extract_title, extract_summary]
    script: |
      printf 'Title: %s\nSummary: %s' "${extract_title.output}" "${extract_summary.output}"
    output: REPORT
```

String-form `${id.output}` returns the captured text value.

Object-form `${id.output}` returns the full published object as compact JSON, and nested access works directly:

```yaml
steps:
  - id: publish
    output:
      version: "v1.2.3"
      artifact:
        url: "https://example.test/app.tgz"

  - command: |
      echo "Version: ${publish.output.version}"
      echo "Artifact: ${publish.output.artifact.url}"
```

`${id.output}` vs `${id.stdout}`:
- `${id.output}` returns the captured value or published object payload.
- `${id.stdout}` returns a **file path** to the stdout log. Use `cat ${id.stdout}` to read it.

If the referenced step does not have `output:` configured, `${id.output}` is not expanded — it passes through as a literal string.

Substring slicing works on the output value: `${id.output:0:5}` extracts the first 5 characters of the captured output.

## Sub DAG Outputs

Capture outputs from nested workflows:

### Basic Child Output

```yaml
# parent.yaml
steps:
  - call: etl-workflow
    params: "DATE=${TODAY}"
    output: ETL_RESULT
    
  - command: |
      echo "Status: ${ETL_RESULT.status}"
      echo "Records: ${ETL_RESULT.outputs.record_count}"
      echo "Duration: ${ETL_RESULT.outputs.duration}"
```

### Output Structure

Sub DAG output contains:
```json
{
  "name": "etl-workflow",
  "params": "DATE=2024-01-15",
  "status": "succeeded",
  "outputs": {
    "record_count": "1000",
    "duration": "120s"
  }
}
```

### Nested DAG Outputs

Access outputs from deeply nested workflows:

```yaml
steps:
  - call: main-pipeline
    output: PIPELINE
    
  - command: |
      # Access nested outputs
      echo "ETL Status: ${PIPELINE.outputs.ETL_OUTPUT.status}"
      echo "ML Score: ${PIPELINE.outputs.ML_OUTPUT.outputs.accuracy}"
```

## Parallel Execution Outputs

When running parallel executions, outputs are aggregated:

```yaml
steps:
  - call: region-processor
    parallel:
      items: ["us-east", "us-west", "eu-central"]
    output: RESULTS
    
  - command: |
      echo "Total regions: ${RESULTS.summary.total}"
      echo "Succeeded: ${RESULTS.summary.succeeded}"
      echo "Failed: ${RESULTS.summary.failed}"
      
      # Access individual results
      echo "US-East revenue: ${RESULTS.outputs[0].revenue}"
      echo "US-West revenue: ${RESULTS.outputs[1].revenue}"
```

### Parallel Output Structure

```json
{
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0
  },
  "results": [
    {
      "params": "us-east",
      "status": "succeeded",
      "outputs": {
        "revenue": "1000000"
      }
    }
    // ... more results
  ],
  "outputs": [
    {"revenue": "1000000"},
    {"revenue": "750000"},
    {"revenue": "500000"}
  ]
}
```

## File-Based Data Passing

### Output Redirection

Redirect output to files for large data:

```yaml
steps:
  - command: python generate_report.py
    stdout: /tmp/report.txt
    
  - command: mail -s "Report" user@example.com < /tmp/report.txt
```

### Working with Files

```yaml
steps:
  - command: |
      tar -xzf data.tar.gz -C /tmp/
      ls /tmp/data/ > /tmp/filelist.txt
    
  - command: |
      while read file; do
        process.sh "/tmp/data/$file"
      done < /tmp/filelist.txt
```

## Special Environment Variables

Dagu automatically injects run metadata such as `DAG_RUN_ID`, `DAG_RUN_STEP_NAME`, and log file locations. See [Special Environment Variables](/writing-workflows/runtime-variables) for the complete reference.

Example usage:
```yaml
steps:
  - command: |
      echo "Backing up logs for ${DAG_NAME} run ${DAG_RUN_ID}"
      cp ${DAG_RUN_LOG_FILE} /backup/
```

## Output Size Limits

Control maximum output size to prevent memory issues:

```yaml
# Set 5MB limit for all steps
max_output_size: 5242880

steps:
  - command: cat large-file.json
    output: DATA  # Fails if output > 5MB
    
  - command: generate-huge-file.sh
    stdout: /tmp/huge.txt  # No size limit with file redirection
```

## Variable Resolution Order

Variables are resolved with step-level taking highest precedence:

1. **Step-level environment** - Overrides everything
2. **Output variables** - From completed steps
3. **Secrets** - From `secrets:` block
4. **DAG-level environment** - Includes `env:` and `dotenv` files

Example:
```yaml
env:
  - MESSAGE: "DAG level"

steps:
  - env:
      - MESSAGE: "Step level"  # This wins
    command: echo "${MESSAGE}"
```

For detailed precedence rules including interpolation vs runtime environment, see [Variables Reference](/writing-workflows/template-variables#variable-precedence).

## DAG Run Outputs

Only string-form `output: NAME` values are collected into `outputs.json` when the DAG completes. Object-form `output: {...}` stays step-scoped for `${step.output.*}` references and is not written to the run outputs file.

See [Outputs](/writing-workflows/outputs) for complete documentation on output collection, access methods, and security features.
