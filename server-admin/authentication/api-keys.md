# API Keys

API keys provide programmatic access to the Dagu API with role-based permissions. Unlike static tokens, API keys support fine-grained access control and can be managed through both the web UI and API.

## Features

- **Role-Based Access Control**: Each API key has its own role assignment (admin, manager, developer, operator, viewer)
- **Key Management**: Create, update, and delete API keys through the web UI or API
- **Usage Tracking**: Track when each API key was last used
- **Secure Storage**: Keys are hashed with bcrypt before storage; the full key is only shown once at creation

## Requirements

API keys require [Builtin Authentication](builtin) to be enabled.

## Creating API Keys

### Via Web UI

1. Log in as an admin user
2. Navigate to **Settings** > **API Keys**
3. Click **Create API Key**
4. Enter a name, optional description, and select a role
5. Click **Create**
6. **Important**: Copy the displayed key immediately - it will not be shown again

### Via API

```bash
# First, authenticate to get a JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}' | jq -r '.token')

# Create an API key
curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ci-pipeline",
    "description": "API key for CI/CD pipeline",
    "role": "operator"
  }'
```

**Response**:
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ci-pipeline",
    "description": "API key for CI/CD pipeline",
    "role": "operator",
    "keyPrefix": "dagu_abc",
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T12:00:00Z",
    "createdBy": "admin-user-id"
  },
  "key": "dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
}
```

::: warning
The `key` field contains the full API key secret and is **only returned once** at creation time. Store it securely immediately.
:::

## Using API Keys

API keys are used as Bearer tokens in the `Authorization` header:

```bash
curl -H "Authorization: Bearer dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B" \
  http://localhost:8080/api/v1/dags
```

### CLI Usage

Set the API key as an environment variable:

```bash
export DAGU_API_TOKEN=dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B
dagu status
```

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

      - name: Trigger DAG
        env:
          DAGU_API_KEY: ${{ secrets.DAGU_API_KEY }}
        run: |
          curl -X POST "https://dagu.example.com/api/v1/dags/deploy-pipeline/start" \
            -H "Authorization: Bearer $DAGU_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"params": "{\"version\": \"${{ github.sha }}\"}"}'
```

#### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - |
      curl -X POST "https://dagu.example.com/api/v1/dags/deploy-pipeline/start" \
        -H "Authorization: Bearer $DAGU_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"params\": \"{\\\"version\\\": \\\"$CI_COMMIT_SHA\\\"}\"}"
  variables:
    DAGU_API_KEY: $DAGU_API_KEY
```

### Remote Node Access

API keys can authenticate requests from other Dagu servers configured as [remote nodes](remote-nodes). This enables managing multiple Dagu instances from a single UI with role-based access control.

```yaml
# On the main server, configure a remote node using an API key
remote_nodes:
  - name: production
    api_base_url: https://prod.example.com/api/v1
    auth_type: token
    auth_token: dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B
```

See [Remote Nodes Authentication](remote-nodes) for complete setup instructions.

## API Key Roles

API keys inherit the same role-based permissions as users:

| Role | Permissions |
|------|-------------|
| `admin` | Full access including user and API key management |
| `manager` | Create, edit, delete, run, and stop DAGs; can view audit logs |
| `developer` | Create, edit, delete, run, and stop DAGs |
| `operator` | Run and stop DAGs (execute only) |
| `viewer` | Read-only access to DAGs and execution history |

## Managing API Keys

### List All API Keys

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/api-keys
```

**Response**:
```json
{
  "apiKeys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ci-pipeline",
      "description": "API key for CI/CD pipeline",
      "role": "operator",
      "keyPrefix": "dagu_7Kq",
      "createdAt": "2024-02-11T12:00:00Z",
      "updatedAt": "2024-02-11T12:00:00Z",
      "createdBy": "admin-user-id",
      "lastUsedAt": "2024-02-11T15:30:00Z"
    }
  ]
}
```

### Get API Key Details

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/api-keys/{key-id}
```

### Update API Key

```bash
curl -X PATCH http://localhost:8080/api/v1/api-keys/{key-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production-ci",
    "description": "Updated description",
    "role": "manager"
  }'
```

### Delete API Key

```bash
curl -X DELETE http://localhost:8080/api/v1/api-keys/{key-id} \
  -H "Authorization: Bearer $TOKEN"
```

## Key Format

API keys have the following format:

```
dagu_<base58-encoded-random-bytes>
```

- **Prefix**: All API keys start with `dagu_` for easy identification
- **Random Part**: 32 bytes of cryptographically secure random data, Base58 encoded
- **Total Length**: Approximately 50 characters

The key prefix (first 8 characters) is stored and displayed in the UI for identification purposes.

## Security Best Practices

1. **Rotate Keys Regularly**: Delete old keys and create new ones periodically
2. **Use Minimal Permissions**: Assign the least privileged role needed for each use case
3. **Separate Keys by Environment**: Use different keys for development, staging, and production
4. **Store Securely**: Use secret management solutions (e.g., HashiCorp Vault, AWS Secrets Manager)
5. **Monitor Usage**: Check `lastUsedAt` to identify unused keys for cleanup
6. **Revoke Immediately**: Delete compromised keys immediately

## API Keys vs Static Tokens

| Feature | API Keys | Static Token |
|---------|----------|--------------|
| Role-Based Access | Yes | No (admin only) |
| Multiple Keys | Yes | Single token |
| Usage Tracking | Yes | No |
| Web UI Management | Yes | No |
| Rotation | Easy | Requires config change |
| Revocation | Immediate | Requires restart |

## Comparison with Other Auth Methods

| Feature | API Keys | JWT (Login) | Basic Auth | Static Token |
|---------|----------|-------------|------------|--------------|
| Role Support | Yes | Yes | No | No |
| Expiration | No | Yes (TTL) | No | No |
| Management UI | Yes | N/A | No | No |
| Best For | Automation | Interactive | Simple setups | Legacy scripts |
