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
| `resource_type` | Affected resource class such as `dag`, `doc`, `run`, `run_logs`, `dag_run_step_log`, or `mcp_request`. Resource reads use `dag_spec`, `dag_run`, `dag_run_logs`, `reference`, or `mcp_app`, and `document` or `documents` for Wiki pages. |
| `resource_id` | Affected resource identifier, such as a DAG name, Wiki page path, `dagName/dagRunId`, or `dagName/dagRunId/stepName`. |
| `workspace` | Canonical workspace used for audit filtering. |
| `credential_id` | Accepted credential identifier, independent of the user or service-account subject. |
| `credential_type` | Credential class such as `api_key`, `session`, `basic`, `none`, or `cloud` for calls from Dagu Cloud. |
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

## Calls From Dagu Cloud

Calls that Dagu Cloud carries under [remote access](/overview/cloud-remote-access) use credential type `cloud` and transport `cloud_relay`. Their details record:

| Field | Meaning |
|-------|---------|
| `credential_id` | The connection the user made from an MCP client |
| `credential_name` | The MCP client's name |
| `subject_id` | `cloud:` followed by the Dagu Cloud user ID |
| `subject_name` | The user's email |
| `cloud_workspace` | The Dagu Cloud workspace the call came from |

On a server with audit logs, the **Remote access** section of **Plan & features** lists the latest of these calls.

## Request And Subscription Events

Authentication, resource reads, and subscriptions are also auditable:

| Action | Meaning |
|--------|---------|
| `mcp.request.denied` | The request reached the MCP route but authentication or surface authorization denied it. |
| `mcp.resource.read.received` | Dagu accepted an MCP `resources/read` request. |
| `mcp.resource.read.succeeded` | The resource was read. Details include `duration_ms` and `mime_type`. |
| `mcp.resource.read.failed` | Reading the resource failed. |
| `mcp.resource.read.denied` | Authorization denied the resource read. |
| `mcp.resource.subscribe.succeeded` | A client subscribed to a supported run resource. |
| `mcp.resource.unsubscribe.succeeded` | A client unsubscribed from a resource, or the subscription was already absent. |

## Correlating With DAG Events

MCP tools call the same internal API service used by the Web UI and REST API. When `dagu_change` applies a DAG or Wiki page update, or `dagu_execute` starts, enqueues, retries, or stops a run or decides a waiting step, the downstream domain audit event keeps the MCP source context. Wiki page mutations therefore produce both the MCP tool lifecycle events and the corresponding `doc_create`, `doc_update`, `doc_rename`, or `doc_delete` event without recording Markdown content.

Filter audit logs by:

- `category=mcp` to see MCP tool, resource read, and subscription events
- `source=mcp` to see all activity originating from MCP, including downstream DAG events
- `surface=mcp` to see activity accepted through the MCP credential surface
- `mcp_tool=dagu_execute` or another tool name for tool-specific investigation
- `credential_type=cloud` to see calls from Dagu Cloud
- `correlation_id` to connect an MCP attempt with the downstream effects of that attempt
