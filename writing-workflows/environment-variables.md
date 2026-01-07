# Environment Variables

Environment variables configure the runtime environment for your workflows. Dagu supports defining variables at three levels: base configuration, DAG-level, and step-level.

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
  - name: deploy
    env:
      - APP_ENV: staging     # Overrides DAG-level for this step only
    command: ./deploy.sh
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
| `logDir` | Log directory |
| `histRetentionDays` | History retention |
| `handlerOn` | Lifecycle handlers |
| `smtp` | Email configuration |

## DAG-Level Variables

Define variables accessible to all steps in a workflow:

```yaml
env:
  - DATA_DIR: /var/data
  - OUTPUT_DIR: ${DATA_DIR}/output
  - TIMESTAMP: "`date +%Y%m%d_%H%M%S`"

steps:
  - command: python process.py --output ${OUTPUT_DIR}
```

### Variable Expansion

Reference other variables using `${VAR}` or `$VAR` syntax. Earlier variables in the list can be referenced by later ones:

```yaml
env:
  - BASE_PATH: /opt/app
  - BIN_DIR: ${BASE_PATH}/bin      # References BASE_PATH
  - CONFIG_FILE: ${BASE_PATH}/config.yaml
```

### Command Substitution

Execute commands at DAG load time using backticks:

```yaml
env:
  - TODAY: "`date +%Y-%m-%d`"
  - GIT_COMMIT: "`git rev-parse --short HEAD`"
  - HOSTNAME: "`hostname -f`"
```

### Referencing System Variables

For security, Dagu filters which system environment variables are available. To use system variables in your workflow, explicitly reference them:

```yaml
env:
  - AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
  - AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  - DATABASE_URL: ${DATABASE_URL}
```

See [Security Considerations](#security-considerations) for details on variable filtering.

## Step-Level Variables

Define variables specific to individual steps. These override DAG-level variables with the same name:

```yaml
env:
  - LOG_LEVEL: info

steps:
  - name: normal-processing
    command: ./process.sh
    # Uses LOG_LEVEL=info from DAG-level

  - name: debug-processing
    env:
      - LOG_LEVEL: debug    # Overrides for this step only
    command: ./process.sh

  - name: final-step
    command: ./cleanup.sh
    # Uses LOG_LEVEL=info again (step-level doesn't persist)
```

Step-level variables support the same features as DAG-level:

```yaml
steps:
  - name: process-data
    env:
      - INPUT_PATH: ${DATA_DIR}/input
      - TIMESTAMP: "`date +%Y%m%d_%H%M%S`"
      - WORKER_ID: worker_${HOSTNAME}
    command: python process.py
```

## Variable Expansion Syntax

Dagu supports several expansion patterns:

| Pattern | Description | Example |
|---------|-------------|---------|
| `${VAR}` | Basic substitution | `${HOME}` → `/home/user` |
| `$VAR` | Short form | `$HOME` → `/home/user` |
| `${VAR:-default}` | Default if unset | `${PORT:-8080}` → `8080` |
| `${VAR:0:5}` | Substring (offset:length) | `${DATE:0:4}` → year portion |

For full syntax including JSON path access and step output references, see [Variables Reference](/reference/variables).

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

For detailed precedence rules, see [Variables Reference - Precedence](/reference/variables#variable-precedence).

## Security Considerations

### System Environment Filtering

Dagu filters which system environment variables are passed to step processes for security.

**Automatically passed:**
- `PATH`, `HOME`, `LANG`, `TZ`, `SHELL`
- Variables with prefixes: `DAGU_*`, `LC_*`, `DAG_*`

**Filtered out:**
- All other system variables (e.g., `AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`)

**To use sensitive system variables**, explicitly reference them in your `env:` section:

```yaml
env:
  - AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
  - AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
```

### Sensitive Values

For truly sensitive values, use the [Secrets](/writing-workflows/secrets) feature instead of `env:`:

```yaml
secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN

steps:
  - command: ./deploy.sh
    # API_TOKEN is available but masked in logs
```

## Best Practices

1. **Use array format for order-dependent variables**
   ```yaml
   env:
     - BASE: /opt/app
     - CONFIG: ${BASE}/config.yaml  # Must come after BASE
   ```

2. **Use base config for organization-wide defaults**
   ```yaml
   # ~/.config/dagu/base.yaml
   env:
     - ENVIRONMENT: production
     - NOTIFY_CHANNEL: "#ops-alerts"
   ```

3. **Prefix custom variables for clarity**
   ```yaml
   env:
     - APP_DATA_DIR: /var/data
     - APP_LOG_LEVEL: info
   ```

4. **Keep sensitive values in secrets, not env**
   ```yaml
   # Avoid
   env:
     - API_KEY: sk-12345...

   # Prefer
   secrets:
     - name: API_KEY
       provider: env
       key: MY_API_KEY
   ```

5. **Use step-level env for step-specific overrides**
   ```yaml
   steps:
     - name: verbose-step
       env:
         - DEBUG: "true"
       command: ./script.sh
   ```

## See Also

- [Data & Variables](/writing-workflows/data-variables) - Complete data handling guide
- [Variables Reference](/reference/variables) - Full variable syntax reference
- [Special Environment Variables](/reference/special-environment-variables) - Built-in DAG_* variables
- [Secrets](/writing-workflows/secrets) - Secure secret management
