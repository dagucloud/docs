# Variables Reference

For a complete list of the automatically injected run metadata, see [Special Environment Variables](/writing-workflows/runtime-variables).

## Environment Variables

### System Environment Variable Filtering

For security, Dagu filters which system environment variables are passed to step processes and sub DAGs.

**How It Works:**

System environment variables are available for expansion (`${VAR}`) when the DAG configuration is parsed, but only filtered variables are passed to the actual step execution environment.

**Filtered Variables:**

Only these system environment variables are automatically passed to step processes and sub DAGs:

- **Whitelisted:** `PATH`, `HOME`, `LANG`, `TZ`, `SHELL`
- **Allowed Prefixes:** `DAGU_*`, `LC_*`, `DAG_*`

The `DAG_*` prefix includes the special environment variables that Dagu automatically sets (see below).

**What This Means:**

You can use `${AWS_SECRET_ACCESS_KEY}` in your DAG YAML for variable expansion, but the `AWS_SECRET_ACCESS_KEY` variable itself won't be available in the environment when your step commands run unless you explicitly define it in the `env` section.

### Defining Environment Variables

Set environment variables available to all steps:

```yaml
env:
  - LOG_LEVEL: debug
  - DATA_DIR: /tmp/data
  - API_URL: https://api.example.com
  - API_KEY: ${SECRET_API_KEY}  # Explicitly reference system environment
```

**Important:** To use sensitive system environment variables in your workflows, you must explicitly reference them in your `env` section as shown above. They will not be automatically available.

### Variable Expansion

Reference other variables:

```yaml
env:
  - BASE_DIR: ${HOME}/data
  - INPUT_DIR: ${BASE_DIR}/input
  - OUTPUT_DIR: ${BASE_DIR}/output
  - CONFIG_FILE: ${INPUT_DIR}/config.yaml
```

### Unknown Variable Handling

When a variable is referenced but not defined in Dagu's context, the behavior depends on the execution context:

**Shell expansion enabled (default for local shell execution):**
Unknown variables become empty strings. This is standard POSIX shell behavior.

**Non-shell executors (docker, http, ssh, jq, mail, etc.):**
OS-only variables not defined in the DAG scope are preserved as-is, letting the target environment resolve them. DAG-scoped variables (env, params, secrets, step outputs) are still expanded normally.

```yaml
# Example: Non-shell executor (SSH)
env:
  - DEPLOY_BRANCH: main

steps:
  - type: ssh
    config:
      user: deploy
      host: remote.example.com
    command: |
      cd $HOME/app                    # $HOME preserved — remote shell resolves it
      git checkout ${DEPLOY_BRANCH}   # Expanded by Dagu — defined in DAG env
```

In this example, `$HOME` is not defined in the DAG scope, so it passes through unchanged to the remote shell. `${DEPLOY_BRANCH}` is defined in the DAG `env:`, so Dagu expands it before sending.

### Literal Dollar Signs

In non-shell contexts (docker, http, ssh, jq, mail, etc.), you can emit a literal `$` by escaping it with a backslash:

```yaml
env:
  - PRICE: '\$9.99'   # Becomes $9.99 at runtime
```

Notes:
- `\$` is only unescaped when Dagu is the final evaluator (non-shell executors and config fields).
- Shell-executed commands keep native shell semantics. Use shell escaping there.
- To get a literal `$$` in non-shell contexts, escape both dollars: `\$\$`.
- In YAML, single quotes preserve backslashes; with double quotes, escape the backslash (e.g., `"\\$9.99"`).

### Loading from .env Files

Load variables from dotenv files:

```yaml
# Single file
dotenv: .env

# Multiple files (loaded in order)
dotenv:
  - .env
  - .env.local
  - configs/.env.${ENVIRONMENT}
```

Example `.env` file:
```bash
DATABASE_URL=postgres://localhost/mydb
API_KEY=secret123
DEBUG=true
```

## Parameters

### Positional Parameters

Define default positional parameters:

```yaml
params: first second third

steps:
  - command: echo "Args: $1 $2 $3"
```

Run with custom values:
```bash
dagu start workflow.yaml -- one two three
```

### Named Parameters

Define named parameters with defaults:

```yaml
params:
  - ENVIRONMENT: dev
  - PORT: 8080
  - DEBUG: false

steps:
  - command: ./server --env=${ENVIRONMENT} --port=${PORT} --debug=${DEBUG}
```

Override at runtime:
```bash
dagu start workflow.yaml -- ENVIRONMENT=prod PORT=80 DEBUG=true
```

### Accessing Parameters as JSON

Every step receives the full parameter map encoded as JSON via `DAG_PARAMS_JSON`. This value reflects the merged defaults plus any runtime overrides. Resolved DAG params are serialized as strings, and when a run is started with raw JSON parameters, the original payload is preserved. Raw JSON may be an object or an array, but named params should use an object. The variable is not set when the DAG has no parameters and none were supplied.

```yaml
steps:
  - id: print_params
    command: echo "Raw payload: ${DAG_PARAMS_JSON}"
  - id: batch_size
    type: jq
    config:
      raw: true
    script: ${DAG_PARAMS_JSON}
    command: '"Batch size: \(.batchSize // "n/a")"'
```

