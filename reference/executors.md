# Step Types Reference

## Overview

Step types extend Dagu's capabilities beyond simple shell commands. Available step types:

- [Shell](/features/executors/shell) (default) - Execute shell commands
- [Docker](/features/executors/docker) - Run commands in Docker containers
- [SSH](/features/executors/ssh) - Execute commands on remote hosts
- [S3](/features/executors/s3) - S3 operations (upload, download, list, delete)
- [HTTP](/features/executors/http) - Make HTTP requests
- [Chat](/features/chat/) - Execute LLM requests (OpenAI, Anthropic, Gemini, etc.)
- [Archive](/features/executors/archive) - Extract, create, and list archive files
- [Mail](/features/executors/mail) - Send emails
- [JQ](/features/executors/jq) - Process JSON data
- [Redis](/features/executors/redis) - Execute Redis commands and operations
- [HITL](/features/executors/hitl) - Human-in-the-loop approval gates
- [Router](/features/executors/router) - Route execution to different steps based on pattern matching
- [GitHub Actions (_experimental_)](/features/executors/github-actions) - Run marketplace actions locally with nektos/act

::: tip
For detailed documentation on each step type, click the links above to visit the feature pages.
:::

## Shell (Default)

::: info
For detailed Shell step type documentation, see [Shell Guide](/features/executors/shell).
:::

The default step type runs commands in the system shell. Set a DAG-level `shell` to pick the program and flags once; steps inherit it unless you override them.

```yaml
shell: ["/bin/bash", "-e"]  # Default shell for the workflow
steps:
  - command: echo "Hello World"
    
  - command: echo $BASH_VERSION   # Uses DAG shell
  - shell: /usr/bin/zsh           # Step-level override
    command: echo "Uses zsh"
```

### Shell Selection

```yaml
steps:
  - name: default-shell
    command: echo "Uses DAG shell or system default"
    
  - name: bash-specific
    shell: ["bash", "-e", "-u"]   # Array form for flags
    command: echo "Uses bash features"
    
  - name: custom-shell
    shell: /usr/bin/zsh
    command: echo "Uses zsh"
```

## Docker

::: info
For detailed Docker step type documentation, see [Docker Guide](/features/executors/docker).
:::

Run commands in Docker containers for isolation and reproducibility. The `container` field supports two modes:
- **Image mode**: Create a new container from a Docker image
- **Exec mode**: Execute commands in an already-running container

### Image Mode (Create New Container)

Use the `container` field to run a step in its own container:

```yaml
steps:
  - name: run-in-container
    container:
      image: alpine:latest
    command: echo "Hello from container"
```

::: tip
The container is automatically removed after execution. Set `keep_container: true` to preserve it.
:::

### Exec Mode (Use Existing Container)

Execute commands in an already-running container:

```yaml
steps:
  # String form - exec with container's defaults
  - name: run-migration
    container: my-app-container
    command: php artisan migrate

  # Object form with overrides
  - name: admin-task
    container:
      exec: my-app-container
      user: root
      working_dir: /app
    command: chown -R app:app /data
```

Exec mode is ideal for running commands in containers started by Docker Compose or other orchestration tools.

### Image Pull Options

```yaml
steps:
  - name: pull-always
    container:
      image: myapp:latest
      pull_policy: always      # Always pull from registry
    command: ./app

  - name: pull-if-missing
    container:
      image: myapp:latest
      pull_policy: missing     # Default - pull only if not local
    command: ./app

  - name: never-pull
    container:
      image: local-image:dev
      pull_policy: never       # Use local image only
    command: ./test
```

### Registry Authentication

```yaml
# Configure authentication for private registries
registry_auths:
  docker.io:
    username: ${DOCKER_USERNAME}
    password: ${DOCKER_PASSWORD}
  ghcr.io:
    username: ${GITHUB_USER}
    password: ${GITHUB_TOKEN}

steps:
  - name: use-private-image
    container:
      image: ghcr.io/myorg/private-app:latest
    command: echo "Running"
```

Authentication can also be configured via `DOCKER_AUTH_CONFIG` environment variable.

### Volume Mounts

