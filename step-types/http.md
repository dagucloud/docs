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
| `format` | Response output format. `"json"` for structured output (status code, headers, body). | `"json"` |
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
        Authorization: "Bearer ${API_TOKEN}"
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
steps:
  - id: get_user
    action: http.request
    with:
      method: GET
      url: https://api.example.com/user
      silent: true
    output: USER_DATA

  - id: process
    run: echo "${USER_DATA}" | jq '.email'
```

### JSON Output Mode

Use `format: "json"` to get structured JSON output including status code and headers:

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

The legacy `json: true` boolean is still supported and behaves identically to `format: "json"`.

Output format:

```json
{
  "body": {"key": "value"}
}
```

Without `silent` (or `silent: false`), the output also includes status code and headers:

```json
{
  "status_code": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {"key": "value"}
}
```

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
      body: '{"status": "completed", "dag": "${DAG_NAME}"}'
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
        Authorization: "Bearer ${INTERNAL_TOKEN}"
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
      url: ${URL}
```

For object items (e.g., different method or headers per endpoint), use `${ITEM.field}` references:

```yaml
steps:
  - name: notify-webhooks
    parallel:
      items:
        - url: https://hooks.example.com/deploy
          token: ${DEPLOY_TOKEN}
        - url: https://hooks.example.com/audit
          token: ${AUDIT_TOKEN}
      max_concurrent: 2
    action: dag.run
    with:
      dag: send-webhook
      params:
        URL: ${ITEM.url}
        TOKEN: ${ITEM.token}
---
name: send-webhook

params:
  - URL: ""
  - TOKEN: ""

steps:
  - name: post
    action: http.request
    with:
      method: POST
      url: ${URL}
      headers:
        Authorization: "Bearer ${TOKEN}"
        Content-Type: application/json
      body: '{"status": "deployed"}'
```

See [parallel.items](/writing-workflows/parallel) for full fan-out options.
