# Webhooks

Webhooks provide a way for external systems to trigger DAG executions via HTTP. Unlike API keys which provide general API access, webhooks are DAG-specific and designed for integration with external services like CI/CD pipelines, GitHub, Slack, and other automation platforms.

## Features

- **DAG-Specific Tokens**: Each webhook is tied to a single DAG, providing fine-grained access control
- **Token Management**: Create, regenerate, and delete webhook tokens through the web UI or API
- **Enable/Disable**: Temporarily disable webhooks without regenerating tokens
- **Usage Tracking**: Track when each webhook was last used
- **Secure Storage**: Tokens are hashed with bcrypt before storage; the full token is only shown once at creation

## Requirements

Webhooks require [Builtin Authentication](builtin) to be enabled (`auth.mode: builtin`).

::: warning
When authentication is disabled (`auth.mode: none`), all webhook endpoints return errors:
- Management endpoints return `401 Unauthorized`
- Trigger endpoint returns `404 Not Found`
:::

## Creating Webhooks

### Via Web UI

1. Log in as an admin user
2. Navigate to the DAG you want to create a webhook for
3. Click on **Webhook** in the DAG settings
4. Click **Create Webhook**
5. **Important**: Copy the displayed token immediately - it will not be shown again

### Via API

```bash
# First, authenticate to get a JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}' | jq -r '.token')

# Create a webhook for a DAG
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "dagName": "my-dag",
    "tokenPrefix": "dagu_wh_abc",
    "enabled": true,
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T12:00:00Z",
    "createdBy": "admin-user-id"
  },
  "token": "dagu_wh_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
}
```

::: warning
The `token` field contains the full webhook token and is **only returned once** at creation time. Store it securely immediately.
:::

## Triggering DAGs via Webhook

### Basic Request

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer dagu_wh_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
```

**Response**:
```json
{
  "dagRunId": "my-dag_20240211T120000",
  "dagName": "my-dag"
}
```

### With Payload

You can pass data to your DAG via the request body. The payload is made available as the `WEBHOOK_PAYLOAD` environment variable:

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer dagu_wh_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B" \
  -H "Content-Type: application/json" \
  -d '{"branch": "main", "commit": "abc123"}'
```

In your DAG, access the payload fields directly using Dagu's JSON field access syntax:

```yaml
steps:
  - name: process-webhook
    command: echo "Building branch ${WEBHOOK_PAYLOAD.branch} at commit ${WEBHOOK_PAYLOAD.commit}"
```

You can also access nested fields:

```yaml
steps:
  - name: process-webhook
    command: |
      echo "Repository: ${WEBHOOK_PAYLOAD.repository.name}"
      echo "Author: ${WEBHOOK_PAYLOAD.commits.0.author.name}"
```

::: tip
Dagu automatically parses the JSON payload and allows direct field access using dot notation. For arrays, use numeric indices (e.g., `.commits.0` for the first element).
:::

### Idempotent Requests

To prevent duplicate executions, you can specify a custom `dagRunId`:

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer $WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dagRunId": "deploy-abc123"}'
```

If a DAG run with the same ID already exists, the request will return a `409 Conflict` error.

## Managing Webhooks

### List All Webhooks

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/webhooks
```

**Response**:
```json
{
  "webhooks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "dagName": "my-dag",
      "tokenPrefix": "dagu_wh_7Kq",
      "enabled": true,
      "createdAt": "2024-02-11T12:00:00Z",
      "updatedAt": "2024-02-11T12:00:00Z",
      "createdBy": "admin-user-id",
      "lastUsedAt": "2024-02-11T15:30:00Z"
    }
  ]
}
```

### Get Webhook for a DAG

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/dags/my-dag/webhook
```

### Regenerate Token

If a token is compromised or needs rotation:

```bash
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook/regenerate \
  -H "Authorization: Bearer $TOKEN"
```

This returns a new token. The old token is immediately invalidated.

### Enable/Disable Webhook

Temporarily disable a webhook without deleting it:

```bash
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Delete Webhook

```bash
curl -X DELETE http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $TOKEN"
```

## Token Format

Webhook tokens have the following format:

```
dagu_wh_<base58-encoded-random-bytes>
```

