# Wait

Wait for time, file state, or HTTP readiness without wrapping polling loops in shell scripts.

## Actions

| Action | Use for | Required fields |
|--------|---------|-----------------|
| `wait.duration` | Wait for a fixed duration | `duration` |
| `wait.until` | Wait until a timestamp | `until` |
| `wait.file` | Poll for a file path to exist or disappear | `path` |
| `wait.http` | Poll an HTTP endpoint until it returns a status | `url` |

All duration fields use Go duration strings such as `500ms`, `30s`, `5m`, or `1h`.

## Wait for a Duration

```yaml
steps:
  - id: give_service_time
    action: wait.duration
    with:
      duration: 30s
```

## Wait Until a Timestamp

`until` must be an RFC3339 timestamp. If the timestamp is already in the past, the step completes immediately.

```yaml
steps:
  - id: maintenance_window
    action: wait.until
    with:
      until: "2030-01-02T03:04:05Z"  # Example future timestamp
```

## Wait for a File

By default, `wait.file` waits for the path to exist. Use `state: missing` to wait until it disappears.

```yaml
steps:
  - id: wait_for_ready_file
    action: wait.file
    with:
      path: ./ready.flag
      poll_interval: 2s
```

```yaml
steps:
  - id: wait_for_lock_release
    action: wait.file
    with:
      path: ./deploy.lock
      state: missing
      poll_interval: 5s
```

Relative paths resolve from the step working directory.

## Wait for HTTP Readiness

`wait.http` retries until the response status matches `status`. The default method is `GET`, and the default status is `200`.

```yaml
steps:
  - id: wait_for_api
    action: wait.http
    with:
      url: https://api.example.com/health
      status: 204
      poll_interval: 3s
      request_timeout: 10s
```

Headers and request bodies are supported:

```yaml
steps:
  - id: wait_for_search
    action: wait.http
    with:
      method: POST
      url: https://api.example.com/search/ready
      status: 200
      headers:
        Authorization: "Bearer ${API_TOKEN}"
        Content-Type: application/json
      body: '{"index":"customers"}'
```

Network errors, connection refusals, and non-matching statuses are treated as “not ready” and retried until the step context is canceled or the DAG step times out.

## Configuration

| Field | Type | Default | Used by | Description |
|-------|------|---------|---------|-------------|
| `duration` | string | none | `wait.duration` | Fixed duration to wait. |
| `until` | string | none | `wait.until` | RFC3339 timestamp. |
| `path` | string | none | `wait.file` | File or directory path. |
| `state` | string | `exists` | `wait.file` | `exists` or `missing`. |
| `url` | string | none | `wait.http` | Absolute HTTP URL. |
| `method` | string | `GET` | `wait.http` | HTTP method. |
| `status` | integer | `200` | `wait.http` | Expected HTTP status code. |
| `headers` | map | none | `wait.http` | HTTP request headers. |
| `body` | string | none | `wait.http` | HTTP request body. |
| `poll_interval` | string | `1s` | `wait.file`, `wait.http` | Interval between readiness checks. |
| `request_timeout` | string | `10s` | `wait.http` | Per-request timeout. |

Use the step-level `timeout_sec` field to set an overall maximum wait time.
