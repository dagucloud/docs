# Remote Nodes

## Multi-Environment

By setting up remote nodes, you can run workflows on different Dagu server environments (e.g., development, staging, production) in a single Dagu server Web UI.

```yaml
remoteNodes:
  - name: "development"
    apiBaseURL: "http://dev.internal:8080/api/v1"
    isBasicAuth: true
    basicAuthUsername: "dev"
    basicAuthPassword: "${DEV_PASSWORD}"

  - name: "staging"
    apiBaseURL: "https://staging.example.com/api/v1"
    isAuthToken: true
    authToken: "${STAGING_TOKEN}"

  - name: "production"
    apiBaseURL: "https://prod.example.com/api/v1"
    isAuthToken: true
    authToken: "${PROD_TOKEN}"
```

## Using API Keys for Remote Access

When remote nodes use [Builtin Authentication](/configurations/authentication/builtin), you can use [API Keys](/configurations/authentication/api-keys) for secure, role-based access:

```yaml
remoteNodes:
  - name: "production"
    apiBaseURL: "https://prod.example.com/api/v1"
    isAuthToken: true
    authToken: "dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
```

API keys provide fine-grained role-based permissions (admin, manager, operator, viewer) and usage tracking. See [Remote Nodes Authentication](/configurations/authentication/remote-nodes) for detailed setup instructions.

## Secure Access using mTLS

```yaml
# mTLS configuration
remoteNodes:
  - name: "secure-prod"
    apiBaseURL: "https://secure.example.com/api/v1"
    tlsConfig:
      certFile: "/etc/dagu/certs/client.crt"
      keyFile: "/etc/dagu/certs/client.key"
      caFile: "/etc/dagu/certs/ca.crt"
```

## See Also

- [Server Configuration](/configurations/server)
- [Remote Nodes Authentication](/configurations/authentication/remote-nodes)
- [API Keys](/configurations/authentication/api-keys)
