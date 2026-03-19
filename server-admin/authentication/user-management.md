# User Management (Pro)

::: info Pro License
Creating, updating, and deleting users requires a [Dagu Pro license](https://dagu.sh/pricing). Listing users, viewing user details, and password operations work without a license.
:::

Requires `auth.mode: builtin` (default).

## Initial Setup

On first launch with builtin auth and no existing users, an admin account must be created. There are three ways to do this:

**Via config or environment variables** — set `initial_admin` in the config file or `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME` / `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD` environment variables. The server creates the admin at startup. See [Builtin Authentication](./builtin#initial-setup) for details.

**Via the setup page** — the web UI redirects to `/setup` automatically.

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

## User Object

Fields returned by the API:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID, auto-generated |
| `username` | string | 1–64 characters, must be unique |
| `role` | string | `admin`, `manager`, `developer`, `operator`, `viewer` |
| `authProvider` | string | `builtin` or `oidc` |
| `isDisabled` | boolean | Disabled accounts cannot log in |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

## API

All endpoints require admin role. Pro-gated endpoints return `403` with message `"User management requires a Dagu Pro license"` when unlicensed.

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
      "authProvider": "builtin",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Create User (Pro)

`POST /api/v1/users`

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "min-8-chars", "role": "developer"}'
```

Returns `201` with `{"user": User}`. Returns `409` if username exists. Returns `400` for invalid role or weak password.

### Get User

`GET /api/v1/users/{userId}`

```bash
curl http://localhost:8080/api/v1/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

Returns `200` with `{"user": User}`. Returns `404` if not found.

### Update User (Pro)

`PATCH /api/v1/users/{userId}`

All fields are optional. You cannot disable your own account.

```bash
curl -X PATCH http://localhost:8080/api/v1/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "manager", "isDisabled": false}'
```

Returns `200` with updated user. Returns `409` if new username conflicts.

### Delete User (Pro)

`DELETE /api/v1/users/{userId}`

You cannot delete your own account.

```bash
curl -X DELETE http://localhost:8080/api/v1/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204` on success. Returns `403` if attempting self-deletion.

### Reset Password

`POST /api/v1/users/{userId}/reset-password`

Admin resets another user's password. Not Pro-gated.

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
