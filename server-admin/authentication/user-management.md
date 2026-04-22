# User Management

::: info Deployment Model
This page covers self-hosted Dagu. On self-hosted Dagu, creating, updating, and deleting users requires an active self-host license. Listing users, viewing user details, and password operations work with builtin auth. Hosted Dagu Cloud includes user management by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

Requires `auth.mode: builtin` (default).

## Initial Setup

On first launch with builtin auth and no existing users, an admin account must be created. There are four ways to do this:

**Via the guided installer** — the script installers can collect the first admin credentials for you and use the same bootstrap flow as `initial_admin`.

**Via config or environment variables** — set `initial_admin` in the config file or `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME` / `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD` environment variables. The server creates the admin at startup. See [Builtin Authentication](./builtin#initial-setup) for details.

**Via the setup page** — the web UI redirects to `/setup` automatically for manual installs that do not configure `initial_admin`.

**Via API** — call the setup endpoint directly:

```bash
curl -X POST http://localhost:8080/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

Response:
```json
{
  "token": "eyJhbG...",
  "expiresAt": "2025-01-11T00:00:00Z",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "role": "admin",
    "workspaceAccess": { "all": true },
    "createdAt": "2025-01-10T12:00:00Z",
    "updatedAt": "2025-01-10T12:00:00Z"
  }
}
```

The setup endpoint always creates an `admin` role user. It returns `403` if any user already exists.

## Roles

| Role | DAGs (read) | DAGs (write) | DAGs (run/stop) | Audit Logs | User Management |
|------|-------------|--------------|-----------------|------------|-----------------|
| `admin` | yes | yes | yes | yes | yes |
| `manager` | yes | yes | yes | yes | no |
| `developer` | yes | yes | yes | no | no |
| `operator` | yes | no | yes | no | no |
| `viewer` | yes | no | no | no | no |

Source: `internal/auth/role.go`

## Workspace Access

Users can be granted access to all workspaces or to selected workspaces.

Workspace access is a scoping feature for one Dagu installation. It determines which workspace-scoped DAGs, DAG runs, documents, and search results are shown to the user, and which role applies in each named workspace. It is not a multi-tenant isolation mechanism or a replacement for separate deployments when tenants must be isolated.

The Web UI labels the aggregate scope as `all`. In the API, the user object stores this as `workspaceAccess.all: true`.

```json
{
  "workspaceAccess": {
    "all": true
  }
}
```

Selected-workspace users must have top-level role `viewer`; each workspace grant carries its own role:

```json
{
  "role": "viewer",
  "workspaceAccess": {
    "all": false,
    "grants": [
      { "workspace": "ops", "role": "developer" },
      { "workspace": "prod", "role": "operator" }
    ]
  }
}
```

Rules:

- Existing users with no stored `workspaceAccess` are treated as `all` for backward compatibility.
- New users created in the Web UI must choose `all` or at least one selected workspace.
- Selected-workspace users must have top-level role `viewer`.
- Grant roles can be `manager`, `developer`, `operator`, or `viewer`.
- `admin` cannot be scoped to a workspace; use `all` for admins.
- Grant workspace names must reference existing workspace records when the user is created or updated.
- Resources without a workspace tag are shown as `default` and remain visible to authenticated users. For selected-workspace users, the top-level `viewer` role applies to `default`.

If a workspace is deleted later, user records are not rewritten automatically. Remove or update stale grants before the next user update; validation requires selected grants to reference existing workspaces.

## User Object

Fields returned by the API:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID, auto-generated |
| `username` | string | 1–64 characters, must be unique |
| `role` | string | `admin`, `manager`, `developer`, `operator`, `viewer` |
| `workspaceAccess` | object | Workspace access policy; omitted legacy data is treated as `all` |
| `authProvider` | string | `builtin` or `oidc` |
| `isDisabled` | boolean | Disabled accounts cannot log in |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

`workspaceAccess` fields:

| Field | Type | Description |
|-------|------|-------------|
| `all` | boolean | `true` means the top-level role applies in every workspace |
| `grants` | array | Required when `all` is `false`; each item contains `workspace` and `role` |

## API

All endpoints require admin role. On self-hosted Dagu, create, update, and delete operations return `403` when the required self-host license is not active.

### List Users

`GET /api/v1/users`

```bash
curl http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "users": [
    {
      "id": "...",
      "username": "admin",
      "role": "admin",
      "workspaceAccess": { "all": true },
      "authProvider": "builtin",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Create User

`POST /api/v1/users`

Create a user with access to all workspaces:

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "min-8-chars",
    "role": "developer",
    "workspaceAccess": { "all": true }
  }'
```

Create a user with selected workspace access:

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bob",
    "password": "min-8-chars",
    "role": "viewer",
    "workspaceAccess": {
      "all": false,
      "grants": [
        { "workspace": "ops", "role": "developer" },
        { "workspace": "prod", "role": "operator" }
      ]
    }
  }'
```

Returns `201` with `{"user": User}`. Returns `409` if username exists. Returns `400` for invalid role, weak password, invalid workspace access, duplicate workspace grants, or grants for unknown workspaces.

### Get User

`GET /api/v1/users/{userId}`

```bash
curl http://localhost:8080/api/v1/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

Returns `200` with `{"user": User}`. Returns `404` if not found.

### Update User

`PATCH /api/v1/users/{userId}`

All fields are optional. You cannot disable your own account. When changing selected workspace grants, include `role: "viewer"` unless the user is being changed back to `workspaceAccess.all: true`.

```bash
curl -X PATCH http://localhost:8080/api/v1/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "viewer",
    "workspaceAccess": {
      "all": false,
      "grants": [
        { "workspace": "ops", "role": "manager" }
      ]
    },
    "isDisabled": false
  }'
```

Returns `200` with updated user. Returns `409` if new username conflicts.

### Delete User

`DELETE /api/v1/users/{userId}`

You cannot delete your own account.

```bash
curl -X DELETE http://localhost:8080/api/v1/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204` on success. Returns `403` if attempting self-deletion.

### Reset Password

`POST /api/v1/users/{userId}/reset-password`

Admin resets another user's password. This works with builtin auth and does not require a self-host license.

```bash
curl -X POST http://localhost:8080/api/v1/users/USER_ID/reset-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "new-password"}'
```

### Change Own Password

`POST /api/v1/auth/change-password`

Any authenticated user can change their own password. Does not require admin role.

```bash
curl -X POST http://localhost:8080/api/v1/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "old-password", "newPassword": "new-password"}'
```

Returns `401` if current password is wrong. Returns `400` if new password is too short.

## Passwords

- Minimum 8 characters
- Hashed with bcrypt (cost factor 12)
- Timing-attack safe: failed lookups compare against a dummy hash to prevent username enumeration

## Storage

Users are stored as individual JSON files:

```
~/.local/share/dagu/users/
├── a1b2c3d4-....json
├── e5f6g7h8-....json
└── ...
```

Override with `paths.users_dir` in config or `DAGU_USERS_DIR` environment variable.
