# Basic Authentication

Username and password authentication for Dagu.

## Configuration

### YAML Configuration

```yaml
# ~/.config/dagu/config.yaml
auth:
  mode: basic
  basic:
    username: admin
    password: secure-password
```

### Environment Variables

```bash
export DAGU_AUTH_MODE=basic
export DAGU_AUTH_BASIC_USERNAME=admin
export DAGU_AUTH_BASIC_PASSWORD=secure-password

dagu start-all
```

## Usage

### CLI Access

```bash
# Using environment variables
export DAGU_AUTH_MODE=basic
export DAGU_AUTH_BASIC_USERNAME=admin
export DAGU_AUTH_BASIC_PASSWORD=secure-password
dagu status
```

### API Access

```bash
# Basic auth header
curl -u admin:secure-password http://localhost:8080/api/v1/dags

# Or with Authorization header
curl -H "Authorization: Basic $(echo -n admin:secure-password | base64)" \
     http://localhost:8080/api/v1/dags
```

## Notes

- Basic authentication is active when `auth.mode` is set to `basic` and both username and password are configured
- To disable authentication entirely, set `auth.mode: none`
- Basic mode provides a single shared credential — for multi-user support with RBAC, use `auth.mode: builtin`
- Credentials are checked on every request