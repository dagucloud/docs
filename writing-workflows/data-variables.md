# Data and Variables

Dagu provides multiple ways to handle data and variables in your DAGs, from simple environment variables to complex parameter passing between steps.

## Environment Variables

### System Environment Variable Filtering

Dagu filters the process environment before it builds the step execution environment and before it starts sub-DAG executions.

System environment variables are still available for expansion (`${VAR}`) in DAG configuration. For non-shell executors, OS-only variables in executor `with` fields, step `env:`, and similar fields pass through unchanged when they are not resolved by Dagu. `template` steps are a special case: the `script` body is not expanded by Dagu, while `with.data` values are expanded before rendering.

The built-in forwarded environment is:

- Unix and macOS exact names: `PATH`, `HOME`, `USER`, `SHELL`, `TMPDIR`, `TERM`, `EDITOR`, `VISUAL`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TZ`, `LD_LIBRARY_PATH`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `DOCKER_HOST`, `DOCKER_TLS_VERIFY`, `DOCKER_CERT_PATH`, `DOCKER_API_VERSION`
- Windows exact names: `USERPROFILE`, `SYSTEMROOT`, `WINDIR`, `SYSTEMDRIVE`, `COMSPEC`, `PATHEXT`, `TEMP`, `TMP`, `PATH`, `PSMODULEPATH`, `HOME`, `DOCKER_HOST`, `DOCKER_TLS_VERIFY`, `DOCKER_CERT_PATH`, `DOCKER_API_VERSION`
- Allowed prefixes on all platforms: `DAGU_`, `DAG_`, `LC_`, `KUBERNETES_`

You can add exact names and prefixes in Dagu configuration:

```yaml
env_passthrough:
  - SSL_CERT_FILE
  - HTTP_PROXY

env_passthrough_prefixes:
  - AWS_
```

Or with environment variables:

```bash
export DAGU_ENV_PASSTHROUGH=SSL_CERT_FILE,HTTP_PROXY
export DAGU_ENV_PASSTHROUGH_PREFIXES=AWS_
```

These settings do not create variables by themselves. They only allow matching variables that already exist in Dagu's process environment to be forwarded to steps.

**To Use Sensitive Variables:**

You can reference system variables like `${AWS_SECRET_ACCESS_KEY}` in your YAML for substitution, but to make them available in the step process environment, define them in the `env` section:

```yaml
env:
  - AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}      # Available in step environment
  - AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  - DATABASE_URL: ${DATABASE_URL}
```

Or use `.env` files (recommended):

```yaml
dotenv: .env.secrets
```

This keeps step environment contents explicit.

### DAG-Level Environment Variables

Define variables accessible throughout the DAG:

```yaml
env:
  - SOME_DIR: ${HOME}/batch
  - SOME_FILE: ${SOME_DIR}/some_file
steps:
  - working_dir: ${SOME_DIR}
    command: python main.py ${SOME_FILE}
```

### Step-Level Environment Variables

You can also define environment variables specific to individual steps. Step-level variables override DAG-level variables with the same name:

```yaml
env:
  - SHARED_VAR: dag_value
  - DAG_ONLY: dag_only_value

steps:
  - command: echo $SHARED_VAR
    env:
      - SHARED_VAR: step_value  # Overrides the DAG-level value
      - STEP_ONLY: step_only_value
    # Output: step_value
  
  - command: echo $SHARED_VAR $DAG_ONLY
    # Output: dag_value dag_only_value
```

Step environment variables support the same features as DAG-level variables, including command substitution and references to other variables:

```yaml
env:
  - BASE_PATH: /data

steps:
  - id: process_data
    command: python process.py
    env:
      - INPUT_PATH: ${BASE_PATH}/input
      - TIMESTAMP: "`date +%Y%m%d_%H%M%S`"
      - WORKER_ID: worker_${HOSTNAME}
```

## Dotenv Files

Specify `.env` files to load environment variables from.

> **Note**: If `dotenv` is not specified, Dagu automatically loads `.env` from the working directory. To disable this default behavior, use `dotenv: []`.

```yaml
dotenv: .env  # Load a single dotenv file

# Load multiple files - all files are loaded, later override earlier
dotenv:
  - .env.defaults     # Loaded first
  - .env.local        # Overrides .env.defaults
  - .env.production   # Overrides both