```yaml
steps:
  - name: with-volumes
    container:
      image: python:3.13
      volumes:
        - /host/data:/container/data:ro      # Read-only
        - /host/output:/container/output:rw  # Read-write
        - ./config:/app/config               # Relative path
    command: python process.py /container/data
```

## GitHub Actions

::: info
For the full guide, see [GitHub Actions](/features/executors/github-actions).
:::

Run marketplace actions (e.g. `actions/checkout@v4`) inside Dagu steps.

```yaml
secrets:
  - name: GITHUB_TOKEN
    provider: env
    key: GITHUB_TOKEN

steps:
  - name: checkout
    command: actions/checkout@v4
    type: gha               # Aliases: github_action, github-action
    config:
      runner: node:24-bookworm
    params:
      repository: dagu-org/dagu
      ref: main
      token: "${GITHUB_TOKEN}"
```

::: warning
This executor is experimental. It depends on Docker, downloads images on demand, and currently supports single-action invocations per step.
:::

### Environment Variables

```yaml
env:
  - API_KEY: secret123

steps:
  - name: with-env
    container:
      image: node:22
      env:
        - NODE_ENV=production
        - API_KEY=${API_KEY}  # Pass from DAG env
        - DB_HOST=postgres
    command: npm start
```

### Network Configuration

```yaml
steps:
  - name: custom-network
    container:
      image: alpine
      network: my-network
    command: ping other-service
```

### Platform Selection

```yaml
steps:
  - name: specific-platform
    container:
      image: myapp:latest
      platform: linux/amd64  # Force platform
    command: ./app
```

### Working Directory

```yaml
steps:
  - name: custom-workdir
    container:
      image: python:3.13
      working_dir: /app
      env:
        - PYTHONPATH=/app
      volumes:
        - ./src:/app
    command: python main.py
```

### Complete Docker Example

```yaml
steps:
  - name: run-postgres
    container:
      name: test-db
      image: postgres:17
      pull_policy: missing
      platform: linux/amd64
      keep_container: true
      env:
        - POSTGRES_USER=test
        - POSTGRES_PASSWORD=test
        - POSTGRES_DB=testdb
      volumes:
        - postgres-data:/var/lib/postgresql/data
      ports:
        - "127.0.0.1:5432:5432"
      network: bridge
    command: postgres
```

## SSH

::: info
For detailed SSH step type documentation, see [SSH Guide](/features/executors/ssh).
:::

Execute commands on remote hosts over SSH.

### Basic SSH

```yaml
steps:
  - name: remote-command
    type: ssh
    config:
      user: deploy
      host: server.example.com
      port: 22
      key: /home/user/.ssh/id_rsa
    command: ls -la /var/www
```

### With Environment

```yaml
steps:
  - name: remote-with-env
    type: ssh
    config:
      user: deploy
      host: 192.168.1.100
      key: ~/.ssh/deploy_key
    command: |
      export APP_ENV=production
      cd /opt/app
      echo "Deploying"
```

### Multiple Commands

```yaml
steps:
  - name: remote-script
    type: ssh
    config:
      user: admin
      host: backup.server.com
      key: ${SSH_KEY_PATH}
    script: |
      #!/bin/bash
      set -e
      
      echo "Starting backup..."
      tar -czf /backup/app-$(date +%Y%m%d).tar.gz /var/www
      
      echo "Cleaning old backups..."
      find /backup -name "app-*.tar.gz" -mtime +7 -delete
      
      echo "Backup complete"
```

## S3

::: info
For detailed S3 step type documentation, see [S3 Guide](/features/executors/s3).
:::

Execute S3 operations including upload, download, list, and delete. Supports AWS S3 and S3-compatible services (MinIO, GCS, DigitalOcean Spaces).

### DAG-Level Configuration

```yaml
s3:
  region: us-east-1
  access_key_id: ${AWS_ACCESS_KEY_ID}
  secret_access_key: ${AWS_SECRET_ACCESS_KEY}
  bucket: my-bucket

steps:
  - name: upload-file
    type: s3
    config:
      key: data/file.txt
      source: /tmp/file.txt
    command: upload
```