- **Prefix**: All webhook tokens start with `dagu_wh_` for easy identification
- **Random Part**: 32 bytes of cryptographically secure random data, Base58 encoded
- **Total Length**: Approximately 50 characters

The token prefix (first 12 characters including `dagu_wh_`) is stored and displayed in the UI for identification purposes.

## Security Best Practices

1. **Rotate Tokens Regularly**: Use the regenerate endpoint to rotate tokens periodically
2. **Use HTTPS**: Always use HTTPS in production to protect tokens in transit
3. **Validate Payloads**: Validate webhook payloads in your DAG before processing
4. **Monitor Usage**: Check `lastUsedAt` to identify unusual activity
5. **Disable When Not Needed**: Disable webhooks during maintenance or when not in use
6. **Store Securely**: Use secret management solutions (e.g., HashiCorp Vault, GitHub Secrets)

## Webhooks vs API Keys

| Feature | Webhooks | API Keys |
|---------|----------|----------|
| Scope | Single DAG | All API endpoints |
| Purpose | Trigger DAG execution | General API access |
| Role Support | No (execute only) | Yes (admin, manager, operator, viewer) |
| Multiple per DAG | No (one per DAG) | Yes (unlimited) |
| Payload Support | Yes (WEBHOOK_PAYLOAD) | Via request body |
| Best For | External integrations | Automation scripts, CI/CD |

## Use Cases

### CI/CD Integration

#### GitHub Actions

```yaml
name: Deploy Workflow
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trigger Dagu DAG
        run: |
          curl -X POST "${{ secrets.DAGU_URL }}/api/v1/webhooks/deploy-pipeline" \
            -H "Authorization: Bearer ${{ secrets.DAGU_WEBHOOK_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "branch": "${{ github.ref_name }}",
              "commit": "${{ github.sha }}",
              "repository": "${{ github.repository }}"
            }'
```

#### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - |
      curl -X POST "$DAGU_URL/api/v1/webhooks/deploy-pipeline" \
        -H "Authorization: Bearer $DAGU_WEBHOOK_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
          \"branch\": \"$CI_COMMIT_REF_NAME\",
          \"commit\": \"$CI_COMMIT_SHA\",
          \"pipeline_id\": \"$CI_PIPELINE_ID\"
        }"
```

### GitHub Webhooks

Configure GitHub to send repository events to Dagu:

1. In your GitHub repository, go to **Settings** > **Webhooks**
2. Add a new webhook with:
   - **Payload URL**: `https://dagu.example.com/api/v1/webhooks/github-events`
   - **Content type**: `application/json`
   - **Secret**: (not used, authentication via Bearer token)

Note: For GitHub webhooks, you'll need to configure a reverse proxy to add the Authorization header, as GitHub doesn't support Bearer token authentication directly.

**Nginx example:**
```nginx
location /api/v1/webhooks/github-events {
    proxy_pass http://localhost:8080;
    proxy_set_header Authorization "Bearer YOUR_API_TOKEN";
    proxy_set_header Host $host;
}
```

### Slack Commands

Create a Slack slash command that triggers a DAG:

```yaml
# DAG: slack-command.yaml
steps:
  - name: log-request
    command: echo "User ${WEBHOOK_PAYLOAD.user_name} requested: ${WEBHOOK_PAYLOAD.text}"

  - name: execute-action
    command: ./scripts/handle-slack-command.sh "${WEBHOOK_PAYLOAD.text}"
    depends:
      - log-request
```

### Custom Integrations

Any system that can make HTTP requests can trigger Dagu DAGs:

```python
import requests

def trigger_dagu_dag(dag_name: str, payload: dict):
    response = requests.post(
        f"https://dagu.example.com/api/v1/webhooks/{dag_name}",
        headers={
            "Authorization": f"Bearer {WEBHOOK_TOKEN}",
            "Content-Type": "application/json"
        },
        json=payload
    )
    response.raise_for_status()
    return response.json()

# Trigger a DAG with custom data
result = trigger_dagu_dag("data-pipeline", {
    "source": "api",
    "timestamp": "2024-02-11T12:00:00Z"
})
print(f"Started DAG run: {result['dagRunId']}")
```
