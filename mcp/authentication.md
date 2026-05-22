# MCP Authentication

The MCP endpoint uses the same authentication mode as the Dagu server.

| Dagu auth mode | MCP client setup |
|----------------|------------------|
| `none` | No token is required. Use this only for isolated local development. |
| `builtin` | Create an [API key](/server-admin/authentication/api-keys) and send it as `Authorization: Bearer dagu_...`. A login JWT also works, but API keys are better for tools and automation. |
| `basic` | Use HTTP Basic authentication if your MCP client supports it. |

Prefer an `Authorization` header. Codex and Claude Code both support sending headers to HTTP MCP servers. If a client cannot send headers, Dagu also accepts `?token=<token>` on stream endpoints, but headers are safer for shared or proxied environments.

## API Key Surfaces

API keys can be limited to accepted surfaces:

| Surface | Accepted by |
|---------|-------------|
| `rest_api` | REST API and related HTTP API surfaces |
| `mcp` | MCP endpoint |

Use an MCP-only key when an AI tool should not be able to call the REST API directly. Use both surfaces when the same automation identity needs REST and MCP access.

Legacy keys without surface metadata are treated as both `rest_api` and `mcp` for compatibility.

## Roles And Workspaces

MCP uses the same role and workspace model as Dagu users and API keys.

| Role | MCP use |
|------|---------|
| `viewer` | Read DAGs, run state, logs, and reference resources. |
| `operator` | Read state, start or enqueue runs, retry runs, and stop runs. |
| `developer` | Create or edit DAG specs in addition to run control. |
| `manager` | Workflow administration and audit/event visibility. |
| `admin` | Full control, including API key management. |

Workspace access limits are enforced through the same API service used by the Web UI and REST API. When an MCP request includes `?workspace=<name>`, Dagu records that workspace in audit context and applies the resolved access rules for the credential.

## Attribution

API keys support two attribution classes:

| Attribution | Audit subject |
|-------------|---------------|
| `user_owned` | The owner user is recorded as the acting subject. |
| `service_account` | The service-account identity is recorded as the acting subject and credential. |

Use user-owned keys when individual accountability matters. Use service-account keys for shared automation identities such as a CI runner or team MCP bot.

## Enterprise OIDC/SSO For MCP

OIDC/SSO-backed MCP access is an enterprise deployment path for organizations that need centralized identity, access policy, and audit controls for MCP clients.

Use this path when you need:

- MCP actions attributed to individual SSO users instead of shared API keys
- identity-provider policy enforcement for MCP access
- enterprise audit requirements around who used which AI tool to read, edit, or run Dagu workflows

OIDC/SSO-backed MCP access needs to match your identity provider, MCP clients, role mapping, and audit requirements. If this is your requirement, please [contact the Dagu team](https://dagu.sh/contact) to discuss the right setup.
