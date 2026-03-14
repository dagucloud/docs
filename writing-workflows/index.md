# Writing Workflows

## Workflow Structure

```yaml
description: "Process daily data"
schedule: "0 2 * * *"      # Optional: cron schedule
queue: "daily-jobs"        # Optional: assign to global queue for concurrency control

params:                    # Runtime parameters
  - name: ENVIRONMENT
    type: string
    default: staging
    enum: [dev, staging, prod]
  - name: BATCH_SIZE
    type: integer
    default: 25
    minimum: 1
    maximum: 100

env:                       # Environment variables
  - DATE: "`date +%Y-%m-%d`"
  - DATA_DIR: /tmp/data

steps:                     # Workflow steps
  - command: echo "Processing ${ENVIRONMENT} for date ${DATE} with batch ${BATCH_SIZE}"
```

## Base Configuration

Share common settings across all DAGs using base configuration:

```yaml
# ~/.config/dagu/base.yaml
env:
  - LOG_LEVEL: info
  - AWS_REGION: us-east-1

smtp:
  host: smtp.company.com
  port: "587"
  username: ${SMTP_USER}
  password: ${SMTP_PASS}

error_mail:
  from: alerts@company.com
  to: oncall@company.com
  attach_logs: true

hist_retention_days: 30 # Dagu deletes workflow history and logs older than this
queue: "default"      # Default queue for all DAGs (define in config.yaml)
```

DAGs automatically inherit these settings:

```yaml
# my-workflow.yaml

# Inherits all base settings
# Can override specific values:
env:
  - LOG_LEVEL: debug  # Override
  - CUSTOM_VAR: value # Addition

steps:
  - command: echo "Processing"
```

Configuration precedence: System defaults → Base config → DAG config

See [Base Configuration](/server-admin/base-config) for complete documentation on all available fields.

## Guide Sections

1. **[Basics](/writing-workflows/basics)** - Steps, commands, dependencies
2. **[Container](/writing-workflows/container)** - Run workflows in Docker containers
3. **[Control Flow](/writing-workflows/control-flow)** - Parallel execution, conditions, loops
4. **[Data & Variables](/writing-workflows/data-variables)** - Parameters, outputs, data passing
5. **[Error Handling](/writing-workflows/error-handling)** - Retries, failures, notifications
6. **[Lifecycle Handlers](/writing-workflows/lifecycle-handlers)** - Cleanup, notifications, post-run tasks
7. **[Patterns](/writing-workflows/control-flow#patterns)** - Composition, optimization, best practices
8. **[Secrets](/writing-workflows/secrets)** - External providers, resolution order, masking behavior

## Complete Example

```yaml
schedule: "0 2 * * *"

params:
  - name: ENVIRONMENT
    type: string
    default: staging
    enum: [dev, staging, prod]
  - name: DRY_RUN
    type: boolean
    default: false

env:
  - DATE: "`date +%Y-%m-%d`"
  - DATA_DIR: /tmp/data/${DATE}

steps:
  - command: aws s3 cp s3://bucket/${DATE}.csv ${DATA_DIR}/
    retry_policy:
      limit: 3
      interval_sec: 60

  - command: python validate.py ${DATA_DIR}/${DATE}.csv --env=${ENVIRONMENT} --dry-run=${DRY_RUN}
    continue_on:
      failure: false

  - parallel: [users, orders, products]
    command: python process.py --type=$ITEM --date=${DATE}
    output: RESULT_${ITEM}

  - command: python report.py --date=${DATE}

handler_on:
  failure:
    command: echo "Notifying failure for ${DATE}"
```

## Common Patterns

### Sequential Pipeline
```yaml
steps:
  - command: echo "Extracting data"
  - command: echo "Transforming data"
  - command: echo "Loading data"
```

### Parallel Processing
```yaml
steps:
  - parallel: [file1, file2, file3]
    call: process-file
    params: "FILE=${ITEM}"

---
# A child workflow for processing each file
# This can be in a same file separated by `---` or in a separate file
name: process-file
steps:
  - command: echo "Processing" --file ${FILE}
```
