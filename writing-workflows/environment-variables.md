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
env:
  - DATA_DIR: /var/data
  - OUTPUT_DIR: ${env.DATA_DIR}/output
  - TIMESTAMP: "`date +%Y%m%d_%H%M%S`"

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

### Command Substitution

Execute commands at DAG load time using backticks:

```yaml
env:
  - TODAY: "`date +%Y-%m-%d`"
  - GIT_COMMIT: "`git rev-parse --short HEAD`"
  - HOSTNAME: "`hostname -f`"
```

This load-time substitution applies to configuration fields that Dagu evaluates as data, such as `env:`, `dotenv:` paths, and inline param `eval:` values. Runtime step fields such as `command`, `stdout`, `stderr`, sub-DAG `params`, and executor `with:` config still use normal runtime evaluation, including backticks. Command-step `script` is narrower: Dagu replaces variables there but leaves backticks for the shell.

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

Step-level variables support the same features as DAG-level:

```yaml
env:
  - DATA_DIR: /data
  - HOSTNAME: "`hostname -f`"

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: process_data
    env:
      - INPUT_PATH: ${env.DATA_DIR}/input
      - TIMESTAMP: "`date +%Y%m%d_%H%M%S`"
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
| `'$VAR'` | Single-quoted (no expansion) | `'$VAR'` → `'$VAR'` |
| `\$` | Literal dollar (non-shell only) | `\$9.99` → `$9.99` |

**Notes:**
- `\$` is only unescaped when Dagu is the final evaluator (non-shell executors and `with` fields).
- Shell-executed commands keep native shell semantics. Use shell escaping there.
- To get a literal `$$` in non-shell contexts, escape both dollars: `\$\$`.

### Unknown Variable Handling

What happens when a variable is not defined depends on the execution context:

| Context | Behavior | Example |
|---------|----------|---------|
| Local shell execution (default) | Unknown vars become empty | `$UNDEFINED` → `` |
| Non-shell executors (docker, http, ssh, jq, mail, etc.) | OS-only vars preserved as-is | `$HOME` → `$HOME` |
| `template` step `script` | Dagu skips variable expansion entirely | `${HOME}` → `${HOME}` |

For non-shell executors, OS-only variables not defined in the DAG scope pass through unchanged to the target environment (container, remote shell, etc.), which resolves them. DAG-scoped variables (env, params, secrets, step outputs) are still expanded normally.

`template` steps are stricter: the `script` body is never expanded by Dagu, so `${VAR}` remains literal there. If you want expanded values in a template step, pass them through `with.data`.

### Shell Expansion Syntax (Local Execution Only)

When executing commands locally with the default shell executor, Dagu uses POSIX shell expansion via [mvdan.cc/sh](https://github.com/mvdan/sh). These patterns work only in that context:

| Pattern | Description |
|---------|-------------|
| `${VAR:-default}` | Use `default` if VAR is unset or empty |
| `${VAR:=default}` | Set VAR to `default` if unset or empty |
| `${VAR:?message}` | Error with `message` if VAR is unset or empty |
| `${VAR:+alternate}` | Use `alternate` if VAR is set and non-empty |
| `${VAR:offset:length}` | Substring extraction |

These patterns do **not** work for non-shell executors (docker, http, ssh, jq, mail, etc.). In those cases, only basic `$VAR` and `${VAR}` syntax is supported, and OS-only variables pass through unchanged to the target environment. `template` steps are stricter still: their `script` body is not expanded at all.

### Escaped Backticks

To use literal backticks without command substitution:

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
- [Runtime Context and Variables](/writing-workflows/runtime-variables) - Built-in `${context.*}` references and `DAG_*` projections
- [Secrets](/writing-workflows/secrets) - Secure secret management
