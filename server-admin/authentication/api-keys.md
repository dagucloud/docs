# API Keys

API keys let scripts, CI jobs, other Dagu servers, and external tools call the Dagu API without an interactive login.

## When To Use API Keys

Use an API key when you need:

- CI/CD to start or enqueue workflows
- automation to read run status or outputs
- one Dagu server to talk to another through [remote nodes](remote-nodes)
- a long-lived machine credential with a clear role and audit trail

API keys require [Builtin Authentication](./builtin).

## What You Manage

Each API key has:

- a **name**
- an optional **description**
- a **role**
- optional **workspace limits**
- **last used** tracking in the UI

The full secret is shown only once when you create the key.

## Create An API Key In The Web UI

1. Sign in as an admin
2. Open **Admin > API Keys**
3. Click **Create API Key**
4. Enter a name and optional description
5. Choose the role
6. Choose **All workspaces** or **Selected workspaces**
7. Create the key and store the secret immediately

## Use An API Key

Send it as a Bearer token:

```bash
curl -H "Authorization: Bearer $DAGU_API_KEY" \
  http://localhost:8080/api/v1/dags
```

For CLI usage:

```bash
export DAGU_API_TOKEN=$DAGU_API_KEY
dagu status
```

## Roles And Workspace Access

API keys use the same role model as users.

| Role | Typical Use |
|------|-------------|
| `admin` | Full control, including admin endpoints |
| `manager` | Workflow administration plus audit/event visibility |
| `developer` | Create, edit, run, and troubleshoot workflows |
| `operator` | Run and stop workflows |
| `viewer` | Read-only automation |

Workspace access works the same way as it does for users:

- **All workspaces**: the key's role applies everywhere
- **Selected workspaces**: use a top-level `viewer` role and grant per-workspace roles

Example for a key that can deploy only inside `ops`:

```json
{
  "role": "viewer",
  "workspaceAccess": {
    "all": false,
    "grants": [
      { "workspace": "ops", "role": "developer" }
    ]
  }
}
```

See [User Management](/server-admin/authentication/user-management#workspace-access) for the workspace model.

## Create Keys By API

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r '.token')

curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ci-pipeline",
    "description": "Workflow automation",
    "role": "operator",
    "workspaceAccess": { "all": true }
  }'
```

The response includes the key secret once. Save it before you leave the page or discard the response output.

## CI/CD Example

```yaml
name: Trigger Workflow
on:
  push:
    branches: [main]

jobs:
  run-dagu:
    runs-on: ubuntu-latest
    steps:
      - name: Start deploy workflow
        env:
          DAGU_API_KEY: ${{ secrets.DAGU_API_KEY }}
        run: |
          curl -X POST "https://dagu.example.com/api/v1/dags/deploy/start" \
            -H "Authorization: Bearer $DAGU_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"params":"{\"version\":\"'${GITHUB_SHA}'\"}"}'
```

## Remote Node Example

API keys are also a good fit for cross-server access:

```yaml
remote_nodes:
  - name: production
    api_base_url: https://prod.example.com/api/v1
    auth_type: token
    auth_token: ${PROD_DAGU_API_KEY}
```

## Manage Existing Keys

Admins can list, inspect, update, and delete API keys from the UI or API.

| Action | Endpoint |
|--------|----------|
| List keys | `GET /api/v1/api-keys` |
| Get one key | `GET /api/v1/api-keys/{keyId}` |
| Create key | `POST /api/v1/api-keys` |
| Update key | `PATCH /api/v1/api-keys/{keyId}` |
| Delete key | `DELETE /api/v1/api-keys/{keyId}` |

## Good Practices

1. Use a separate key per service or pipeline.
2. Give each key the smallest role it needs.
3. Scope keys to workspaces when possible.
4. Rotate keys regularly.
5. Delete keys you no longer use.
6. Store keys in your normal secret manager rather than in source control.

## Related Pages

- [Builtin Authentication](./builtin)
- [User Management](./user-management)
- [Remote Nodes Authentication](./remote-nodes)
