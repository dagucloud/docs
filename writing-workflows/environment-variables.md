# Environment Variables

Environment variables configure the runtime environment for your workflows. Dagu supports defining variables at three levels: base configuration, DAG-level, and step-level.

For centrally managed variables selected when a run starts, use [Runtime Profiles](/writing-workflows/runtime-profiles). Profiles are useful for environment-specific values such as `dev`, `staging`, and `prod` settings without changing the DAG YAML.

## Overview

Variables flow from base configuration through DAG definition to individual steps:

```
Base Config (shared) → DAG-level (workflow-specific) → Step-level (step-specific)
```

Each level can reference and build upon variables from previous levels. Step-level variables override DAG-level variables with the same name.

```yaml
# Example showing all three levels
env:
  - APP_ENV: production      # DAG-level
  - LOG_DIR: ${HOME}/logs    # Reference system variable

steps:
  - id: deploy
    env:
      - APP_ENV: staging     # Overrides DAG-level for this step only
    run: ./deploy.sh
```

## Base Configuration Inheritance

Define shared environment variables in `~/.config/dagu/base.yaml` (or set `DAGU_BASE_CONFIG` to a custom path). All DAGs inherit these variables.

```yaml
# ~/.config/dagu/base.yaml
env:
  - ENVIRONMENT: production
  - API_ENDPOINT: https://api.example.com
  - NOTIFY_EMAIL: ops@example.com
```

### Merging Behavior

DAG-level variables are **appended** to base configuration variables, not replaced:

```yaml
# base.yaml
env:
  - SHARED_VAR: base_value
  - ENV: production

# my-dag.yaml
env:
  - DAG_VAR: dag_value
  - ENV: staging           # Overrides base ENV

# Result at runtime:
# SHARED_VAR=base_value (from base)
# ENV=staging (DAG overrides base)
# DAG_VAR=dag_value (from DAG)
```

### Inherited Fields

The following fields are inherited from base configuration:

| Field | Description |
|-------|-------------|
| `env` | Environment variables (appended) |
| `params` | Default parameters |
| `log_dir` | Log directory |
| `hist_retention_days` | History retention |
| `handler_on` | Lifecycle handlers |
| `smtp` | Email configuration |

## DAG-Level Variables

Define variables accessible to all steps in a workflow:

```yaml
params:
  - name: timestamp
    eval: "`date +%Y%m%d_%H%M%S`"

env:
  - DATA_DIR: /var/data
  - OUTPUT_DIR: ${env.DATA_DIR}/output
  - TIMESTAMP: ${params.timestamp}

tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python process.py --output "${env.OUTPUT_DIR}"
```

### Supported Formats

Dagu supports multiple formats for defining environment variables:

```yaml
# Format 1: Array of Maps (preserves order)
env:
  - KEY1: value1
  - KEY2: value2
  - KEY3: ${env.KEY1}_suffix  # Can reference earlier vars

# Format 2: Simple Map (order not guaranteed)
env:
  KEY1: value1
  KEY2: value2

# Format 3: Array of KEY=value strings
env:
  - KEY1=value1
  - KEY2=value2

# Format 4: Mixed format
env:
  - KEY1: value1
  - KEY2=value2
  - KEY3: ${env.KEY1}
```

**Note**: The array format (Format 1) preserves order, which matters when later variables reference earlier ones. The simple map format (Format 2) does not guarantee order.

### Non-String Values

Non-string values (integers, booleans, floats) are automatically converted to strings:

```yaml
env:
  - PORT: 8080           # Becomes "8080"
  - ENABLED: true        # Becomes "true"
  - RATIO: 0.75          # Becomes "0.75"
```

### Variable Expansion

Reference other variables with the scoped `${env.NAME}` syntax. Earlier variables in the list can be referenced by later ones:

```yaml
env:
  - BASE_PATH: /opt/app
  - BIN_DIR: ${env.BASE_PATH}/bin      # References BASE_PATH
  - CONFIG_FILE: ${env.BASE_PATH}/config.yaml
```

### Referencing Parameters

DAG-level `env:` values can reference `params:` values using `${params.name}`:

```yaml
params:
  data_dir: /tmp/foo

env:
  - FULL_PATH: "${params.data_dir}/output"

steps:
  - run: echo "${env.FULL_PATH}"  # Outputs: /tmp/foo/output
```

Chained references work too. An env variable can reference a param, and a later env variable can reference that env variable:

```yaml
params:
  base: /data

env:
  - DIR: "${params.base}/subdir"
  - FULL: "${env.DIR}/file.txt"

steps:
  - run: echo "${env.FULL}"  # Outputs: /data/subdir/file.txt
```

### Computed Values

Environment entries do not execute backticks or `$()` command substitutions.
Use an inline parameter `eval` when a value must be computed before steps start,
then project the result into `env`:

```yaml
params:
  - name: today
    eval: "`date +%Y-%m-%d`"
  - name: git_commit
    eval: "`git rev-parse --short HEAD`"
  - name: hostname
    eval: "`hostname -f`"

env:
  - TODAY: ${params.today}
  - GIT_COMMIT: ${params.git_commit}
  - HOSTNAME: ${params.hostname}
```

