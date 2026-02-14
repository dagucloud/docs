# HTTP

Execute HTTP requests to web services and APIs.

## Basic Usage

```yaml
steps:
  - name: get-data
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
| `json` | Format output as structured JSON | `true` |
| `tls_skip_verify` | Skip TLS certificate verification | `true` |

## Examples

### POST with JSON

```yaml
steps:
  - name: create-resource
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
  - name: price-example
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
  - name: bearer-auth
    type: http
    config:
      headers:
        Authorization: "Bearer ${API_TOKEN}"
    command: GET https://api.example.com/protected
```

### Query Parameters

```yaml
steps:
  - name: search
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
  - name: get-user
    type: http
    config:
      silent: true
    command: GET https://api.example.com/user
    output: USER_DATA

  - name: process
    command: echo "${USER_DATA}" | jq '.email'
```

### JSON Output Mode

Use `json: true` to get structured JSON output including status code and headers:

```yaml
steps:
  - name: api-call
    type: http
    config:
      json: true
      silent: true
    command: GET https://api.example.com/data
    output: RESPONSE
```

Output format:
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
  - name: api-call
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
  - name: internal-api
    type: http
    config:
      tls_skip_verify: true  # Allow self-signed certificates
      headers:
        Authorization: "Bearer ${INTERNAL_TOKEN}"
    command: GET https://internal-api.company.local/data
```
