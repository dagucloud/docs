# Wait

Wait for time, file state, or HTTP readiness without wrapping polling loops in shell scripts.

## Actions

| Action | Use for | Required fields |
|--------|---------|-----------------|
| `wait.duration` | Wait for a fixed duration | `duration` |
| `wait.until` | Wait until a timestamp or time of day | `until` |
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

## Wait Until a Time

`until` is an RFC3339 timestamp or an `HH:MM[:SS]` time of day.

```yaml
steps:
  - id: maintenance_window
    action: wait.until
    with:
      until: "2030-01-02T03:04:05Z"  # Example future timestamp
```

A time of day resolves on the run's logical day: the date of `context.run.scheduled_at` for scheduled runs, which retries keep, otherwise the date the current attempt started. It is read in `timezone` when set, otherwise in the configured [`tz`](/server-admin/reference). It never rolls over to the next day.

`offset` shifts the deadline by a signed duration, so release gates can be written relative to one release time:

```yaml
steps:
  - id: gate_3h
    action: wait.until
    with:
      until: "16:30"
      offset: -3h
      timezone: Europe/London
      if_past: fail

  - id: gate_1h
    depends: gate_3h
    action: wait.until
    with:
      until: "16:30"
      offset: -1h
      timezone: Europe/London
```

### Past Deadlines

`if_past` decides what happens when the deadline, after `offset`, has already passed when the step starts:

| `if_past` | Deadline already passed |
|-----------|-------------------------|
| `continue` (default) | The step succeeds immediately. |
| `fail` | The step fails. |
| `window` | The step succeeds if the deadline passed no more than `window` ago, and fails otherwise. |

```yaml
steps:
  - id: start_window
    action: wait.until
    with:
      until: "11:30"
      if_past: window
      window: 1h
```

This step waits until 11:30, starts immediately between 11:30 and 12:30, and fails after 12:30.

### Daylight Saving Time

A time of day that a daylight-saving change skips is read with the UTC offset before the change, so `02:30` on the night New York springs forward resolves to 03:30 EDT. A time that occurs twice resolves to its first occurrence.

The step writes its resolved deadline to stderr, such as `wait: deadline 2030-01-02T16:30:00Z (zone GMT, if_past fail)`.

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
        Authorization: "Bearer ${env.API_TOKEN}"
        Content-Type: application/json
      body: '{"index":"customers"}'
```

Network errors, connection refusals, failed certificate checks, and non-matching statuses are treated as "not ready" and retried until the step context is canceled or the DAG step times out.

A server with a self-signed or private-CA certificate fails the certificate check on every poll. On a Dagu release after v2.27.0, `skip_tls_verify: true` accepts any server certificate. It also accepts one presented by an attacker on the network path, so use it only for a server you reach over a network you trust.

```yaml
steps:
  - id: wait_for_file_server
    action: wait.http
    with:
      url: https://files.internal.example/health
      skip_tls_verify: true
```

## Configuration

| Field | Type | Default | Used by | Description |
|-------|------|---------|---------|-------------|
| `duration` | string | none | `wait.duration` | Fixed duration to wait. |
| `until` | string | none | `wait.until` | RFC3339 timestamp or `HH:MM[:SS]` time of day. |
| `offset` | string | none | `wait.until` | Signed duration added to the deadline, such as `-3h`. |
| `timezone` | string | config `tz` | `wait.until` | IANA timezone for a time of day. Ignored for RFC3339 timestamps. |
| `if_past` | string | `continue` | `wait.until` | `continue`, `fail`, or `window`. |
| `window` | string | none | `wait.until` | How long after the deadline still counts as on time. Required with `if_past: window`. |
| `path` | string | none | `wait.file` | File or directory path. |
| `state` | string | `exists` | `wait.file` | `exists` or `missing`. |
| `url` | string | none | `wait.http` | Absolute HTTP URL. |
| `method` | string | `GET` | `wait.http` | HTTP method. |
| `status` | integer or string | `200` | `wait.http` | Expected HTTP status code. |
| `headers` | map | none | `wait.http` | HTTP request headers. |
| `body` | string | none | `wait.http` | HTTP request body. |
| `poll_interval` | string | `1s` | `wait.file`, `wait.http` | Interval between readiness checks. |
| `request_timeout` | string | `10s` | `wait.http` | Per-request timeout. |
| `skip_tls_verify` | boolean | `false` | `wait.http` | Accept any server certificate, such as a self-signed one. Dagu release after v2.27.0. |

`offset`, `timezone`, `if_past`, and `window` are only valid on `wait.until`. Use the step-level `timeout_sec` field to set an overall maximum wait time.

## Value References

Every field accepts [value references](/writing-workflows/template-variables), such as `${params.deadline}`, `${env.BASE_URL}/health`, or a previous step's output. References resolve when the step starts.

A literal value is validated when the DAG is built. A value that contains a `${...}` or `$VAR` reference is validated after it resolves, when the step starts, so a bad resolved value fails the step instead of the DAG build. If the reference did not resolve, the error says so. Escape a literal `$` as `\$`.

```yaml
params:
  - deadline: "2030-01-02T03:04:05Z"

steps:
  - id: wait_for_deadline
    action: wait.until
    with:
      until: ${params.deadline}
```