### Upload

```yaml
steps:
  - name: upload-report
    type: s3
    config:
      bucket: my-bucket
      key: reports/daily.csv
      source: /tmp/report.csv
      content_type: text/csv
      storage_class: STANDARD_IA
    command: upload
```

### Download

```yaml
steps:
  - name: download-config
    type: s3
    config:
      bucket: my-bucket
      key: config/settings.json
      destination: /tmp/settings.json
    command: download
```

### List Objects

```yaml
steps:
  - name: list-logs
    type: s3
    config:
      bucket: my-bucket
      prefix: logs/2024/
      max_keys: 100
      recursive: true
    command: list
    output: OBJECTS
```

### Delete

```yaml
steps:
  # Single object
  - name: delete-file
    type: s3
    config:
      bucket: my-bucket
      key: temp/old-file.txt
    command: delete

  # Batch delete by prefix
  - name: cleanup
    type: s3
    config:
      bucket: my-bucket
      prefix: logs/2023/
    command: delete
```

### S3-Compatible Services

```yaml
# MinIO
s3:
  endpoint: http://localhost:9000
  access_key_id: minioadmin
  secret_access_key: minioadmin
  bucket: my-bucket
  force_path_style: true

# Google Cloud Storage
s3:
  endpoint: https://storage.googleapis.com
  access_key_id: ${GCS_HMAC_KEY}
  secret_access_key: ${GCS_HMAC_SECRET}
  bucket: my-gcs-bucket
```

## HTTP

::: info
For detailed HTTP step type documentation, see [HTTP Guide](/features/executors/http).
:::

Make HTTP requests to APIs and web services.

### GET Request

```yaml
steps:
  - name: simple-get
    type: http
    config:
      silent: true  # Output body only
    command: GET https://api.example.com/status
```

### POST with Body

```yaml
steps:
  - name: post-json
    type: http
    config:
      headers:
        Content-Type: application/json
        Authorization: Bearer ${API_TOKEN}
      body: |
        {
          "name": "test",
          "value": 123
        }
      timeout: 30
    command: POST https://api.example.com/data
```

### Query Parameters

```yaml
steps:
  - name: search-api
    type: http
    config:
      query:
        q: "dagu workflow"
        limit: "10"
        offset: "0"
      silent: true
    command: GET https://api.example.com/search
```

### Form Data

```yaml
steps:
  - name: form-submit
    type: http
    config:
      headers:
        Content-Type: application/x-www-form-urlencoded
      body: "username=user&password=pass&remember=true"
    command: POST https://example.com/login
```

### Self-Signed Certificates

```yaml
steps:
  - name: internal-api
    type: http
    config:
      tls_skip_verify: true  # Skip certificate verification
      headers:
        Authorization: Bearer ${INTERNAL_TOKEN}
    command: GET https://internal-api.local/data
```

### Complete HTTP Example

```yaml
steps:
  - name: api-workflow
    type: http
    config:
      headers:
        Accept: application/json
        X-API-Key: ${API_KEY}
      timeout: 60
      silent: false
    command: GET https://api.example.com/data
    output: API_RESPONSE
    
  - name: process-response
    command: echo "${API_RESPONSE}" | jq '.data[]'
```

## Archive

::: info
For detailed Archive step type documentation, see [Archive Guide](/features/executors/archive).
:::

Manipulate archives without shelling out to `tar`, `zip`, or other external tools.

### Extract Archive

```yaml
steps:
  - name: unpack
    type: archive
    config:
      source: logs.tar.gz
      destination: ./logs
      verify_integrity: true
    command: extract
```

### Create Archive

```yaml
steps:
  - name: package
    type: archive
    config:
      source: ./logs
      destination: logs-backup.tar.gz
      include:
        - "**/*.log"
    command: create
```

### List Contents

```yaml
steps:
  - name: inspect
    type: archive
    config:
      source: logs-backup.tar.gz
    command: list
    output: ARCHIVE_INDEX
```

## Mail

::: info
For detailed Mail step type documentation, see [Mail Guide](/features/executors/mail).
:::