```

**Loading behavior:**
- If `dotenv` is not specified, Dagu loads `.env` by default
- When files are specified, `.env` is automatically prepended to the list (and deduplicated if already included)
- All files are loaded sequentially in order
- Variables from later files override variables from earlier files
- Missing files are silently skipped
- To disable all dotenv loading (including `.env`), use `dotenv: []`

Files can be specified as:
- Absolute paths
- Relative to the DAG file directory
- Relative to the base config directory
- Relative to the user's home directory

### Dynamic Paths

Dotenv paths support variable expansion and command substitution:

```yaml
dotenv:
  - ${HOME}/.config/app/.env
  - "`pwd`/.env.local"
  - .env.${ENVIRONMENT}  # e.g., .env.production
```

### Loading Order

Dotenv files are loaded **before** secrets resolution. The `env` secret provider can read variables loaded from dotenv files:

```yaml
# .env contains: PROD_TOKEN=secret-value
dotenv: .env

secrets:
  - name: TOKEN
    provider: env
    key: PROD_TOKEN
```

Secret `key` and `options` fields are literal provider inputs. Dagu does not expand `${...}` inside them.

```yaml
# Disable dotenv loading entirely
dotenv: []
```

## Secrets

Use the `secrets` block to declare sensitive values without embedding them in YAML. Each secret defines an environment variable that is resolved at runtime from a provider and injected before the DAG runs:

```yaml
secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN    # Read from process environment
  - name: DB_PASSWORD
    provider: file
    key: secrets/db-pass   # Relative to working_dir, then the DAG file directory

steps:
  - id: migrate
    command: ./migrate.sh
    env:
      - STRICT_MODE: "1"   # Step-level env still overrides secrets if needed
```

### Built-in providers

- `env` reads from existing environment variables. Use it when CI/CD or your process manager injects secrets into the runtime environment.
- `file` reads from files. Relative paths first try the DAG’s `working_dir`, then fall back to the directory containing the DAG file.
- `kubernetes` reads one data key from a Kubernetes Secret resource.
- `vault` reads one field from a HashiCorp Vault secret response.

Providers can expose additional configuration through the optional `options` map. Values must be strings so they can be forwarded to provider-specific clients.

### Resolution and masking

Secrets are evaluated after DAG-level variables and system-provided runtime variables, so they override values defined in `env` or `.env` files unless a step sets its own value. Dagu masks exact non-empty secret values in managed step logs and in final collected outputs.

Read the dedicated [Secrets guide](/writing-workflows/secrets) for provider details, resolution order, and masking behavior.

## Parameters

### Positional Parameters

Define default positional parameters that can be overridden:

```yaml
params: param1 param2     # Default values for $1 and $2
steps:
  - command: python main.py $1 $2  # Will use command-line args or defaults
```

### Named Parameters

Define default named parameters that can be overridden:

```yaml
params:
  - FOO: 1           # Default value for ${FOO}
  - BAR: hello       # Default value for ${BAR}
steps:
  - command: python main.py ${FOO} ${BAR}  # Will use command-line args or defaults
```

Parameter defaults are literal by default. If you need `$VAR` expansion or backtick command substitution for a DAG param, use `eval:` on an inline rich param definition (`- name: ...`). Runtime overrides from the CLI, API, and sub-DAG calls remain literal. See [Parameters](/writing-workflows/parameters) for precedence, fallback, and validation rules.

Inline rich definitions add validation and UI metadata while keeping runtime values string-based:

```yaml
params:
  - name: environment
    type: string
    default: staging
    enum: [dev, staging, prod]
    description: Deployment target
  - name: batch_size
    type: integer
    default: 100
    minimum: 1
    maximum: 1000
steps:
  - command: python main.py --env "${environment}" --batch "${batch_size}"
```

CLI/API/sub-DAG inputs are coerced to the declared type before validation, but step commands still receive strings.

## Output Handling

### Working with Parameters as JSON

Every step automatically receives the merged parameter payload as JSON through the `DAG_PARAMS_JSON` environment variable. This is especially helpful when parameters were provided as nested JSON via the CLI or API.

```yaml
steps:
  - id: inspect_params
    command: echo "Full payload: ${DAG_PARAMS_JSON}"
  - id: region_lookup
    type: jq
    with:
      raw: true
    script: ${DAG_PARAMS_JSON}
    command: '"Region: \(.region // "us-east-1")"'
```

If the run was started with raw JSON parameters, the original payload is preserved verbatim; otherwise, Dagu serializes the resolved key/value pairs from your `params` block plus any overrides as a string-only JSON object. Raw JSON may be an object or an array, but named params should use an object. Inline typed params do not change this behavior.

### Capture Output

Store command output in variables:

```yaml
steps:
  - command: "echo foo"
    output: FOO  # Will contain "foo"
```

**Output Size Limits**: To prevent memory issues from large command outputs, Dagu enforces a size limit on captured output. By default, this limit is 1MB. If a step's output exceeds this limit, the step will fail with an error.

You can configure the maximum output size at the DAG level:

```yaml
# Set maximum output size to 5MB for all steps in this DAG
max_output_size: 5242880  # 5MB in bytes