Use this when downstream scripts prefer structured data or when you need access to parameters that were provided as nested JSON.

### Mixed Parameters

Combine positional and named parameters:

```yaml
params:
  - ENVIRONMENT: dev
  - VERSION: latest

steps:
  - command: echo "Deploying $1 to ${ENVIRONMENT} version ${VERSION}"
```

Run with:
```bash
dagu start workflow.yaml -- myapp ENVIRONMENT=prod VERSION=1.2.3
```

## Command Substitution

Execute commands and use their output in `env:` blocks using backticks. This runs the command at DAG load time and stores the result:

```yaml
env:
  - TODAY: "`date +%Y-%m-%d`"
  - HOSTNAME: "`hostname -f`"
  - GIT_COMMIT: "`git rev-parse HEAD`"

steps:
  - command: echo "Deploy on ${TODAY} from ${HOSTNAME}"
```

**Note:** Command substitution is always supported in `env:` blocks. For DAG-level `params:`, use `eval:` on an inline rich param definition when you want `$VAR` expansion or backtick command substitution. Literal `default` values and runtime overrides from the CLI, API, and sub-DAG calls remain literal.

## Output Variables

### Capturing Output

Capture command output to use in later steps:

```yaml
steps:
  - command: cat VERSION
    output: VERSION
  - command: docker build -t myapp:${VERSION} .
```

### Output Size Limits

Control maximum output size:

```yaml
# Global limit for all steps
max_output_size: 5242880  # 5MB

steps:
  - command: cat large-file.json
    output: FILE_CONTENT  # Fails if > 5MB
```

### Redirecting Output

Redirect to files instead of capturing:

```yaml
steps:
  - command: python report.py
    stdout: /tmp/report.txt
    stderr: /tmp/errors.log
```

## JSON Path References

Access nested values in JSON output:

```yaml
steps:
  - command: |
      echo '{"db": {"host": "localhost", "port": 5432}}'
    output: CONFIG
    
  - command: psql -h ${CONFIG.db.host} -p ${CONFIG.db.port}
```

### Sub-workflow Output

Access outputs from nested workflows:

```yaml
steps:
  - call: etl-workflow
    params: "DATE=${TODAY}"
    output: ETL_RESULT
    
  - command: |
      echo "Records processed: ${ETL_RESULT.outputs.record_count}"
      echo "Status: ${ETL_RESULT.outputs.status}"
```

## Step ID References

Reference step properties using IDs:

```yaml
steps:
  - id: risky
    command: 'sh -c "if [ $((RANDOM % 2)) -eq 0 ]; then echo Success; else echo Failed && exit 1; fi"'
    continue_on: failed

  - command: |
      if [ "${risky.exit_code}" = "0" ]; then
        echo "Success! Output was:"
        cat ${risky.stdout}  # Read content from file path
      else
        echo "Failed with code ${risky.exit_code}"
        cat ${risky.stderr}  # Read content from file path
      fi
```

Available properties:
- `${id.exit_code}` - Exit code of the step (as a string, e.g., `"0"` or `"1"`)
- `${id.exit_code}` - Alternative snake_case syntax for exit code
- `${id.stdout}` - Path to stdout log file
- `${id.stderr}` - Path to stderr log file

> **Important**: `${id.stdout}` and `${id.stderr}` return **file paths**, not the actual output content.
>
> - To read content: use `cat ${id.stdout}`
> - To capture output for later steps: use the `output:` field instead
> - Substring slicing like `${id.stdout:0:5}` operates on the **file path string**, not file content

## Variable Precedence

Dagu resolves variables in two places: when interpolating `${VAR}` in DAG fields,
and when constructing the step process environment.

### Interpolation precedence (highest to lowest)

1. **Step-level environment**
   ```yaml
   steps:
     - env:
         - VAR: step-value
   ```

2. **Output variables from earlier steps**
   ```yaml
   steps:
     - command: echo 42
       output: VAR
   ```

3. **Secrets**
   ```yaml
   secrets:
     - name: VAR
       provider: env
       key: VAR
   ```

4. **DAG-level environment (including dotenv)**
   ```yaml
   env:
     - VAR: env-value
   dotenv: .env
   ```

5. **Parameters (defaults + CLI overrides)**
   ```yaml
   params:
     - VAR: dag-default
   ```

6. **Process environment fallback**
   For shell commands, system environment variables are used if the key is not
   set by any of the sources above, and are still subject to filtering at
   execution time. For non-shell executors (docker, http, ssh, jq, mail, etc.),
   OS environment is **not** used as a fallback during variable interpolation —
   only DAG-scoped sources (levels 1–5) are checked. OS-only variables pass
   through unchanged, letting the target environment resolve them.

### Step process environment precedence (lowest to highest)

1. **Filtered system environment**
2. **DAG runtime environment (params + `env` + `.env` + run metadata)**
   If a key appears in both `params` and `env`, the `env` value wins.
3. **Secrets**
4. **Step-level environment**
5. **Output variables from earlier steps**

## See Also

- [Writing Workflows](/writing-workflows/data-variables) - Detailed guide on using variables
- [YAML Specification](/writing-workflows/yaml-specification) - Complete YAML format reference
- [Configuration Reference](/server-admin/reference) - Server configuration variables
