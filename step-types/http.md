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
| `method` | HTTP method. Required. | `GET` |
| `url` | Request URL. Required. | `https://api.example.com/data` |
| `headers` | Request headers | `Authorization: Bearer token` |
| `query` | URL parameters | `page: "1"` |
| `body` | Request body | `{"name": "value"}` |
| `form` | Multipart text fields, keyed by field name | `description: report` |
| `files` | Multipart file paths, keyed by field name | `document: ./report.pdf` |
| `timeout` | Timeout in seconds | `30` |
| `silent` | Return body only (suppress status/headers on success) | `true` |
| `debug` | Enable debug mode (logs request/response details) | `true` |
| `format` | Stdout format. `"json"` writes a structured JSON object to stdout. | `"json"` |
| `output` | File path to write the response body to instead of stdout. | `"${context.paths.artifacts_dir}/data.bin"` |
| `skip_tls_verify` | Skip TLS certificate verification | `true` |
| `status_exit_codes` | Map a non-2xx status code or class to the step exit code (0-255). See [Exit Codes](#exit-codes). | `"5xx": 75` |

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

### Multipart File Upload

Use `files` to attach local files and `form` for accompanying text fields:

```yaml
steps:
  - id: upload_report
    action: http.request
    with:
      method: POST
      url: https://api.example.com/uploads
      form:
        description: nightly-report
      files:
        document: ./report.pdf
```

The map keys are the multipart field names expected by the server. Relative file paths resolve from the step working directory. Multiple files can be sent under different field names.

Dagu generates the multipart `Content-Type` header and boundary. Do not set that header manually. A multipart request cannot also use `body`; put accompanying text values in `form` instead.

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
steps:
  - id: get_user
    action: http.request
    with:
      method: GET
      url: https://api.example.com/user
      silent: true
    output: USER

  - id: process
    run: echo "${get_user.output.email}"
    depends: get_user
```

`${get_user.output.email}` reads a field from the captured JSON body. Use [`js.run`](/step-types/js) to filter or reshape the response.

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

Without `silent` (or on a non-2xx response), stdout also includes status code and headers. Each header value is an array of strings:

```json
{
  "status_code": 200,
  "headers": {
    "Content-Type": ["application/json"]
  },
  "body": {"key": "value"}
}
```

A successful response must carry valid JSON, or the step fails. A failed response whose body is not JSON, such as an HTML error page, reports the body as a string and the step fails with its status.

### Poll an Asynchronous Job

Many APIs accept a job, return a status URL, and finish the work later. Submit the job in one step, then let a second step poll the status URL with `repeat_policy` until the job reaches a final state. The status step repeats until its own JSON output matches `expected`:

```yaml
steps:
  - id: submit
    action: http.request
    with:
      method: POST
      url: https://api.example.com/jobs
      body: '{"report": "daily"}'
      headers:
        Content-Type: application/json
      format: json
      silent: true
    output: SUBMIT

  - id: wait_job
    depends: submit
    action: http.request
    with:
      method: GET
      url: ${SUBMIT.body.status_url}
      format: json
      silent: true
    output: JOB
    retry_policy:
      limit: 3          # Tolerate short outages of the status endpoint
      interval_sec: 5
    repeat_policy:
      repeat: until
      condition: "${JOB.body.state}"
      expected: "re:^(done|failed)$"
      interval_sec: 5
      backoff: 1.5
      max_interval_sec: 60
      limit: 120        # Maximum number of polls

  - id: check_result
    depends: wait_job
    run: test "${JOB.body.state}" = "done"
```

- `${SUBMIT.body.status_url}` reads a field of the JSON response of the first step.
- `expected` accepts the same `re:` and `num:` prefixes as a precondition. The example stops on either final state, so a failed job does not keep the step polling.
- A non-2xx status response fails the status step. `retry_policy` retries it, and polling then continues.
- When `limit` is reached first, the status step stops polling with the last state it read. `check_result` then fails, as it does for a `failed` job.

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

Relative `with.output` paths resolve from the step working directory. Parent directories are created automatically. Existing files are replaced atomically only after a successful response: a 2xx status, or one that `status_exit_codes` maps to `0`. Any other response fails the step, writes the error body to stdout, and leaves the target file unchanged.

When `with.output` references `${context.paths.artifacts_dir}`, artifact storage is auto-enabled and the downloaded file appears as a run artifact.

### Exit Codes

| HTTP Status | Exit Code | Description |
|-------------|-----------|-------------|
| 2xx | 0 | Success |
| 3xx, 4xx, 5xx | 1 | Not a success, unless `status_exit_codes` maps it |
| Timeout/network error | 1 | Connection failed |

`status_exit_codes` maps a status code (`"404"`) or a class (`"5xx"`) to the step exit code, so `retry_policy` and `continue_on` can treat statuses differently. An exact code wins over a class. A status mapped to `0` is a success: the step succeeds and the response is written like a 2xx response. Keys must be `300`-`599` or `3xx`-`5xx`, and values `0`-`255`. A non-2xx status not in the map exits `1`.

### Error Handling

Retry server errors, accept a missing resource, and fail fast on anything else:

```yaml
steps:
  - id: api_call
    action: http.request
    with:
      method: GET
      url: https://api.example.com/data
      timeout: 30
      status_exit_codes:
        "404": 0    # A missing resource is fine
        "429": 75   # Rate limited
        "5xx": 75   # Server error
    retry_policy:
      limit: 3
      interval_sec: 5
      exit_code: [75]
```

Without `status_exit_codes`, every non-2xx status exits `1`, so `retry_policy` retries client errors such as `400` as well.

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