Dynamic evaluation is limited to fields that explicitly opt in, currently inline
parameter `eval` and precondition `eval`. Other value-resolved fields preserve
backticks and `$()` as text. In `run`, the selected shell or script interpreter
may execute that preserved syntax later.

### Referencing System Variables

System environment variables are available during DAG parsing, so you can reference them in `env:` values even when they are not forwarded to the final step process environment. This is best for non-sensitive values:

```yaml
env:
  - AWS_REGION: ${AWS_REGION}
  - AWS_PROFILE: ${AWS_PROFILE}
  - DATABASE_HOST: ${DATABASE_HOST}
```

For credentials and other secrets, use the `secrets:` block instead of copying them through `env:`:

```yaml
secrets:
  - name: AWS_ACCESS_KEY_ID
    provider: env
    key: PROD_AWS_ACCESS_KEY_ID
  - name: AWS_SECRET_ACCESS_KEY
    provider: env
    key: PROD_AWS_SECRET_ACCESS_KEY
  - name: DATABASE_URL
    provider: env
    key: PROD_DATABASE_URL
```

See [Security Considerations](#security-considerations) for the exact filtering rules.

## Step-Level Variables

Define variables specific to individual steps. These override DAG-level variables with the same name:

```yaml
env:
  - LOG_LEVEL: info

steps:
  - id: normal_processing
    run: ./process.sh
    # Uses LOG_LEVEL=info from DAG-level

  - id: debug_processing
    env:
      - LOG_LEVEL: debug    # Overrides for this step only
    run: ./process.sh

  - id: final_step
    run: ./cleanup.sh
    # Uses LOG_LEVEL=info again (step-level doesn't persist)
    depends: [normal_processing, debug_processing]
```

Step-level variables support the same reference-resolution behavior as
DAG-level variables:

```yaml
params:
  - name: hostname
    eval: "`hostname -f`"
  - name: timestamp
    eval: "`date +%Y%m%d_%H%M%S`"

env:
  - DATA_DIR: /data
  - HOSTNAME: ${params.hostname}

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: process_data
    env:
      - INPUT_PATH: ${env.DATA_DIR}/input
      - TIMESTAMP: ${params.timestamp}
      - WORKER_ID: worker_${env.HOSTNAME}
    run: uv run --python 3.13.9 python process.py
```

## Variable Expansion Syntax

### Basic Syntax

Scoped Dagu references work in value-resolved fields. Shell variable syntax is still valid when a shell owns the text:

| Pattern | Description | Example |
|---------|-------------|---------|
| `${env.VAR}` | Dagu-scoped environment reference | `${env.HOME}` -> `/home/user` |
| `${context.run.id}` | Dagu-managed built-in run context reference | `${context.run.id}` -> `20241012_040000_c1f4b2` |
| `$VAR` | Simple substitution | `$HOME` → `/home/user` |
| `${VAR}` | Shell or unqualified environment syntax | `${HOME}` -> `/home/user` |
| `'$VAR'` | Unqualified reference inside retained single quotes | Preserved during Dagu environment expansion |

**Notes:**
- YAML quote delimiters are removed before Dagu evaluates a field. Shell-style
  single quotes protect an unqualified `$VAR` or `${VAR}` only when the quote
  characters remain in the parsed field text. They do not protect Dagu-owned
  references such as `${env.VAR}`. See
  [Value References, Quoting, and Escaping](/writing-workflows/quoting-and-escaping).
- Shell-executed commands keep native shell semantics. Use shell escaping there.

### Unknown Variable Handling

What happens when a variable is not defined depends on the execution context:

| Context | Behavior | Example |
|---------|----------|---------|
| POSIX shell execution | An unset variable normally expands to empty | `$UNDEFINED` → `` |
| Dagu-expanded action and executor fields | Unknown unqualified references remain literal | `$HOME` → `$HOME` |
| SSH or container command text | Preserved text may be expanded by the remote shell or container process | `$HOME` is resolved remotely |
| HTTP, mail, and other fields with no later variable-aware runtime | Preserved text remains literal content | `$HOME` → `$HOME` |
| `template` step `script` | Dagu skips variable expansion entirely | `${HOME}` → `${HOME}` |

General action and executor fields expand values from the current DAG or step
environment scope. An unresolved unqualified reference is preserved, but only a
later variable-aware runtime can expand it. Import host values through root
`env` and use scoped `${env.NAME}` references when Dagu should resolve them.

`template` steps are stricter: the `script` body is never expanded by Dagu, so `${VAR}` remains literal there. If you want expanded values in a template step, pass them through `with.data`.

### POSIX Shell Expansion Syntax

When `run` uses a POSIX shell, that shell can evaluate forms such as:

| Pattern | Description |
|---------|-------------|
| `${VAR:-default}` | Use `default` if VAR is unset or empty |
| `${VAR:=default}` | Set VAR to `default` if unset or empty |
| `${VAR:?message}` | Error with `message` if VAR is unset or empty |
| `${VAR:+alternate}` | Use `alternate` if VAR is set and non-empty |
| `${VAR:offset:length}` | Substring extraction |

These are shell expressions, not general Dagu value-reference forms. Whether a
preserved expression works in SSH or container command text depends on the
remote shell or container process. HTTP, mail, and other non-shell fields do not
evaluate these expressions. Template bodies are left to the template engine.

### Backticks in Shell Commands

In `run`, Dagu leaves backticks for the selected shell or interpreter. Escape
them according to that runtime when literal backticks are required:

```yaml
run: echo "Literal backtick: \`not a command\`"
```

For JSON path access and step output references, see [Variables Reference](/writing-workflows/template-variables).

## Built-In Run Context

Environment variables are one way to read Dagu-managed runtime metadata from a script. In YAML fields where Dagu owns value resolution, prefer the structured context namespace instead:

```yaml
steps:
  - id: notify
    run: notify.sh "${context.dag.name}" "${context.run.id}" "${context.paths.log_file}"
```

Inside shell scripts, the environment projections remain available:

```yaml
steps:
  - id: notify
    run: notify.sh "$DAG_NAME" "$DAG_RUN_ID" "$DAG_RUN_LOG_FILE"
```

See [Runtime Context and Variables](/writing-workflows/runtime-variables) for the complete mapping between `${context.*}` references and `DAG_*` projections.

## Precedence Summary

When the same variable is defined at multiple levels, the highest-precedence value wins:

| Level | Precedence | Description |
|-------|------------|-------------|
| Step `env:` | Highest | Step-specific variables |
| Output variables | ↑ | From previous steps (`output:` field) |
| Secrets | ↑ | From `secrets:` block |
| DAG `env:` + `dotenv` | ↑ | Workflow-level variables |
| Parameters | ↑ | From `params:` and CLI overrides |
| Base config `env:` | ↑ | Shared configuration |
| System environment | Lowest | Filtered OS variables |

For detailed precedence rules, see [Variables Reference - Precedence](/writing-workflows/template-variables#variable-precedence).

## Security Considerations

### System Environment Filtering

Dagu filters the process environment before it builds the step execution environment.

Built-in forwarded variables:

- Unix and macOS exact names: `PATH`, `HOME`, `USER`, `SHELL`, `TMPDIR`, `TERM`, `EDITOR`, `VISUAL`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TZ`, `LD_LIBRARY_PATH`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `DOCKER_HOST`, `DOCKER_TLS_VERIFY`, `DOCKER_CERT_PATH`, `DOCKER_API_VERSION`
- Windows exact names: `USERPROFILE`, `SYSTEMROOT`, `WINDIR`, `SYSTEMDRIVE`, `COMSPEC`, `PATHEXT`, `TEMP`, `TMP`, `PATH`, `PSMODULEPATH`, `HOME`, `DOCKER_HOST`, `DOCKER_TLS_VERIFY`, `DOCKER_CERT_PATH`, `DOCKER_API_VERSION`
- Prefixes on all platforms: `DAGU_`, `DAG_`, `LC_`, `KUBERNETES_`

You can add more forwarded variables with top-level config:

```yaml
env_passthrough:
  - SSL_CERT_FILE
  - HTTP_PROXY
  - HTTPS_PROXY
  - NO_PROXY

env_passthrough_prefixes:
  - AWS_
```

Or with environment variables:

```bash
export DAGU_ENV_PASSTHROUGH=SSL_CERT_FILE,HTTP_PROXY,HTTPS_PROXY,NO_PROXY
export DAGU_ENV_PASSTHROUGH_PREFIXES=AWS_
```

These settings only forward matching variables that already exist in Dagu's process environment. They do not define new variables.

To make a non-sensitive variable available regardless of the host filter, copy it into your workflow explicitly:

```yaml
env:
  - AWS_REGION: ${AWS_REGION}
  - AWS_PROFILE: ${AWS_PROFILE}
```

### Sensitive Values

For sensitive values, use the [Secrets](/writing-workflows/secrets) feature instead of `env:`:

```yaml
secrets:
  - name: AWS_SECRET_ACCESS_KEY
    provider: env
    key: PROD_AWS_SECRET_ACCESS_KEY

steps:
  - run: ./deploy.sh
    # AWS_SECRET_ACCESS_KEY is available but masked in logs
```

For sensitive values that should be selected together with a runtime environment, use [runtime profile secrets](/writing-workflows/runtime-profiles#profile-entries). Profile secrets are injected as secrets and masked like values from the DAG `secrets:` block.

## See Also

- [Data & Variables](/writing-workflows/data-variables) - Complete data handling guide
- [Variables Reference](/writing-workflows/template-variables) - Full variable syntax reference
- [Value References, Quoting, and Escaping](/writing-workflows/quoting-and-escaping) - How YAML, Dagu, and shell evaluation interact
- [Runtime Context and Variables](/writing-workflows/runtime-variables) - Built-in `${context.*}` references and `DAG_*` projections
- [Secrets](/writing-workflows/secrets) - Secure secret management