steps:
  - command: "cat large-file.txt"
    output: CONTENT  # Will fail if file exceeds 5MB
```

Object-form `output:` publishes structured step-scoped values instead of one flat variable:

```yaml
steps:
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

Use `${inspect_build.output.version}` and `${inspect_build.output.artifact.url}` in downstream steps. Object-form output does not add a flat `${VAR}` name and is not collected into `outputs.json`.

### Redirect Output

Send output to files:

```yaml
steps:
  - command: "echo hello"
    stdout: "/tmp/hello"
  - command: "echo error message >&2"
    stderr: "/tmp/error.txt"
```

### JSON References

You can use JSON references in fields to dynamically expand values from variables. JSON references are denoted using the `${NAME.path.to.value}` syntax, where `NAME` refers to a variable name and `path.to.value` specifies the path in the JSON to resolve. If the data is not JSON format, the value will not be expanded.

Examples:

```yaml
steps:
  - call: sub_workflow
    output: SUB_RESULT
  - command: echo "The result is ${SUB_RESULT.outputs.finalValue}"
```

If `SUB_RESULT` contains:

```json
{
  "outputs": {
    "finalValue": "succeeded"
  }
}
```

Then the expanded value of `${SUB_RESULT.outputs.finalValue}` will be `succeeded`.

## Step ID References

You can assign short identifiers to steps and use them to reference step properties in subsequent steps. This is particularly useful when you have long step names or want cleaner variable references:

```yaml
type: graph
steps:
  - id: extract  # Short identifier
    command: python extract.py
    output: DATA  # Captures stdout content into DATA variable

  - id: validate
    command: python validate.py
    depends:
      - command: extract  # Can use ID in dependencies

  - command: |
      # Reference step properties using IDs
      echo "Exit code: ${extract.exit_code}"
      echo "Stdout file: ${extract.stdout}"
      cat ${extract.stdout}  # Read content from the file
    depends: validate
```

Available step properties when using ID references:
- `${id.stdout}`: Path to stdout file
- `${id.stderr}`: Path to stderr file
- `${id.exit_code}`: Exit code of the step (as a string)
- `${id.output}`: Captured string output or structured object-form output payload

> **Important**: `${id.stdout}` and `${id.stderr}` return **file paths**, not the actual output content. Use `cat ${id.stdout}` to read the content.
>
> `${id.output}` returns:
> - the captured text value for string-form `output: NAME`
> - the full published object as compact JSON for object-form `output: {...}`
>
> Nested access works with `${id.output.foo}`. If the referenced step does not have `output:` configured, the reference is not expanded and passes through as a literal.

## Command Substitution

Use command output in configurations:

```yaml
env:
  TODAY: "`date '+%Y%m%d'`"
steps:
  - command: "echo hello, today is ${TODAY}"
```

## Sub-workflow Data

The result of the sub workflow will be available from the standard output of the sub workflow in JSON format.

```yaml
steps:
  - call: sub_workflow
    params: "FOO=BAR"
    output: SUB_RESULT
  - command: echo $SUB_RESULT
```

Example output format:

```json
{
  "name": "sub_workflow",
  "params": "FOO=BAR",
  "outputs": {
    "RESULT": "ok"
  }
}
```

## Passing Data Between Steps

### Through Output Variables

```yaml
type: graph
steps:
  - id: get_config
    command: |
      echo '{"env": "prod", "replicas": 3, "region": "us-east-1"}'
    output: CONFIG

  - id: get_secrets
    command: vault read -format=json secret/app
    output: SECRETS

  - command: |
      kubectl set env deployment/app \
        REGION=${CONFIG.region} \
        API_KEY=${SECRETS.data.api_key}
      kubectl scale --replicas=${CONFIG.replicas} deployment/app
    depends: [get_config, get_secrets]
```

### Through Files

```yaml
steps:
  - command: python generate.py
    stdout: /tmp/data.json
  
  - command: python process.py < /tmp/data.json
```

## Global Configuration

Common settings can be shared using `$HOME/.config/dagu/base.yaml`. This is useful for setting default values for:
- `env` - Shared environment variables
- `params` - Default parameters
- `log_dir` - Default log directory
- Other organizational defaults

Example base configuration:

```yaml
# ~/.config/dagu/base.yaml
env:
  - ENVIRONMENT: production
  - API_ENDPOINT: https://api.example.com
params:
  - DEFAULT_BATCH_SIZE: 100
log_dir: /var/log/dagu
```

Individual DAGs inherit these settings and can override them as needed.