Send emails for notifications and alerts.

### Basic Email

```yaml
smtp:
  host: smtp.gmail.com
  port: "587"
  username: sender@gmail.com
  password: ${SMTP_PASSWORD}

steps:
  - name: send-notification
    type: mail
    config:
      to: recipient@example.com
      from: sender@gmail.com
      subject: "Workflow Completed"
      message: "The data processing workflow has completed successfully."
```

### With Attachments

```yaml
steps:
  - name: send-report
    type: mail
    config:
      to: team@company.com
      from: reports@company.com
      subject: "Daily Report - ${TODAY}"
      message: |
        Please find attached the daily report.

        Generated at: ${TIMESTAMP}
      attachments:
        - /tmp/daily-report.pdf
        - /tmp/summary.csv
```

### Multiple Recipients

```yaml
steps:
  - name: alert-team
    type: mail
    config:
      to:
        - ops@company.com
        - alerts@company.com
        - oncall@company.com
      from: dagu@company.com
      subject: "[ALERT] Process Failed"
      message: |
        The critical process has failed.

        Error: ${ERROR_MESSAGE}
        Time: ${TIMESTAMP}
```

### HTML Email

```yaml
steps:
  - name: send-html
    type: mail
    config:
      to: marketing@company.com
      from: notifications@company.com
      subject: "Weekly Stats"
      contentType: text/html
      message: |
          <html>
          <body>
            <h2>Weekly Statistics</h2>
            <p>Users: <strong>${USER_COUNT}</strong></p>
            <p>Revenue: <strong>${REVENUE}</strong></p>
          </body>
          </html>
```

## JQ

::: info
For detailed JQ step type documentation, see [JQ Guide](/features/executors/jq).
:::

Process and transform JSON data using jq syntax.

### Raw Output

Set `config.raw: true` to mirror jq's `-r` flag and emit unquoted primitives.

```yaml
steps:
  - name: list-emails
    type: jq
    config:
      raw: true
    command: '.data.users[].email'
    script: |
      {
        "data": {
          "users": [
            {"email": "user1@example.com"},
            {"email": "user2@example.com"}
          ]
        }
      }
```

Output:
```text
user1@example.com
user2@example.com
```

### Format JSON

```yaml
steps:
  - name: pretty-print
    type: jq
    script: |
      {"name":"test","values":[1,2,3],"nested":{"key":"value"}}
```

Output:
```json
{
  "name": "test",
  "values": [1, 2, 3],
  "nested": {
    "key": "value"
  }
}
```

### Query JSON

```yaml
steps:
  - name: extract-value
    type: jq
    command: '.data.users[] | select(.active == true) | .email'
    script: |
      {
        "data": {
          "users": [
            {"id": 1, "email": "user1@example.com", "active": true},
            {"id": 2, "email": "user2@example.com", "active": false},
            {"id": 3, "email": "user3@example.com", "active": true}
          ]
        }
      }
```

Output:
```
"user1@example.com"
"user3@example.com"
```

### Transform JSON

```yaml
steps:
  - name: transform-data
    type: jq
    command: '{id: .id, name: .name, total: (.items | map(.price) | add)}'
    script: |
      {
        "id": "order-123",
        "name": "Test Order",
        "items": [
          {"name": "Item 1", "price": 10.99},
          {"name": "Item 2", "price": 25.50},
          {"name": "Item 3", "price": 5.00}
        ]
      }
```

Output:
```json
{
  "id": "order-123",
  "name": "Test Order",
  "total": 41.49
}
```

### Complex Processing

```yaml
steps:
  - name: analyze-logs
    type: jq
    command: |
      group_by(.level) |
      map({
        level: .[0].level,
        count: length,
        messages: map(.message)
      })
    script: |
      [
        {"level": "ERROR", "message": "Connection failed"},
        {"level": "INFO", "message": "Process started"},
        {"level": "ERROR", "message": "Timeout occurred"},
        {"level": "INFO", "message": "Process completed"}
      ]
```

## Redis

::: info
For detailed Redis step type documentation, see [Redis Guide](/features/executors/redis).
:::

Execute commands against Redis servers.

