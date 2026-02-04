# Remote Nodes Authentication

Configure authentication for connecting to remote Dagu instances.

## Configuration

### YAML Configuration

```yaml
# ~/.config/dagu/config.yaml
remoteNodes:
  - name: production
    apiBaseURL: https://prod.example.com/api/v1
    isBasicAuth: true
    basicAuthUsername: admin
    basicAuthPassword: prod-password

  - name: staging
    apiBaseURL: https://staging.example.com/api/v1
    isAuthToken: true
    authToken: staging-api-token

  - name: development
    apiBaseURL: http://dev.example.com:8080/api/v1
    # No auth configured - anonymous access
```

## Authentication Types

### Basic Authentication

```yaml
remoteNodes:
  - name: remote1
    apiBaseURL: https://remote1.example.com/api/v1
    isBasicAuth: true
    basicAuthUsername: admin
    basicAuthPassword: secure-password
```

### Token Authentication

Use for static tokens or [API Keys](api-keys).

```yaml
remoteNodes:
  - name: remote2
    apiBaseURL: https://remote2.example.com/api/v1
    isAuthToken: true
    authToken: api-token-for-remote2
```

### API Key Authentication

When the remote node uses [Builtin Authentication](builtin) with [API Keys](api-keys), you can use an API key as the auth token. API keys provide role-based access control, allowing fine-grained permissions for remote node access.

```yaml
remoteNodes:
  - name: production
    apiBaseURL: https://prod.example.com/api/v1
    isAuthToken: true
    authToken: dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B
```

The remote node will recognize the `dagu_` prefix and validate it as an API key, applying the key's assigned role permissions.

::: tip
Use environment variables to avoid storing API keys in configuration files:

```yaml
remoteNodes:
  - name: production
    apiBaseURL: https://prod.example.com/api/v1
    isAuthToken: true
    authToken: ${PROD_API_KEY}
```
:::

### No Authentication

```yaml
remoteNodes:
  - name: local-dev
    apiBaseURL: http://localhost:8081/api/v1
    # No auth fields - anonymous access
```

## Multi-Server Setup with Builtin Auth

A common use case is managing multiple Dagu servers, each with builtin authentication enabled, from a single UI.

### Scenario

- **Server A** (main server): Users log in via web UI
- **Server B** (remote node): Accessed via API key from Server A

### Step 1: Create API Key on Server B

Log into Server B and create an API key with the desired role:

```bash
# On Server B: Create an API key for remote access
TOKEN=$(curl -s -X POST http://server-b:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin-password"}' | jq -r '.token')

curl -X POST http://server-b:8080/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "server-a-access",
    "description": "API key for Server A remote access",
    "role": "admin"
  }'
```

Save the returned `key` value (e.g., `dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B`).

### Step 2: Configure Remote Node on Server A

On Server A, add Server B as a remote node:

```yaml
# Server A: ~/.config/dagu/config.yaml
auth:
  mode: builtin

remoteNodes:
  - name: server-b
    apiBaseURL: http://server-b:8080/api/v1
    isAuthToken: true
    authToken: dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B
```

### Step 3: Access Server B from Server A's UI

1. Log into Server A's web UI with your user credentials
2. Use the remote node selector in the sidebar to switch to "server-b"
3. All operations will now execute on Server B using the API key's permissions

### Security Considerations

- **Role Selection**: Choose the minimum required role for the API key
- **Key Rotation**: Regularly rotate API keys used for remote access
- **Network Security**: Use HTTPS and consider VPN/private networks between servers
- **Audit Trail**: API key usage is tracked via `lastUsedAt` on the remote server

## TLS Options

### Skip TLS Verification

```yaml
remoteNodes:
  - name: self-signed
    apiBaseURL: https://internal.example.com/api/v1
    skipTLSVerify: true
    isAuthToken: true
    authToken: token
```
