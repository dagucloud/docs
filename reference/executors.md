# Executors Reference

## Overview

Executors extend Dagu's capabilities beyond simple shell commands. Available executors:

- [Shell](/features/executors/shell) (default) - Execute shell commands
- [Docker](/features/executors/docker) - Run commands in Docker containers
- [SSH](/features/executors/ssh) - Execute commands on remote hosts
- [HTTP](/features/executors/http) - Make HTTP requests
- [Archive](/features/executors/archive) - Extract, create, and list archive files
- [Mail](/features/executors/mail) - Send emails
- [JQ](/features/executors/jq) - Process JSON data
- [GitHub Actions (_experimental_)](/features/executors/github-actions) - Run marketplace actions locally with nektos/act

::: tip
For detailed documentation on each executor, click the links above to visit the feature pages.
:::

## Shell Executor (Default)

::: info
For detailed Shell executor documentation, see [Shell Executor Guide](/features/executors/shell).
:::

The default executor runs commands in the system shell. Set a DAG-level `shell` to pick the program and flags once; steps inherit it unless you override them.

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

## Docker Executor

::: info
For detailed Docker executor documentation, see [Docker Executor Guide](/features/executors/docker).
:::

Run commands in Docker containers for isolation and reproducibility.

### Step-Level Container (Recommended)

Use the `container` field to run a step in its own container:

```yaml
steps:
  - name: run-in-container
    container:
      image: alpine:latest
    command: echo "Hello from container"
```

::: tip
The container is automatically removed after execution. Set `keepContainer: true` to preserve it.
:::

### Image Pull Options

```yaml
steps:
  - name: pull-always
    container:
      image: myapp:latest
      pullPolicy: always      # Always pull from registry
    command: ./app

  - name: pull-if-missing
    container:
      image: myapp:latest
      pullPolicy: missing     # Default - pull only if not local
    command: ./app

  - name: never-pull
    container:
      image: local-image:dev
      pullPolicy: never       # Use local image only
    command: ./test
```

### Registry Authentication

```yaml
# Configure authentication for private registries
registryAuths:
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

## GitHub Actions Executor

::: info
For the full guide, see [GitHub Actions Executor](/features/executors/github-actions).
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
    executor:
      type: gha             # Aliases: github_action, github-action
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
      workingDir: /app
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
      pullPolicy: missing
      platform: linux/amd64
      keepContainer: true
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

## SSH Executor

::: info
For detailed SSH executor documentation, see [SSH Executor Guide](/features/executors/ssh).
:::

Execute commands on remote hosts over SSH.

### Basic SSH

```yaml
steps:
  - name: remote-command
    executor:
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
    executor:
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
    executor:
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

## HTTP Executor

::: info
For detailed HTTP executor documentation, see [HTTP Executor Guide](/features/executors/http).
:::

Make HTTP requests to APIs and web services.

### GET Request

```yaml
steps:
  - name: simple-get
    executor:
      type: http
      config:
        silent: true  # Output body only
    command: GET https://api.example.com/status
```

### POST with Body

```yaml
steps:
  - name: post-json
    executor:
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
    executor:
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
    executor:
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
    executor:
      type: http
      config:
        skipTLSVerify: true  # Skip certificate verification
        headers:
          Authorization: Bearer ${INTERNAL_TOKEN}
    command: GET https://internal-api.local/data
```

### Complete HTTP Example

```yaml
steps:
  - name: api-workflow
    executor:
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

## Archive Executor

::: info
For detailed Archive executor documentation, see [Archive Executor Guide](/features/executors/archive).
:::

Manipulate archives without shelling out to `tar`, `zip`, or other external tools.

### Extract Archive

```yaml
steps:
  - name: unpack
    executor:
      type: archive
      config:
        source: logs.tar.gz
        destination: ./logs
        verifyIntegrity: true
    command: extract
```

### Create Archive

```yaml
steps:
  - name: package
    executor:
      type: archive
      config:
        source: ./logs
        destination: logs-backup.tar.gz
        include:
          - command: "**/*.log"
    command: create
```

### List Contents

```yaml
steps:
  - name: inspect
    executor:
      type: archive
      config:
        source: logs-backup.tar.gz
    command: list
    output: ARCHIVE_INDEX
```

## Mail Executor

::: info
For detailed Mail executor documentation, see [Mail Executor Guide](/features/executors/mail).
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
    executor:
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
    executor:
      type: mail
      config:
        to: team@company.com
        from: reports@company.com
        subject: "Daily Report - ${TODAY}"
        message: |
          Please find attached the daily report.
          
          Generated at: ${TIMESTAMP}
        attachments:
          - command: /tmp/daily-report.pdf
          - command: /tmp/summary.csv
```

### Multiple Recipients

```yaml
steps:
  - name: alert-team
    executor:
      type: mail
      config:
        to: 
          - command: ops@company.com
          - command: alerts@company.com
          - command: oncall@company.com
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
    executor:
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

## JQ Executor

::: info
For detailed JQ executor documentation, see [JQ Executor Guide](/features/executors/jq).
:::

Process and transform JSON data using jq syntax.

### Raw Output

Set `config.raw: true` to mirror jq's `-r` flag and emit unquoted primitives.

```yaml
steps:
  - name: list-emails
    executor:
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
    executor: jq
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
    executor: jq
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
    executor: jq
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
    executor: jq
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

## DAG Executor

::: info
DAG executor allows running other workflows as steps. See [Nested Workflows](/writing-workflows/control-flow#nested-workflows).
:::

Execute other workflows as steps, enabling workflow composition.

### Execute External DAG

```yaml
steps:
  - name: run-etl
    executor: dag
    command: workflows/etl-pipeline.yaml
    params: "DATE=${TODAY} ENV=production"
```

### Execute Local DAG

```yaml
name: main-workflow
steps:
  - name: prepare-data
    executor: dag
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
    executor: dag
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
    executor: dag
    command: risky-process.yaml
    continueOn:
      failure: true
    retryPolicy:
      limit: 3
      intervalSec: 300
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
    executor: dag
    command: ${WORKFLOW_FILE}
    params: "ENV=${ENVIRONMENT}"
```

## See Also

- [Shell Executor](/features/executors/shell) - Shell command execution details
- [Docker Executor](/features/executors/docker) - Container execution guide
- [SSH Executor](/features/executors/ssh) - Remote execution guide
- [HTTP Executor](/features/executors/http) - API interaction guide
- [Mail Executor](/features/executors/mail) - Email notification guide
- [JQ Executor](/features/executors/jq) - JSON processing guide
- [Writing Workflows](/writing-workflows/) - Using executors in workflows