### Basic Usage

```yaml
steps:
  - name: ping
    type: redis
    config:
      host: localhost
      port: 6379
      command: PING
```

### DAG-Level Configuration

Define connection defaults at the DAG level:

```yaml
redis:
  host: localhost
  port: 6379
  password: ${REDIS_PASSWORD}

steps:
  - name: set-value
    type: redis
    config:
      command: SET
      key: mykey
      value: "hello"

  - name: get-value
    type: redis
    config:
      command: GET
      key: mykey
    output: RESULT
```

### String Operations

```yaml
steps:
  - name: cache-user
    type: redis
    config:
      command: SET
      key: user:${USER_ID}
      value: '{"name": "John", "email": "john@example.com"}'

  - name: get-user
    type: redis
    config:
      command: GET
      key: user:${USER_ID}
    output: USER_DATA
```

### Hash Operations

```yaml
steps:
  - name: set-user-field
    type: redis
    config:
      command: HSET
      key: user:1
      field: email
      value: "john@example.com"

  - name: get-all-fields
    type: redis
    config:
      command: HGETALL
      key: user:1
    output: USER_HASH
```

### Pipeline Operations

```yaml
steps:
  - name: batch-ops
    type: redis
    config:
      pipeline:
        - command: SET
          key: key1
          value: "value1"
        - command: SET
          key: key2
          value: "value2"
        - command: MGET
          keys: ["key1", "key2"]
```

### Connection Modes

```yaml
# Standalone (default)
redis:
  host: localhost
  port: 6379

# Sentinel
redis:
  mode: sentinel
  sentinel_master: mymaster
  sentinel_addrs:
    - sentinel1:26379
    - sentinel2:26379

# Cluster
redis:
  mode: cluster
  cluster_addrs:
    - node1:6379
    - node2:6379
```

## Chat

::: info
For detailed Chat step type documentation, see [Chat Guide](/features/chat/).
:::

Execute requests to Large Language Model providers.

### Basic Chat Request

```yaml
steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "What is 2+2?"
    output: ANSWER
```

### Supported Providers

| Provider | Environment Variable |
|----------|---------------------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `gemini` | `GOOGLE_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `local` | (none) |

Aliases `ollama`, `vllm`, and `llama` map to `local`.

### Multi-turn Session

```yaml
type: graph

steps:
  - name: setup
    type: chat
    llm:
      provider: openai
      model: gpt-4o
      system: "You are a helpful assistant."
    messages:
      - role: user
        content: "What is 2+2?"

  - name: followup
    depends: [setup]
    type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Now multiply that by 3."
```

Steps inherit session history from dependencies.

### Variable Substitution

```yaml
params:
  - TOPIC: "quantum computing"

steps:
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
    messages:
      - role: user
        content: "Explain ${TOPIC} briefly."
```

### Local Models (Ollama)

```yaml
steps:
  - type: chat
    llm:
      provider: local
      model: llama3
    messages:
      - role: user
        content: "Hello!"
```

### DAG-Level Configuration

Define LLM defaults at the DAG level to share configuration across steps:

```yaml
llm:
  provider: openai
  model: gpt-4o
  system: "You are a helpful assistant."
  temperature: 0.7

steps:
  - type: chat
    messages:
      - role: user
        content: "First question"

  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
    messages:
      - role: user
        content: "Override with different provider"
```

When a step specifies `llm:`, it completely replaces DAG-level config (no field merging).

## HITL (Human in the Loop)

::: info
For detailed HITL documentation, see [HITL Guide](/features/executors/hitl).
:::

Pause workflow execution until human approval or rejection. This enables human-in-the-loop (HITL) workflows where manual review or authorization is required before proceeding.

### Basic Usage

```yaml
steps:
  - command: ./deploy.sh staging
  - type: hitl
  - command: ./deploy.sh production
