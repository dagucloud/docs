# HTTP

Execute HTTP requests to web services and APIs.

## Basic Usage

```yaml
steps:
  - id: get_data
    type: http
    command: GET https://jsonplaceholder.typicode.com/todos/1
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
    type: http
    config:
      body: '{"name": "New Resource"}'
      headers:
        Content-Type: application/json
    command: POST https://api.example.com/resources
```

If your body needs a literal `$`, use `\$` (non-shell contexts only):

```yaml
steps:
  - id: price_example
    type: http
    config:
      body: '{"price":"\$9.99"}'  # Becomes {"price":"$9.99"}
      headers:
        Content-Type: application/json
    command: POST https://api.example.com/prices
```

### Authentication

```yaml
steps:
  - id: bearer_auth
    type: http
    config:
      headers:
        Authorization: "Bearer ${API_TOKEN}"
    command: GET https://api.example.com/protected
```

### Query Parameters

```yaml
steps:
  - id: search
    type: http
    config:
      query:
        q: "search term"
        limit: "10"
    command: GET https://api.example.com/search
```

### Capture Response

```yaml
steps:
  - id: get_user
    type: http
    config:
      silent: true
    command: GET https://api.example.com/user
    output: USER_DATA

  - id: process
    command: echo "${USER_DATA}" | jq '.email'
```

### JSON Output Mode

Use `format: "json"` to get structured JSON output including status code and headers:

```yaml
steps:
  - id: api_call
    type: http
    config:
      format: "json"
      silent: true
    command: GET https://api.example.com/data
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
    type: http
    config:
      timeout: 30
    command: GET https://api.example.com/data
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
    type: http
    config:
      body: '{"status": "completed", "dag": "${DAG_NAME}"}'
      headers:
        Content-Type: application/json
    command: POST https://hooks.example.com/workflow-complete
```

### Self-Signed Certificates

```yaml
steps:
  - id: internal_api
    type: http
    config:
      skip_tls_verify: true  # Allow self-signed certificates
      headers:
        Authorization: "Bearer ${INTERNAL_TOKEN}"
    command: GET https://internal-api.company.local/data
```
