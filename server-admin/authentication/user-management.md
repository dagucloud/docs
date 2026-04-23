# User Management

::: info Deployment Model
This page covers self-hosted Dagu. On self-hosted Dagu, creating, updating, and deleting users requires an active self-host license. Hosted Dagu Cloud includes user management by default. See the [pricing page](https://dagu.sh/pricing) for current availability.
:::

User management is available when `auth.mode: builtin` is enabled.

## What This Page Is For

Use user management when you need to:

- create accounts for teammates
- assign roles such as `admin`, `manager`, `developer`, `operator`, or `viewer`
- limit access to specific workspaces
- reset passwords
- disable or remove accounts

Most teams do this from the Web UI at `/users`.

## First Admin Setup

On a fresh self-hosted installation with builtin auth, Dagu needs one admin account before anyone can sign in.

You can create that first admin in four ways:

1. **Installer**: the guided install scripts can collect the first admin credentials.
2. **Config or environment variables**: set `initial_admin` before startup.
3. **Setup page**: Dagu redirects a fresh install to `/setup`.
4. **API**: call the setup endpoint directly.

Example:

```bash
curl -X POST http://localhost:8080/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

## Roles

| Role | What It Is Typically Used For |
|------|-------------------------------|
| `admin` | Full control, including users, API keys, and auth settings |
| `manager` | Workflow administration plus audit/event visibility |
| `developer` | Build, edit, run, and troubleshoot workflows |
| `operator` | Run and monitor workflows without editing them |
| `viewer` | Read-only access |

## Workspace Access

User access can apply to every workspace or only selected ones.

### All Workspaces

Use this when the same role should apply everywhere.

Examples:

- platform admins
- operators who manage all environments
- developers working across all teams

### Selected Workspaces

Use this when one person should see only specific workspaces or should have different roles in different workspaces.

Typical pattern:

- set the user's top-level role to `viewer`
- grant a role per workspace, such as `developer` in `ops` and `operator` in `prod`

### What Users See

Workspace access affects workspace-aware pages such as:

- Definitions
- Runs
- Cockpit
- Search
- Documents

Items with no named workspace still appear in the **default** workspace view.

If you need strict tenant separation rather than scoped visibility inside one installation, run separate Dagu deployments.

## Everyday Tasks In The Web UI

### Create A User

1. Open **Admin > Users**
2. Click **Create User**
3. Enter username and password
4. Choose a role
5. Choose **All workspaces** or **Selected workspaces**
6. Save

### Reset A Password

1. Open the user in **Admin > Users**
2. Choose **Reset Password**
3. Enter the new password

### Disable A User

Disable the account when you want to preserve history and ownership but block sign-in.

### Delete A User

Delete the account when it should be removed entirely. Dagu does not let you delete your own active admin account from the same session.

## API For Automation

All user-management endpoints require admin access. On self-hosted Dagu, create, update, and delete operations also require the needed self-host license.

| Action | Endpoint |
|--------|----------|
| List users | `GET /api/v1/users` |
| Create user | `POST /api/v1/users` |
| Get one user | `GET /api/v1/users/{userId}` |
| Update user | `PATCH /api/v1/users/{userId}` |
| Delete user | `DELETE /api/v1/users/{userId}` |
| Reset another user's password | `POST /api/v1/users/{userId}/reset-password` |
| Change your own password | `POST /api/v1/auth/change-password` |

### Create A User With Access Everywhere

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

### Create A User For Selected Workspaces

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

## Password Rules

- minimum length: **8 characters**
- users can change their own password after signing in
- admins can reset passwords for other users

Use a password manager or SSO/OIDC for larger teams.

## Related Pages

- [Builtin Authentication](./builtin)
- [API Keys](./api-keys)
- [OIDC / SSO](./oidc)
- [Workspaces](/web-ui/workspaces)