```

### With Prompt and Inputs

```yaml
steps:
  - command: ./deploy.sh staging
  - type: hitl
    config:
      prompt: "Approve production deployment?"
      input: [APPROVED_BY, RELEASE_NOTES]
      required: [APPROVED_BY]
  - command: |
      echo "Approved by: ${APPROVED_BY}"
      ./deploy.sh production
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `prompt` | string | Message displayed to the approver |
| `input` | string[] | Parameter names to collect from approver |
| `required` | string[] | Parameters that must be provided (subset of `input`) |

### Approval and Rejection

HITL steps can be approved or rejected via the Web UI or REST API:

- **Approval**: The step succeeds and execution continues
- **Rejection**: The step enters `Rejected` status, the DAG status becomes `Rejected`, and dependent steps are aborted

## DAG (Subworkflow)

::: info
The DAG step type allows running other workflows as steps. See [Nested Workflows](/writing-workflows/control-flow#nested-workflows).
:::

Execute other workflows as steps, enabling workflow composition.

### Execute External DAG

```yaml
steps:
  - name: run-etl
    type: dag
    command: workflows/etl-pipeline.yaml
    params: "DATE=${TODAY} ENV=production"
```

### Execute Local DAG

```yaml
name: main-workflow
steps:
  - name: prepare-data
    type: dag
    command: data-prep
    params: "SOURCE=/data/raw"

---

name: data-prep
params:
  - SOURCE: /tmp
steps:
  - name: validate
    command: validate.sh ${SOURCE}
  - name: clean
    command: clean.py ${SOURCE}
```

### Capture DAG Output

```yaml
steps:
  - name: analyze
    type: dag
    command: analyzer.yaml
    params: "FILE=${INPUT_FILE}"
    output: ANALYSIS
    
  - name: use-results
    command: |
      echo "Status: ${ANALYSIS.outputs.status}"
      echo "Count: ${ANALYSIS.outputs.record_count}"
```

### Error Handling

```yaml
steps:
  - name: may-fail
    type: dag
    command: risky-process.yaml
    continue_on:
      failure: true
    retry_policy:
      limit: 3
      interval_sec: 300
```

### Dynamic DAG Selection

```yaml
steps:
  - name: choose-workflow
    command: |
      if [ "${ENVIRONMENT}" = "prod" ]; then
        echo "production-workflow.yaml"
      else
        echo "staging-workflow.yaml"
      fi
    output: WORKFLOW_FILE
    
  - name: run-selected
    type: dag
    command: ${WORKFLOW_FILE}
    params: "ENV=${ENVIRONMENT}"
```

## Router

::: info
For detailed Router step type documentation, see [Router Guide](/features/executors/router).
:::

Route execution to different steps based on pattern matching against a value.

::: warning
Router steps require `type: graph` at the DAG level.
:::

### Basic Usage

```yaml
type: graph
env:
  - INPUT: exact_value
steps:
  - name: router
    type: router
    value: ${INPUT}
    routes:
      "exact_value": [route_a]
      "other": [route_b]

  - name: route_a
    command: echo "Route A executed"

  - name: route_b
    command: echo "Route B executed"
```

### Regex Patterns

Prefix patterns with `re:` for regex matching:

```yaml
type: graph
steps:
  - name: router
    type: router
    value: ${INPUT}
    routes:
      "re:^apple.*": [apple_handler]
      "re:^banana.*": [banana_handler]
      "re:.*": [default_handler]
```

### Multiple Targets

Route to multiple steps from a single pattern:

```yaml
type: graph
steps:
  - name: router
    type: router
    value: ${TRIGGER}
    routes:
      "all": [step_a, step_b, step_c]
```

## See Also

- [Shell](/features/executors/shell) - Shell command execution details
- [Docker](/features/executors/docker) - Container execution guide
- [SSH](/features/executors/ssh) - Remote execution guide
- [S3](/features/executors/s3) - S3 operations guide
- [HTTP](/features/executors/http) - API interaction guide
- [Chat](/features/chat/) - LLM integration guide
- [Mail](/features/executors/mail) - Email notification guide
- [JQ](/features/executors/jq) - JSON processing guide
- [Redis](/features/executors/redis) - Redis operations guide
- [HITL](/features/executors/hitl) - Human-in-the-loop approval guide
- [Writing Workflows](/writing-workflows/) - Using step types in workflows
