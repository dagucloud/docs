# Webhooks

Webhooks let an external caller trigger one specific DAG through `POST /api/v1/webhooks/{fileName}`. Each DAG can have at most one webhook configuration.

::: tip GitHub App Integration
If you want GitHub events to trigger Dagu through the Dagu Cloud GitHub App integration, this page is not the right feature. See [GitHub Integration](/github-integration/) for the Cloud-managed GitHub App flow, bindings, GitHub check runs, and PR/issue comment commands.
:::

Webhook management uses the normal authenticated API. Trigger requests use the webhook token instead of API keys or session JWTs.

## Requirements

Webhook management requires builtin auth:

```yaml
auth:
  mode: builtin
```

Behavior when builtin auth is not available:

- Management endpoints return `401 Unauthorized`
- The trigger endpoint returns `404 Not Found`

Webhook management endpoints require developer, manager, or admin role.

## Create a Webhook

Create the webhook with a user that has developer, manager, or admin role:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}' | jq -r '.token')

curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "dagName": "my-dag",
    "tokenPrefix": "dagu_wh_7Kq9",
    "enabled": true,
    "createdAt": "2026-04-29T10:00:00Z",
    "updatedAt": "2026-04-29T10:00:00Z",
    "createdBy": "user-id"
  },
  "token": "dagu_wh_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
}
```

The full `token` value is only returned when the webhook is created or when the token is regenerated.

## Trigger Requests

Trigger requests use the webhook token:

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer $WEBHOOK_TOKEN"
```

Trigger with payload:

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer $WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"branch":"main","commit":"abc123"}}'
```

Response:

```json
{
  "dagRunId": "0196808c-04ff-73bb-a63e-83791b321ac0",
  "dagName": "my-dag"
}
```

### Payload Handling

Dagu injects `WEBHOOK_PAYLOAD` for webhook-triggered runs.

`WEBHOOK_PAYLOAD` is always a JSON string:

- If the request body contains a top-level `payload` field, Dagu serializes that field into `WEBHOOK_PAYLOAD`
- Otherwise, if the raw request body is valid JSON, Dagu serializes the entire raw body into `WEBHOOK_PAYLOAD`
- If no JSON body is available, `WEBHOOK_PAYLOAD` is `{}`

Webhook request bodies are limited to `1048576` bytes by default. Self-hosted operators can change this in `config.yaml`:

```yaml
webhooks:
  max_payload_size: 2097152
```

Or with `DAGU_WEBHOOKS_MAX_PAYLOAD_SIZE`. Very large payloads may still exceed operating-system limits because Dagu exposes the payload to steps as environment data.

If you want to set `dagRunId` without mixing it into `WEBHOOK_PAYLOAD`, use the wrapper form:

```json
{
  "dagRunId": "deploy-abc123",
  "payload": {
    "branch": "main",
    "commit": "abc123"
  }
}
```

Example DAG step that reads the payload:

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: inspect_webhook
    run: |
      echo "$WEBHOOK_PAYLOAD" | jq .
      echo "$WEBHOOK_PAYLOAD" | jq -r '.branch'
```

## Other Management Operations

List all webhooks:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/webhooks
```

Get the webhook for one DAG:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/dags/my-dag/webhook
```

Rotate the webhook token:

```bash
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook/regenerate \
  -H "Authorization: Bearer $TOKEN"
```

Enable or disable the webhook:

```bash
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

Delete the webhook:

```bash
curl -X DELETE http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $TOKEN"
```

## Common Trigger Responses

- `200 OK`: DAG run was enqueued
- `401 Unauthorized`: missing or invalid authorization header, or invalid webhook token
- `403 Forbidden`: webhook is disabled
- `404 Not Found`: no webhook is configured for the DAG, the DAG was not found, or webhook triggering is not configured on the server
- `409 Conflict`: the supplied `dagRunId` already exists
- `413 Payload Too Large`: request body exceeded `webhooks.max_payload_size`
