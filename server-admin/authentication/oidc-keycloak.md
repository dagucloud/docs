# Keycloak OIDC Setup

Configure Dagu with Keycloak as OIDC provider.

::: info Deployment Model
This guide applies to self-hosted Dagu using builtin auth + OIDC. Hosted Dagu Cloud includes authentication features by default, so you do not configure Keycloak through `config.yaml` there.
:::

## Quick Start with Docker

### 1. Start Keycloak

```yaml
# docker-compose-keycloak.yml
version: '3.8'
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    command: start-dev
    ports:
      - "8081:8080"
    volumes:
      - keycloak_data:/opt/keycloak/data

volumes:
  keycloak_data:
```

```bash
docker compose -f docker-compose-keycloak.yml up -d
```

### 2. Configure Keycloak

1. Access Keycloak at http://localhost:8081
2. Login with admin/admin
3. Create a new realm:
   - Click "Create Realm"
   - Name: `dagu` (or your preference)
4. Create a client:
   - Clients > Create client
   - Client type: OpenID Connect
   - Client ID: `dagu-client`
   - Click Next
   - Client authentication: ON
   - Click Next
   - Valid redirect URIs: `http://localhost:8080/oidc-callback`
   - Click Save
5. Get credentials:
   - Go to Clients > dagu-client > Credentials
   - Copy the Client Secret

### 3. Create Test User

1. Users > Add user
2. Username: `testuser`
3. Email: `testuser@example.com`
4. Email verified: ON
5. Click Create
6. Credentials tab > Set password
7. Temporary: OFF

### 4. Configure Dagu

#### YAML Configuration

```yaml
# ~/.config/dagu/config.yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: "replace-with-a-random-jwt-secret"
  oidc:
    client_id: "dagu-client"
    client_secret: "copy-from-keycloak-credentials-tab"
    client_url: "http://localhost:8080"
    issuer: "http://localhost:8081/realms/dagu"
    scopes:
      - "openid"
      - "profile"
      - "email"
```

#### Environment Variables

```bash
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_TOKEN_SECRET="replace-with-a-random-jwt-secret"
export DAGU_AUTH_OIDC_CLIENT_ID="dagu-client"
export DAGU_AUTH_OIDC_CLIENT_SECRET="your-client-secret"
export DAGU_AUTH_OIDC_CLIENT_URL="http://localhost:8080"
export DAGU_AUTH_OIDC_ISSUER="http://localhost:8081/realms/dagu"
export DAGU_AUTH_OIDC_SCOPES="openid,profile,email"

dagu start-all
```

## Production Setup

### Keycloak Configuration

```yaml
# Production Keycloak
auth:
  mode: builtin
  builtin:
    token:
      secret: "replace-with-a-random-jwt-secret"
  oidc:
    client_id: "dagu-prod"
    client_secret: "production-secret"
    client_url: "https://dagu.example.com"
    issuer: "https://auth.example.com/realms/production"
    scopes:
      - "openid"
      - "profile"
      - "email"
```

## Testing

```bash
# 1. Start Keycloak
docker compose -f docker-compose-keycloak.yml up -d

# 2. Configure realm and client as above

# 3. Start Dagu
dagu start-all

# 4. Access http://localhost:8080
# You'll be redirected to Keycloak login

# 5. Login with testuser
```

## Keycloak URLs

- Admin Console: http://localhost:8081/admin
- Realm Settings: http://localhost:8081/admin/master/console/#/dagu
- OpenID Configuration: http://localhost:8081/realms/dagu/.well-known/openid-configuration

## Notes

- Keycloak runs on port 8081 to avoid conflict with Dagu (8080)
- Issuer URL format: `http://keycloak-host/realms/realm-name`
- Client authentication must be enabled for confidential clients
- Development mode (`start-dev`) is insecure - use production mode for real deployments
- Default token lifespan is 5 minutes (configurable in realm settings)
