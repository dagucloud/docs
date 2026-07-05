# HTTP

Execute HTTP requests to web services and APIs.

## Basic Usage

```yaml
steps:
  - id: get_data
    action: http.request
    with:
      method: GET
      url: https://jsonplaceholder.typicode.com/todos/1
```

## Configuration

| Field | Description | Example |
|-------|-------------|---------|
| `headers` | Request headers | `Authorization: Bearer token` |
| `query` | URL parameters | `page: "1"` |
| `body` | Request body | `{"name": "value"}` |
| `timeout` | Timeout in seconds | `30` |
| `silent` | Return body only (suppress status/headers on success) | `true` |
| `debug` | Enable debug mode (logs request/response details) | `true` |
| `format` | Stdout format. `"json"` writes a structured JSON object to stdout. | `"json"` |
| `output` | File path to write the response body to instead of stdout. | `"${context.paths.artifacts_dir}/data.bin"` |
| `skip_tls_verify` | Skip TLS certificate verification | `true` |

## Examples

### POST with JSON

```yaml
steps:
  - id: create_resource
    action: http.request
    with:
      method: POST
      url: https://api.example.com/resources
      body: '{"name": "New Resource"}'
      headers:
        Content-Type: application/json
```

If your body needs a literal `$`, use `\$` (non-shell contexts only):

```yaml
steps:
  - id: price_example
    action: http.request
    with:
      method: POST
      url: https://api.example.com/prices
      body: '{"price":"\$9.99"}'  # Becomes {"price":"$9.99"}
      headers:
        Content-Type: application/json
```

### Authentication

```yaml
steps:
  - id: bearer_auth
    action: http.request
    with:
      method: GET
      url: https://api.example.com/protected
      headers:
        Authorization: "Bearer ${env.API_TOKEN}"
```

### Query Parameters

```yaml
steps:
  - id: search
    action: http.request
    with:
      method: GET
      url: https://api.example.com/search
      query:
        q: "search term"
        limit: "10"
```

### Capture Response

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: get_user
    action: http.request
    with:
      method: GET
      url: https://api.example.com/user
      silent: true

  - id: process
    run: echo "${steps.get_user.outputs.body}" | jq '.email'
    depends: get_user
```

### JSON Output Mode

Use `format: "json"` only when later steps should consume the HTTP response through structured stdout:

```yaml
steps:
  - id: api_call
    action: http.request
    with:
      method: GET
      url: https://api.example.com/data
      format: "json"
      silent: true
    output: RESPONSE
```

The response body must be valid JSON. On a successful response with `silent: true`, stdout contains only the parsed body:

```json
{
  "body": {"key": "value"}
}
```

Without `silent` (or on a non-2xx response), stdout also includes status code and headers:

```json
{
  "status_code": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {"key": "value"}
}
```

If the response body is not valid JSON, the step fails.

### File Output Mode

Set `output` to download the raw response body to a file:

```yaml
steps:
  - id: download_script
    action: http.request
    with:
      method: GET
      url: https://example.com/install.sh
      output: "${context.paths.artifacts_dir}/install.sh"

  - id: run_script
    run: sh "${context.paths.artifacts_dir}/install.sh"
    depends: download_script
```

`with.output` is the file target for `http.request`. The top-level `output:` field still captures stdout into a step output variable for later steps.

`with.output` always writes only the response body bytes to the file. Status lines and headers are stdout output only.

Relative `with.output` paths resolve from the step working directory. Parent directories are created automatically. Existing files are replaced atomically only after a successful 2xx response; non-2xx responses fail the step and do not replace the target file.

When `with.output` references `${context.paths.artifacts_dir}`, artifact storage is auto-enabled and the downloaded file appears as a run artifact.

### Exit Codes

| HTTP Status | Exit Code | Description |
|-------------|-----------|-------------|
| 2xx | 0 | Success |
| 4xx, 5xx | 1 | Client/server error |
| Timeout/network error | 1 | Connection failed |

### Error Handling

```yaml
steps:
  - id: api_call
    action: http.request
    with:
      method: GET
      url: https://api.example.com/data
      timeout: 30
    retry_policy:
      limit: 3
      interval_sec: 5
    continue_on:
      exit_code: [1]  # Non-2xx status codes
```

### Webhook Notification

```yaml
handler_on:
  success:
    action: http.request
    with:
      method: POST
      url: https://hooks.example.com/workflow-complete
      body: '{"status": "completed", "dag": "${context.dag.name}"}'
      headers:
        Content-Type: application/json
```

### Self-Signed Certificates

```yaml
steps:
  - id: internal_api
    action: http.request
    with:
      method: GET
      url: https://internal-api.company.local/data
      skip_tls_verify: true  # Allow self-signed certificates
      headers:
        Authorization: "Bearer ${env.INTERNAL_TOKEN}"
```

## Fan-Out: Calling Multiple Endpoints

To send the same request to multiple endpoints in parallel, use `parallel.items` with a sub-DAG. Each endpoint gets its own run with separate logs, status, and retry tracking.

```yaml
# health-check.yaml
steps:
  - name: check-services
    parallel:
      items:
        - https://api.example.com/health
        - https://auth.example.com/health
        - https://billing.example.com/health
      max_concurrent: 3
    action: dag.run
    with:
      dag: http-check
      params:
        URL: ${ITEM}
---
name: http-check

params:
  - URL: ""

steps:
  - name: check
    action: http.request
    with:
      method: GET
      url: ${params.URL}
```

For webhook fan-out, pass the selected webhook URL as the item value and keep shared credentials in the DAG environment:

```yaml
steps:
  - name: notify-webhooks
    parallel:
      items:
        - https://hooks.example.com/deploy
        - https://hooks.example.com/audit
      max_concurrent: 2
    action: dag.run
    with:
      dag: send-webhook
      params:
        URL: ${ITEM}
---
name: send-webhook

env:
  - WEBHOOK_TOKEN: ${WEBHOOK_TOKEN}

params:
  - URL: ""

steps:
  - name: post
    action: http.request
    with:
      method: POST
      url: ${params.URL}
      headers:
        Authorization: "Bearer ${env.WEBHOOK_TOKEN}"
        Content-Type: application/json
      body: '{"status": "deployed"}'
```

See [parallel.items](/writing-workflows/execution-control#parallel-execution) for full fan-out options.
