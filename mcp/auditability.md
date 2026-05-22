# MCP Auditability

MCP activity is audited as first-class Dagu activity. The MCP route, MCP tools, resource subscriptions, and downstream DAG actions share audit context so operators can connect an AI-tool request with the Dagu changes or run-control actions it caused.

## Event Shape

MCP audit entries use the `mcp` category and include MCP-specific fields when available:

| Field | Meaning |
|-------|---------|
| `source` | Producer surface. MCP requests use `mcp`. |
| `surface` | Accepted credential surface. MCP API-key requests use `mcp`. |
| `result` | Outcome such as `received`, `started`, `succeeded`, `failed`, or `denied`. |
| `correlation_id` | Shared ID that connects MCP attempt events with downstream domain events. |
| `resource_type` | Affected resource class such as `dag`, `run`, `run_logs`, or `mcp_request`. |
| `resource_id` | Affected resource identifier, such as a DAG name or `dagName/dagRunId`. |
| `workspace` | Canonical workspace used for audit filtering. |
| `credential_id` | Accepted credential identifier, independent of the user or service-account subject. |
| `credential_type` | Credential class such as `api_key`, `session`, `basic`, or `none`. |
| `mcp_tool` | MCP tool name, such as `dagu_read`, `dagu_change`, or `dagu_execute`. |

## Tool Call Events

Each MCP tool call records lifecycle events:

| Action | When it is written |
|--------|--------------------|
| `mcp.tool_call.received` | Dagu accepted the MCP tool request. |
| `mcp.tool_call.started` | Dagu started executing the tool implementation. |
| `mcp.tool_call.succeeded` | The tool completed successfully. |
| `mcp.tool_call.failed` | The tool failed during execution. |
| `mcp.tool_call.denied` | The tool failed because authorization denied the operation. |

Successful tool events can include additional outcome details such as `dag_run_id`, `run_uri`, `applied`, and `valid`.

## Request And Subscription Events

Authentication and subscription behavior is also auditable:

| Action | Meaning |
|--------|---------|
| `mcp.request.denied` | The request reached the MCP route but authentication or surface authorization denied it. |
| `mcp.resource.subscribe.succeeded` | A client subscribed to a supported run resource. |
| `mcp.resource.unsubscribe.succeeded` | A client unsubscribed from a resource, or the subscription was already absent. |

## Correlating With DAG Events

MCP tools call the same internal API service used by the Web UI and REST API. When `dagu_change` applies a DAG update or `dagu_execute` starts, enqueues, retries, or stops a run, the downstream DAG audit event keeps the MCP source context.

Filter audit logs by:

- `category=mcp` to see MCP tool and subscription events
- `source=mcp` to see all activity originating from MCP, including downstream DAG events
- `surface=mcp` to see activity accepted through the MCP credential surface
- `mcp_tool=dagu_execute` or another tool name for tool-specific investigation
- `correlation_id` to connect an MCP attempt with the downstream effects of that attempt
