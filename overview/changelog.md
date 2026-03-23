# Changelog

## v2.3.4 (2026-03-23)

## Fixed

- fix(config): preserve implicit local timezone behavior ([#1831](https://github.com/dagu-org/dagu/pull/1831)) [@yottahmd](https://github.com/yottahmd)
- fix: initialize compacted session loop immediately ([#1832](https://github.com/dagu-org/dagu/pull/1832)) [@yottahmd](https://github.com/yottahmd)
- fix: reject unknown named DAG start parameters ([#1834](https://github.com/dagu-org/dagu/pull/1834)) [@yottahmd](https://github.com/yottahmd)

## v2.3.3 (2026-03-22)

### Added

- feat(jq): accept file input via config.input and file:// prefix ([#1821](https://github.com/dagu-org/dagu/pull/1821)) [@yottahmd](https://github.com/yottahmd)
- feat: allow variable references in repeat_policy numeric fields ([#1822](https://github.com/dagu-org/dagu/pull/1822)) [@yottahmd](https://github.com/yottahmd)
- feat(http): add format string config option for response output ([#1826](https://github.com/dagu-org/dagu/pull/1826)) [@mvanhorn](https://github.com/mvanhorn)

### Changed

- refactor: make scheduler proc-authoritative ([#1824](https://github.com/dagu-org/dagu/pull/1824)) [@yottahmd](https://github.com/yottahmd)

### Fixed

- fix(ui): standardize conditional swr query enabling ([#1816](https://github.com/dagu-org/dagu/pull/1816)) [@yottahmd](https://github.com/yottahmd)
- fix: prevent bot notification replay ([#1817](https://github.com/dagu-org/dagu/pull/1817)) [@yottahmd](https://github.com/yottahmd)
- fix(installer): remove --ignore-missing flag from sha256sum for BusyBox compatibility ([#1819](https://github.com/dagu-org/dagu/pull/1819)) [@yottahmd](https://github.com/yottahmd)
- fix: allow env: to reference params: values ([#1820](https://github.com/dagu-org/dagu/pull/1820)) [@yottahmd](https://github.com/yottahmd)
- fix(ui): enable live updates for Yesterday section in cockpit ([#1825](https://github.com/dagu-org/dagu/pull/1825)) [@yottahmd](https://github.com/yottahmd)
- fix: bound live UI reads and DAG run timeouts ([#1827](https://github.com/dagu-org/dagu/pull/1827)) [@yottahmd](https://github.com/yottahmd)
- fix: keep doc folders alphabetical under file sorting ([#1828](https://github.com/dagu-org/dagu/pull/1828)) [@yottahmd](https://github.com/yottahmd)
- fix: clean up failed command temp scripts ([#1829](https://github.com/dagu-org/dagu/pull/1829)) [@yottahmd](https://github.com/yottahmd)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| feat(http): add format string config option for response output ([#1826](https://github.com/dagu-org/dagu/pull/1826)) | [@mvanhorn](https://github.com/mvanhorn) |
| [BUG] ignore-missing parameter for sha256sum does not exist for QNAP NAS for installer.sh ([#1818](https://github.com/dagu-org/dagu/issues/1818)) | [@jeremydelattre59](https://github.com/jeremydelattre59) (report) |

**Full Changelog**: [v2.3.1...v2.3.3](https://github.com/dagu-org/dagu/compare/v2.3.1...v2.3.3)

## v2.3.1 (2026-03-19)

### Added

- Coordinator and Worker Health Endpoints: New `/healthz` endpoints for the coordinator and worker services, enabling native health checks in Kubernetes and other orchestrators. ([#1802](https://github.com/dagu-org/dagu/pull/1802))

### Changed

- Vault Environment Variable Renamed: The HashiCorp Vault environment variable has been renamed for consistency with the `DAGU_` prefix convention. ([#1801](https://github.com/dagu-org/dagu/pull/1801))
- Centralized Vault Config Defaults: Vault configuration defaults are now centralized, reducing duplication and improving maintainability. ([#1804](https://github.com/dagu-org/dagu/pull/1804))

### Fixed

- Retry Endpoint Blocking: The retry API endpoint now returns immediately without blocking until the DAG run completes. ([#1786](https://github.com/dagu-org/dagu/pull/1786))
- Scheduler Health Server Startup: The health server now starts before the scheduler acquires its lock, ensuring health checks pass during lock contention. ([#1789](https://github.com/dagu-org/dagu/pull/1789))
- Duplicate Workers Across Coordinators: Workers are now deduplicated across multiple coordinator instances in distributed mode, preventing ghost entries in the System Status page. ([#1791](https://github.com/dagu-org/dagu/pull/1791))
- Bot Session Continuity: Hardened Slack and Telegram bot session management for improved continuity and responsiveness. ([#1793](https://github.com/dagu-org/dagu/pull/1793))
- Retry Scanner Scope: Narrowed the retry scanner's DAG-run scan scope to reduce unnecessary I/O. ([#1794](https://github.com/dagu-org/dagu/pull/1794))
- Cancel Failed Auto-Retry DAG Runs: Failed DAG runs with auto-retry enabled can now be properly canceled. ([#1795](https://github.com/dagu-org/dagu/pull/1795))
- Parallel Scheduling During Sub-DAG Retries: Fixed a deadlock where sub-DAG retries blocked parallel scheduling of other DAGs. ([#1796](https://github.com/dagu-org/dagu/pull/1796))
- Parallel Sub-DAG Item Targets: Resolved variable expansion for `parallel` item targets in sub-DAG paths and hardened cancellation handling. ([#1797](https://github.com/dagu-org/dagu/pull/1797))
- Bot Notifications Consolidation: Consolidated and hardened bot notification delivery to prevent duplicate or dropped messages. ([#1798](https://github.com/dagu-org/dagu/pull/1798))
- SSE Topics and Dev Asset Versioning: Hardened SSE topic routing and fixed dev asset cache-busting. ([#1799](https://github.com/dagu-org/dagu/pull/1799))
- Agent Approval Prompts: Fixed agent approval prompts being prematurely dismissed during long-running approval waits. ([#1800](https://github.com/dagu-org/dagu/pull/1800))
- DAG File Traversal via Encoded Slashes: Rejected encoded slashes in DAG file paths to prevent path traversal attacks. ([#1803](https://github.com/dagu-org/dagu/pull/1803))

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Retry endpoint non-blocking fix ([#1786](https://github.com/dagu-org/dagu/pull/1786)) | [@mvanhorn](https://github.com/mvanhorn) |
| Vault environment variable rename ([#1801](https://github.com/dagu-org/dagu/pull/1801)) | [@dohq](https://github.com/dohq) |
| Retry endpoint blocking bug report ([#608](https://github.com/dagu-org/dagu/issues/608)) | [@kamandir](https://github.com/kamandir) (report) |
| Scheduler health check misbehavior in multi-instance deployments ([#1156](https://github.com/dagu-org/dagu/issues/1156)) | [@jonasban](https://github.com/jonasban) (report) |
| Incorrect System Status in distributed mode ([#1787](https://github.com/dagu-org/dagu/issues/1787)), coordinator/worker health endpoint request ([#1788](https://github.com/dagu-org/dagu/issues/1788)) | [@jonasban](https://github.com/jonasban) (report) |
| Task with retry stays in running state, blocking scheduling ([#1792](https://github.com/dagu-org/dagu/issues/1792)) | [@mtaohuang](https://github.com/mtaohuang) (report) |
| Variables not resolved in sub-DAG paths with `parallel` ([#1790](https://github.com/dagu-org/dagu/issues/1790)) | [@VKdennis](https://github.com/VKdennis) (report) |

**Full Changelog**: [v2.3.0...v2.3.1](https://github.com/dagu-org/dagu/compare/v2.3.0...v2.3.1)

## v2.3.0 (2026-03-16)

### Added

- HashiCorp Vault Integration: Secrets can now be sourced from HashiCorp Vault. Supports KV v1 and v2 secret engines with token and AppRole authentication. Vault secrets are referenced in DAG YAML via `secrets:` block and resolved at runtime. ([#1757](https://github.com/dagu-org/dagu/pull/1757))
- Slack Bot for AI Agent Interaction: Interact with the Dagu AI agent directly from Slack. Send messages in configured channels to create, debug, and manage DAG workflows through conversational chat. ([#1785](https://github.com/dagu-org/dagu/pull/1785))
- Telegram Bot for AI Agent Interaction: Interact with the Dagu AI agent via Telegram. Supports the same conversational workflow management as the Slack bot. ([#1783](https://github.com/dagu-org/dagu/pull/1783))
- Rich DAG Params with Typed Run Modal: DAG parameters now support a rich schema with `type`, `default`, `options`, and `description` fields. The Start/Enqueue modals render typed inputs (text, number, select, checkbox, textarea) based on the parameter definitions. ([#1770](https://github.com/dagu-org/dagu/pull/1770))
- `params[].eval` for DAG Param Defaults: Parameters can define an `eval` field containing a shell expression evaluated at runtime to compute the default value (e.g., `eval: "date +%Y-%m-%d"`). ([#1775](https://github.com/dagu-org/dagu/pull/1775))
- DAG-Level Retry Policy: New top-level `retryPolicy` field enables automatic retry of entire DAG runs on failure, with configurable `limit` and `intervalSec`. Auto-retry metadata is surfaced in the DAG run list. ([#1774](https://github.com/dagu-org/dagu/pull/1774), [#1779](https://github.com/dagu-org/dagu/pull/1779))
- Z.AI (GLM Models) as LLM Provider: Added Z.AI as a supported LLM provider for the AI agent and chat steps. ([#1780](https://github.com/dagu-org/dagu/pull/1780))
- Auto-Provision Initial Admin User: The initial admin user can now be provisioned via config (`auth.builtin.initial_admin`) or environment variables, enabling headless deployment without the `/setup` page. ([#1765](https://github.com/dagu-org/dagu/pull/1765))
- Schedule Time Propagation: The original scheduled time is now preserved and propagated through the DAG run lifecycle, including retries and sub-DAG invocations. ([#1763](https://github.com/dagu-org/dagu/pull/1763))
- Catchup Runs via Enqueue Path: Catchup (missed schedule) runs are now routed through the enqueue path with deterministic IDs, ensuring consistent behavior with regular scheduled runs. ([#1772](https://github.com/dagu-org/dagu/pull/1772))
- Server-Side Sorting for Doc Tree Sidebar: The doc tree sidebar now supports server-side sorting for improved performance with large doc collections. ([#1759](https://github.com/dagu-org/dagu/pull/1759))
- Multi-Select, Batch Delete & Keyboard Shortcuts for Doc Tree: Select multiple documents with Shift/Ctrl+click or keyboard shortcuts and delete them in bulk. ([#1756](https://github.com/dagu-org/dagu/pull/1756))
- Helm Chart Repository: Official Helm chart published for Kubernetes deployment.
- Discard Changes Button: Spec and doc editors now include a discard changes button to revert unsaved edits.
- Mobile-Responsive Cockpit Layout: The cockpit kanban board uses a tabbed layout on mobile devices.
- Doc Outline Panel State Persistence: The doc outline panel collapsed/expanded state is persisted in localStorage.

### Changed

- Step Name Limit Relaxed to 255 Characters: The maximum step name length has been increased from 40 to 255 characters. ([#1753](https://github.com/dagu-org/dagu/pull/1753))
- Abort Handler Renamed to `onAbort`: The abort handler contract has been renamed from `onExit` semantics to the explicit `onAbort` name for clarity. ([#1764](https://github.com/dagu-org/dagu/pull/1764))
- DAG Params Treated as Literal Values: DAG parameters are now treated as literal values by default — OS environment variable expansion in params has been removed to prevent unintended substitution. ([#1767](https://github.com/dagu-org/dagu/pull/1767))

### Fixed

- JQ Step Large Number Output: Fixed raw output mode producing scientific notation for large numbers in the jq step. ([#1754](https://github.com/dagu-org/dagu/pull/1754))
- `onAbort` Label in Lifecycle Hooks: The lifecycle hooks UI now correctly displays the `onAbort` label instead of the old name. ([#1760](https://github.com/dagu-org/dagu/pull/1760))
- YAML Spec Workspace Tag on Enqueue: YAML spec is now saved with the workspace tag at enqueue time from the cockpit page. ([#1758](https://github.com/dagu-org/dagu/pull/1758))
- Shared Storage Paths in Kubernetes: Aligned shared storage paths in the Helm chart for correct volume mounting. ([#1766](https://github.com/dagu-org/dagu/pull/1766))
- SSE Connection Stability: Stabilized multiplexed SSE connection management to prevent dropped events and reconnection storms. ([#1768](https://github.com/dagu-org/dagu/pull/1768))
- Queue Startup Lookup Churn: Reduced unnecessary DAG lookups during queue startup in the scheduler. ([#1769](https://github.com/dagu-org/dagu/pull/1769))
- AI Installer and Skills Dirs: Hardened the AI installer and added support for explicit skills directories. ([#1771](https://github.com/dagu-org/dagu/pull/1771))
- False Positive Zombie Detector Kills: Eliminated false positive kills by the zombie detector when DAG runs are slow but still active. ([#1773](https://github.com/dagu-org/dagu/pull/1773))
- Terminal WebSocket Bridge Lifecycle: Hardened the terminal WebSocket bridge lifecycle to prevent orphaned connections. ([#1777](https://github.com/dagu-org/dagu/pull/1777))
- Container Env Variable Resolution: DAG `env` and `params` references are now correctly resolved in container environment variables. ([#1778](https://github.com/dagu-org/dagu/pull/1778))
- Agent Chat SSE Transport: Hardened the agent chat SSE transport for improved reliability. ([#1781](https://github.com/dagu-org/dagu/pull/1781))
- Graceful Shutdown: Improved graceful shutdown handling for both the HTTP server and scheduler to prevent in-flight request loss. ([#1782](https://github.com/dagu-org/dagu/pull/1782))
- First Chat Message Visibility: The first chat message in new agent sessions is now displayed immediately.
- Auto-Retry Badge Display: The auto-retry badge is now only shown when the DAG run status is `failed`.
- Sidebar Default State: The sidebar is now expanded by default for better discoverability.
- Docker Version Suffix: Removed git hash suffix from the embedded version string in Docker builds.
- DAG Details Side Panels: Hardened DAG details side panels for consistent rendering.
- Mermaid Error Element Cleanup: Removed mermaid error elements leaked into the document body.
- Cockpit UI Polish: Fixed template selector tag list clipping, cockpit modal theming, and dev server proxy connection exhaustion.

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Relax step name limit to 255 characters ([#1753](https://github.com/dagu-org/dagu/pull/1753)), fix onAbort label in lifecycle hooks UI ([#1760](https://github.com/dagu-org/dagu/pull/1760)) | [@SergioChan](https://github.com/SergioChan) |
| Fix raw output mode for large numbers in jq step ([#1754](https://github.com/dagu-org/dagu/pull/1754)) | [@tushar5526](https://github.com/tushar5526) |
| HashiCorp Vault integration ([#1757](https://github.com/dagu-org/dagu/pull/1757)) | [@dohq](https://github.com/dohq) |
| Step name 40-character limit issue report ([#1189](https://github.com/dagu-org/dagu/issues/1189)) | [@jonathonc](https://github.com/jonathonc) (report) |
| JQ step scientific notation output bug report ([#1648](https://github.com/dagu-org/dagu/issues/1648)) | [@insanity54](https://github.com/insanity54) (report) |
| Handler On Abort display bug report ([#1476](https://github.com/dagu-org/dagu/issues/1476)) | [@jeremydelattre59](https://github.com/jeremydelattre59) (report) |
| Container env variable resolution bug report ([#1776](https://github.com/dagu-org/dagu/issues/1776)) | [@Popo8701](https://github.com/Popo8701) (report) |
| Dynamic parameter in UI feature request ([#1761](https://github.com/dagu-org/dagu/issues/1761)) | [@YLombardi](https://github.com/YLombardi) (request) |
| High memory usage report related to queue improvements ([#546](https://github.com/dagu-org/dagu/issues/546)) | [@helmut72](https://github.com/helmut72) (report) |

**Full Changelog**: [v2.2.4...v2.3.0](https://github.com/dagu-org/dagu/compare/v2.2.4...v2.3.0)

## v2.2.4 (2026-03-11)

### Added

- `dagu ai install` Command: New command to install Dagu as an AI coding tool skill (e.g., for Claude Code, Codex). Automatically sets up skill configuration for supported tools. ([#1750](https://github.com/dagu-org/dagu/pull/1750))
- Built-in AI Agent References: The AI agent now ships with built-in reference documents (schema, executors, CLI, env vars, coding agents) that are seeded to the data directory and available in the agent prompt. ([#1751](https://github.com/dagu-org/dagu/pull/1751))

### Fixed

- SSE Endpoint Authentication: Basic auth credentials are now required for SSE (Server-Sent Events) endpoints, closing an unauthenticated access path. ([#1752](https://github.com/dagu-org/dagu/pull/1752))
- Mermaid Dark Mode: Fixed mermaid diagram rendering in dark mode and improved code block text visibility in docs preview.

## v2.2.0 (2026-03-08)

### Added

- Generic Approval Field for Human-in-the-Loop: Any step type now supports a top-level `approval` field for human-in-the-loop workflows. The dedicated `hitl` executor has been removed — use `approval: true` (or `approval: "custom message"`) on any step instead. Steps with approval enabled pause execution and wait for manual approval before running. ([#1743](https://github.com/dagu-org/dagu/pull/1743))
- `DAG_RUN_WORK_DIR` Special Environment Variable: New built-in variable exposing the working directory for the current DAG run attempt. Available in all step types and automatically set by the runtime. ([#1735](https://github.com/dagu-org/dagu/pull/1735))
- `DAG_DOCS_DIR` and `DAG_PARAMS_JSON` Special Environment Variables: `DAG_DOCS_DIR` provides the path to the docs directory. `DAG_PARAMS_JSON` provides all DAG parameters as a JSON object. ([#1731](https://github.com/dagu-org/dagu/pull/1731))
- Tags Parameter for Start and Enqueue APIs: The start and enqueue API endpoints now accept a `tags` parameter for tagging DAG runs at creation time. ([#1730](https://github.com/dagu-org/dagu/pull/1730))
- Auto-Create Default `base.yaml` on First Run: A default `base.yaml` with comprehensive field reference comments is automatically generated when the base config file does not exist. ([#1737](https://github.com/dagu-org/dagu/pull/1737))
- Script Error Line Annotation: When a shell script step fails, the error message now includes the content of the failing line, making it easier to diagnose script errors. Empty scripts are preserved on failure for debugging. ([#1733](https://github.com/dagu-org/dagu/pull/1733))
- Multiline Parameter Input: The Start and Enqueue modals now support multiline text input for parameters using a textarea. ([#1742](https://github.com/dagu-org/dagu/pull/1742))
- Copy File Path Button in Doc Editor: A button in the doc editor header lets you copy the file path to clipboard. ([#1741](https://github.com/dagu-org/dagu/pull/1741))
- Batch Delete for Git-Sync Items: Multiple git-sync items can now be selected and deleted in bulk. ([#1736](https://github.com/dagu-org/dagu/pull/1736))
- Cockpit Review Column: The cockpit kanban board now includes a "Review" column for DAG runs in waiting/approval status. The cockpit is now the default landing page.
- Cockpit Toolbar on Docs Page: The CockpitToolbar is available on the Docs page for quick access to DAG preview and start actions.
- Agent DAG Authoring Guidance: The agent system prompt now includes DAG authoring guidance for better workflow generation.

### Changed

- Default Page Changed to Cockpit: The default landing page is now the Cockpit instead of the Dashboard.
- Cockpit Nav Item Always Visible: The Cockpit navigation item is shown unconditionally.
- Git Sync Nav Reorder: The Git Sync nav item has been moved to the end of the Workflows section.
- Agent Settings Always Visible: The Agent Settings nav item is always shown so the agent can be re-enabled after being disabled.

### Fixed

- Base Config Propagation in Distributed Mode: Base configuration is now correctly propagated to workers in distributed mode. ([#1745](https://github.com/dagu-org/dagu/pull/1745))
- Step ID Hyphen Validation: Step IDs containing hyphens are now rejected to avoid shell variable expansion conflicts. ([#1738](https://github.com/dagu-org/dagu/pull/1738))
- Zombie Detector Status Overwrite: The zombie detector now reads the full status from the attempt before overwriting, preventing data loss. ([#1734](https://github.com/dagu-org/dagu/pull/1734))
- Parameter Space-Splitting on Restore: Parameter values are now properly quoted when restoring a DAG from status, preventing space-splitting issues. ([#1732](https://github.com/dagu-org/dagu/pull/1732))
- Graph Node Label for Auto-Generated Names: Step ID is now displayed as the graph node label when the step name is auto-generated.
- Git-Sync Forget Dialog Overflow: Long filenames no longer overflow the git-sync forget dialog.
- Cockpit Preview Modal: Fixed tab switching, modal staying open after starting a DAG, and showing the specific enqueued run instead of the global latest.
- Agent Chat Modal Resize: Fixed corner resize handles to resize both width and height, added proper z-index to resize handles, and increased hit targets for resize handles.
- NavGroup Collapse: NavGroups can now be collapsed even when a child route is active.
- Agent Orphaned Tool Calls: Orphaned tool calls are now repaired across the entire LLM history.
- Agent `web_search` on Haiku Models: Added `allowed_callers` for `web_search` tool on Haiku models.

## v2.1.0 (2026-03-06)

### Added

- Cockpit Workspace Kanban View: New cockpit page with workspace-based kanban board for visualizing DAG runs by date. Includes workspace selector with "All workspaces" default, localStorage persistence for selected workspace, and server-timezone-aware date handling. ([#1728](https://github.com/dagu-org/dagu/pull/1728))
- File-Based Index for DAG and DAG Run Stores: New indexing layer for DAG and DAG run file stores, improving lookup performance. ([#1729](https://github.com/dagu-org/dagu/pull/1729))
- `DAGU_DOCS_DIR` Environment Variable: Docs directory is now independently configurable via `DAGU_DOCS_DIR` env var or `paths.docs_dir` in config YAML (default: `{dags_dir}/docs`). Previously the docs directory was always derived from `DAGsDir`.
- Document Management in Tabs/Editor: Per-tab dropdown menu with Close, Close Others, Close All, and Delete Document actions. Trash icon in editor header bar. Confirmation modals for bulk close when unsaved changes exist.

### Changed

- Navigation Reorder: Cockpit now appears before Dashboard in navigation. Docs moved to Overview section. Base Config moved to Workflows section.
- UI Light Mode Colors: Light mode colors aligned with the docs warm sepia palette.

### Fixed

- Cockpit Kanban Timezone: Fixed browser/server timezone mismatch in kanban date generation and API bounds by using server timezone consistently.
- Cockpit "All Workspaces": Made the "All workspaces" option functional and set as default on load.
- Cockpit Kanban Status Mapping: Waiting status now correctly maps to the Running column.

## v2.0.0 (2026-02-28)

### Changed

- OS Environment Variable Expansion: OS environment variables (e.g., `$HOME`, `$PATH`) are no longer expanded by Dagu for non-shell executor types (docker, http, ssh, jq, mail, s3, redis, etc.) **and DAG-level configuration fields** (`ssh`, `smtp`, `s3`, `registry_auths`). Only variables explicitly defined in the DAG scope (`env:`, `params:`, `secrets:`, step outputs) are expanded. OS variables pass through unchanged, letting the target environment (container, remote shell, etc.) resolve them. Shell command execution is unaffected. See [RFC 007](https://github.com/dagu-org/dagu/blob/main/rfcs/implemented/007-os-env-expansion-rules.md).
  To use a local OS variable in a config field, explicitly import it via the `env:` block:

  ```yaml
  env:
    - HOME_DIR: ${HOME}  # Import OS $HOME into DAG scope

  ssh:
    user: deploy
    host: app.example.com
    key: ${HOME_DIR}/.ssh/deploy_key  # Expanded — HOME_DIR is DAG-scoped
  ```

- Auth by Default: The default authentication mode changed from `none` to `builtin`. New installations require creating an admin account via the `/setup` page on first visit. The JWT token secret is auto-generated and persisted to `{dataDir}/auth/token_secret` if not explicitly configured. See [RFC 018](https://github.com/dagu-org/dagu/blob/main/rfcs/draft/018-auth-by-default.md).
- DAG Type Validation: DAGs with `type: chain` (the default) no longer allow the `depends` field on steps. Chain execution runs steps sequentially in definition order, making explicit dependencies redundant. To use the `depends` field for custom execution order, set `type: graph` explicitly. This change prevents confusion between chain's implicit sequential ordering and graph's explicit dependency-based execution.

### Removed

- Legacy API: The old legacy API has been completely removed from the codebase. The current API (`/api/v1/*`) is the sole API and requires authentication when auth is enabled.
- Static API Token (`auth.token`): The `auth.token.value` configuration field and `DAGU_AUTH_TOKEN` environment variable have been removed. Use API keys (builtin auth mode) or basic auth instead. API keys provide role-based access control and usage tracking. See [API Keys](/server-admin/authentication/api-keys) for migration.
- Basic Auth Flat Fields: The top-level `is_basic_auth`, `basic_auth_username`, and `basic_auth_password` configuration fields have been removed. Use `auth.mode: basic` with `auth.basic.username` and `auth.basic.password` instead. The legacy `DAGU_BASICAUTH_*` environment variables have also been removed; use `DAGU_AUTH_MODE=basic`, `DAGU_AUTH_BASIC_USERNAME`, and `DAGU_AUTH_BASIC_PASSWORD`.
- Standalone OIDC Mode (`auth.mode: oidc`): Removed. The valid auth modes are now `none`, `basic`, and `builtin`. Use builtin + OIDC mode for SSO with user management and RBAC. See [Builtin Authentication - OIDC/SSO](/server-admin/authentication/builtin#oidcsso-login).
- Admin Config (`auth.builtin.admin`): The `auth.builtin.admin.username` / `auth.builtin.admin.password` config fields and `DAGU_AUTH_ADMIN_USERNAME` / `DAGU_AUTH_ADMIN_PASSWORD` environment variables have been removed. The first admin account is now created via the `/setup` page on first browser visit, or via `auth.builtin.initial_admin` configuration for headless deployments. See [Builtin Authentication - Initial Setup](/server-admin/authentication/builtin#initial-setup).
- Basic Auth `enabled` Field: The `auth.basic.enabled` field and `DAGU_AUTH_BASIC_ENABLED` environment variable have been removed. Basic auth is activated by setting `auth.mode: basic`.
- Deprecated YAML Fields: The following deprecated fields have been removed from the YAML spec. Migrate to the replacement fields:

  | Removed Field | Replacement | Context |
  |---------------|-------------|---------|
  | `run` | `call` | Step field for sub-DAG execution |
  | `dir` | `working_dir` | Step field for working directory |
  | `executor` | `type` + `config` | Step field for executor configuration |
  | `precondition` (singular) | `preconditions` (array) | Both DAG-level and step-level |
  | `container.workDir` | `container.working_dir` | Container working directory |

### Added

- Access Log Configuration: New `access_log_mode` setting controls HTTP request logging. Values: `"all"` (default — log all requests), `"non-public"` (skip public/static asset paths), or `"none"` (disable access logging). Environment variable: `DAGU_ACCESS_LOG_MODE`. See [Server Configuration](/server-admin/server#access-log).
- Auth Mode Selection: Authentication mode is now configured via `auth.mode` field. Valid modes: `none`, `basic`, `builtin` (default). Basic auth uses `auth.mode: basic` with `auth.basic.username` and `auth.basic.password`. Environment variable: `DAGU_AUTH_MODE`.
- Coordinator Enabled Config: New `coordinator.enabled` config option (default: `true`) and `DAGU_COORDINATOR_ENABLED` environment variable to explicitly enable or disable the coordinator service. When disabled, `start-all` skips the coordinator and DAGs are never dispatched to workers. Accepts `true`/`false`/`1`/`0`.
- Self-Upgrade Command: New `dagu upgrade` command for in-place binary updates with SHA256 verification, backup support, and cross-platform compatibility. See [Self-Upgrade](/server-admin/self-upgrade) for details.
- Literal Dollar Escape for Non-Shell Executors: Use `\$` to emit a literal `$` in non-shell contexts (docker, http, ssh, jq, mail, etc.) and config fields. Shell-executed commands preserve native semantics. To emit a literal `$$` in non-shell contexts, escape both dollars: `\$\$`.
- Router Examples in Documentation: Added two router examples to the [Examples](/writing-workflows/examples) page under "Control Flow & Conditions": routing based on environment variable values and routing based on step output. Removed the "Complex Preconditions" example to streamline the page.
- Unified Execution Dispatch (`defaultExecutionMode`): New server-level `defaultExecutionMode` setting controls whether DAGs run locally or are dispatched to workers. When set to `distributed`, all DAGs are automatically dispatched to the coordinator for worker execution, even without an explicit `worker_selector`. A centralized `ShouldDispatchToCoordinator` function ensures consistent dispatch logic across all execution paths (API, CLI, scheduler, sub-DAG). DAGs that must remain on the main instance can use `worker_selector: local` to override this behavior. See [Distributed Execution](/server-admin/distributed/) and [Worker Labels](/server-admin/distributed/worker-labels) for details.
- Agent: AI assistant integrated into the Web UI for workflow management. The agent helps create, review, debug, and manage DAG workflows through an interactive chat interface. Supports multiple LLM providers (Anthropic, OpenAI, Google, OpenRouter, local models). Features include shell command execution with approval for dangerous operations, file reading/editing, DAG schema lookup, UI navigation, and web search. See [Agent](/features/agent/) for details.
- Agent Delegate Tool: New `delegate` tool for the agent that spawns up to 8 parallel sub-agents for independent sub-tasks. Each sub-agent runs in its own session with the same tools (minus `delegate` to prevent recursion) and returns a summary to the parent. Sub-agent messages stream through the parent SSE connection. Available in interactive chat only (not in DAG agent steps). See [Tools Reference](/features/agent/tools#delegate).
- Trigger Type Visibility: DAG runs now display how they were initiated (scheduler, manual, webhook, subdag, retry). The trigger type is shown in the DAG runs list and detail views with distinct icons and labels. Available via the `triggerType` field in the API response.
- CLI History Command: New `dagu history` command displays execution history for DAG runs with comprehensive filtering (by date, status, tags, run ID), pagination (limit support up to 1000 results), and multiple output formats (table, JSON, CSV). Essential for debugging patterns, monitoring workflows, and exporting run data. Features:
  - Date filtering: absolute (`--from`/`--to`) or relative (`--last 7d`, `24h`, `1w`)
  - Status filtering: all execution states with aliases (e.g., `success` → `succeeded`)
  - Tag filtering: comma-separated with AND logic
  - Run ID search: partial matching support
  - Default: last 30 days, 100 results, table format
  - **Run IDs never truncated** for reliable copy-paste
  - See [CLI Reference](/getting-started/cli#history) for full documentation.
- LLM Model Fallback: `model` field accepts array of model objects. First is primary, rest are fallbacks tried in order on any error. Per-model overrides for `temperature`, `max_tokens`, `top_p`, `base_url`, `api_key_name`. See [Model Fallback](/features/chat/basics#model-fallback).
- Container Shell Wrapper: New `shell` field wraps step commands with a shell interpreter, enabling pipes, redirects, and command chaining without manual wrapping. Available in both image and exec modes.

  ```yaml
  container:
    image: alpine:latest
    shell: ["/bin/sh", "-c"]

  steps:
    - command: cat file.txt | grep error | wc -l
    - command: npm install && npm test
  ```

  Format: array where first element is the shell path, remaining elements are flags, and the step command is appended as the final argument. See [Container Field](/writing-workflows/container#shell-wrapper) for details.

- Step Defaults (`defaults`): New DAG-level `defaults` field that defines default values inherited by every step and `handler_on` step. Supports 8 fields: `retry_policy`, `continue_on`, `repeat_policy`, `timeout_sec`, `mail_on_error`, `signal_on_stop`, `env`, `preconditions`. Override fields are applied only when a step does not define its own value. Additive fields (`env`, `preconditions`) prepend default entries before the step's own entries. Unknown keys cause a validation error.

  ```yaml
  defaults:
    retry_policy:
      limit: 3
      interval_sec: 5
    env:
      - LOG_LEVEL: info

  steps:
    - id: fetch_data
      command: curl https://api.example.com/data
      # Inherits retry_policy and LOG_LEVEL from defaults

    - id: custom_step
      command: ./run.sh
      retry_policy:
        limit: 1
        interval_sec: 0
      # Overrides retry_policy; still gets LOG_LEVEL from defaults
  ```

  See [Step Defaults](/writing-workflows/step-defaults) for full documentation.

- Major UI Redesign: Complete redesign of the user interface with improved dark mode support, modernized color palette, and streamlined navigation. Enhanced visual hierarchy across all pages including DAG lists, execution views, system status, and admin pages.
- LLM Secret Masking: Secrets defined in the `secrets` block are now automatically masked before being sent to LLM providers in chat steps. This prevents accidental exposure of sensitive values to external AI APIs while still allowing secrets to be used in message content via `${VAR}` substitution.
- LLM Tool Calling: Chat executor now supports function calling / tool use, enabling AI agents to execute workflows as tools during sessions. Tools are defined as DAGs with automatic parameter discovery from `defaultParams`.

  ```yaml
  # Main DAG that uses the tool
  steps:
    - type: chat
      llm:
        provider: anthropic
        model: claude-sonnet-4-20250514
        tools:
          - search_tool
        max_tool_iterations: 10
      messages:
        - role: user
          content: "What's the latest news about AI?"

  ---
  # Define tool DAG
  name: search_tool
  description: "Search the web for information"
  defaultParams: "query max_results=10"

  steps:
    - command: echo "Searching for: $1"
    - command: curl "https://api.example.com/search?q=$1&limit=$2"
      output: SEARCH_RESULT
  ```

  **Key Features:**
  - DAG-as-Tool: Any DAG can be a tool - parameters auto-discovered from `defaultParams`
  - Multi-turn Execution: Automatic loop: LLM → Tool Calls → Execute DAGs → Results → LLM (up to `max_tool_iterations`)
  - Local Tool Discovery: Tools searched in local DAGs (using `---` separator) first, then database
  - UI Drill-down: Tool executions tracked as sub-DAG runs with full execution details
  - Tool Definitions Display: UI shows available tools and their parameters
  - Provider Support: Anthropic, OpenAI, and Gemini with provider-specific API mappings
  - Parameter Passing: Tool arguments converted to DAG parameters (KEY=value format)
  - Output Handling: Tool results from DAG outputs passed back to LLM as tool results
  - Error Handling: Tool execution failures passed to LLM as error messages

  **Configuration:**
  - `llm.tools`: Array of DAG names to make available as tools
  - `llm.max_tool_iterations`: Max tool calling loops (default: 10)
  - Tool DAG `name`: Used as function name for LLM
  - Tool DAG `description`: Shown to LLM in tool definition
  - Tool DAG `defaultParams`: Parsed to generate JSON Schema for parameters

  See [Chat - Tool Calling](/features/chat/tool-calling) for full documentation.

- Tailscale Tunnel: Built-in remote access via embedded Tailscale node. Access Dagu from anywhere without port forwarding or VPN setup.

  ```bash
  dagu server --tunnel
  ```

  **Modes:**
  - `--tunnel` - HTTP on tailnet (WireGuard encrypted, no setup)
  - `--tunnel --tunnel-https` - HTTPS on tailnet (requires HTTPS enabled in Tailscale admin)
  - `--tunnel --tunnel-funnel` - Public internet access (requires Funnel enabled in Tailscale admin)

  First run shows login URL. Subsequent runs auto-connect using saved state. See [Tunnel Configuration](/server-admin/tunnel).

- System Status Page: New admin-only page consolidating system health monitoring in one place.

  **Features:**
  - Scheduler service status with all instances
  - Coordinator service status with all instances
  - Worker status with health, pollers, and running tasks
  - Resource usage charts (CPU, Memory, Disk, Load)

  **Dashboard Cleanup:** Removed Workers Summary and System Resources sections from the main dashboard to reduce clutter. These are now available in the dedicated System Status page.

  Access via the navigation menu under "Overview" (admin users only).

- OIDC Integration for Builtin Auth (Recommended): Added OIDC/SSO login capability under builtin authentication mode. This is now the recommended way to use OIDC with Dagu, as it combines SSO convenience with full user management and RBAC.

  ```yaml
  auth:
    mode: builtin
    builtin:
      token:
        secret: your-jwt-secret  # auto-generated if not set
    oidc:
      client_id: your-client-id
      client_secret: your-client-secret
      client_url: https://dagu.example.com
      issuer: https://accounts.google.com
      auto_signup: true
      default_role: viewer
  ```

  Key features: auto-signup on first login, role mapping from IdP groups, email domain filtering, email whitelist, customizable login button. See [Builtin Authentication](/server-admin/authentication/builtin#oidcsso-login) for details.
- Synchronous Execution API: New endpoint `POST /api/v1/dags/{fileName}/start-sync` that executes a DAG and waits for completion before returning. Returns full execution details including all node statuses. Useful for automation scripts, CI/CD pipelines, and any scenario where you need to wait for a DAG to finish.

  ```bash
  curl -X POST "http://localhost:8080/api/v1/dags/my-dag/start-sync" \
    -H "Content-Type: application/json" \
    -d '{"timeout": 300, "params": "{}"}'
  ```

  **Key Features:**
  - Required `timeout` parameter (1-86400 seconds) prevents indefinite waits
  - Returns full `DAGRunDetails` with all node statuses on completion
  - Returns HTTP 408 on timeout with error details
  - Returns immediately when DAG reaches "waiting" status (human approval needed)
  - Supports all existing options: `params`, `dagRunId`, `dagName`, `singleton`

  See [REST API Reference](/web-ui/api#start-dag-synchronous) for full documentation.

- SFTP Executor: New step type for transferring files between local and remote servers via SFTP. Supports upload and download of files and directories, with atomic uploads using temporary files to prevent partial transfers.

  ```yaml
  ssh:
    user: deploy
    host: server.example.com

  steps:
    - id: upload_config
      type: sftp
      config:
        direction: upload
        source: /local/config.yaml
        destination: /remote/config.yaml
  ```

  See [SFTP](/step-types/sftp) for full documentation.

- SSH Bastion Host Support: SSH executor now supports connecting through a jump/bastion host for accessing servers in private networks.

  ```yaml
  ssh:
    user: deploy
    host: private-server.internal
    bastion:
      host: bastion.example.com
      user: jump-user
      key: ~/.ssh/bastion_key
  ```

  See [SSH - Bastion Host](/step-types/ssh#bastion-host) for full documentation.

- SSH Connection Timeout: Added `timeout` field to SSH configuration (default: 30s) for controlling connection timeouts.

- S3 Executor: New step type for S3 operations with support for AWS S3 and S3-compatible services (MinIO, Google Cloud Storage, DigitalOcean Spaces, Backblaze B2).

  ```yaml
  s3:
    region: us-east-1
    access_key_id: ${AWS_ACCESS_KEY_ID}
    secret_access_key: ${AWS_SECRET_ACCESS_KEY}
    bucket: my-bucket

  steps:
    - id: upload_report
      type: s3
      config:
        key: reports/daily.csv
        source: /tmp/report.csv
      command: upload
  ```

  **Key Features:**
  - Operations: upload, download, list, delete
  - DAG-level connection defaults (steps inherit settings)
  - S3-compatible services via custom endpoint
  - Automatic multipart uploads for large files
  - Storage class selection
  - Object tagging and metadata
  - Streaming list output (JSONL format)

  See [S3](/step-types/s3) for full documentation.

- SQL Executor: New step types for database operations with PostgreSQL and SQLite support. Execute queries, import data from CSV/TSV/JSONL, and export results in multiple formats.

  ```yaml
  steps:
    - id: query_users
      type: postgres
      config:
        dsn: "postgres://user:pass@localhost:5432/mydb"
      command: "SELECT * FROM users WHERE active = true"
      output: USERS
  ```

  **Key Features:**
  - PostgreSQL and SQLite drivers
  - Parameterized queries for SQL injection prevention
  - Transaction support with isolation levels
  - Data import from CSV, TSV, JSONL files
  - Output formats: JSONL, JSON, CSV
  - Advisory locks (PostgreSQL) and file locks (SQLite)
  - Global connection pooling for workers (prevents connection exhaustion)

  See [ETL](/step-types/sql/) for full documentation.

- Redis Executor: New step type for Redis operations with support for all major Redis commands, pipelines, transactions, Lua scripts, and distributed locking.

  ```yaml
  redis:
    host: localhost
    port: 6379
    password: ${REDIS_PASSWORD}

  steps:
    - id: cache_lookup
      type: redis
      config:
        command: GET
        key: user:${USER_ID}
      output: CACHED_USER
  ```

  **Key Features:**
  - All major Redis data types (strings, hashes, lists, sets, sorted sets, streams)
  - DAG-level connection defaults (steps inherit connection settings)
  - Pipeline and transaction support (MULTI/EXEC)
  - Lua script execution with EVALSHA optimization
  - Distributed locking for coordination
  - Connection modes: Standalone, Sentinel, Cluster
  - TLS support with certificate configuration
  - Global connection pooling for workers
  - Output formats: JSON, JSONL, raw, CSV

  See [Redis](/step-types/redis) for full documentation.

- PostgreSQL Connection Pool Management for Workers: Added global PostgreSQL connection pool configuration at the worker level to prevent connection exhaustion when multiple DAGs run concurrently in shared-nothing mode.

  ```yaml
  worker:
    postgres_pool:
      max_open_conns: 25       # Total connections across ALL PostgreSQL DSNs
      max_idle_conns: 5        # Idle connections per DSN
      conn_max_lifetime: 300   # Connection lifetime in seconds
      conn_max_idle_time: 60    # Idle connection timeout in seconds
  ```

  **Key Features:**
  - Automatically enabled in shared-nothing mode (when `worker.coordinators` is configured)
  - Shared across all PostgreSQL databases accessed by the worker
  - Prevents connection exhaustion with many concurrent DAGs
  - Only applies to PostgreSQL (SQLite unaffected)

  See [Shared Nothing Mode - PostgreSQL Connection Pool Management](/server-admin/distributed/workers/shared-nothing#postgresql-connection-pool-management) for details.

- DAG Runs Tag Filter: Filter DAG runs by tags in the UI and API. Select multiple tags to filter runs from DAGs that have ALL specified tags (AND logic). Available via the new `tags` query parameter on `/api/v1/dag-runs` endpoint (comma-separated).

- Key-Value Tags: Tags now support key-value pairs in addition to simple tags. Multiple YAML formats supported:

  ```yaml
  # Map notation
  tags:
    env: prod
    team: platform

  # Array with key=value strings
  tags:
    - env=prod
    - critical

  # Space-separated string
  tags: "env=prod team=platform"
  ```

  Tag filtering supports four modes:
  - `env` - matches any tag with key `env` (regardless of value)
  - `env=prod` - matches exact key-value pair
  - `!env` - matches if key `env` does NOT exist
  - `env=prod*`, `team=*`, `te?m` - wildcard patterns (`*` any chars, `?` single char)

  Values are normalized to lowercase. See [Tags](/writing-workflows/tags) for details.

- Tag Validation: Tags are validated at YAML load time. Keys must be 1-63 characters (alphanumeric, `-`, `_`, `.`), values 0-255 characters (alphanumeric, `-`, `_`, `.`, `/`). Invalid tags cause DAG load errors with descriptive messages.

- Shared-Nothing Worker Architecture: Workers can now operate without shared filesystem access. Enables deployment in Kubernetes, multi-cloud, and containerized environments where NFS/shared volumes are not available.

  **Key Features:**
  - Static Discovery: Configure workers with `--worker.coordinators=host:port` for direct coordinator connection
  - Status Pushing: Workers send execution status to coordinator via `ReportStatus` gRPC call
  - Log Streaming: Workers stream stdout/stderr to coordinator via `StreamLogs` gRPC call (32KB buffer, 64KB flush threshold)
  - Zombie Detection: Coordinator automatically marks tasks as FAILED when workers become unresponsive (30s heartbeat timeout)

  See [Workers](/server-admin/distributed/workers/) for deployment options and configuration.

- Web Terminal: Added optional web-based terminal for executing shell commands directly from the Dagu UI. Disabled by default for security.

  ```yaml
  terminal:
    enabled: true   # default: false
    max_sessions: 5 # default: 5
  ```

  Or via environment variables: `DAGU_TERMINAL_ENABLED=true`, `DAGU_TERMINAL_MAX_SESSIONS=5`

  See [Terminal Configuration](/server-admin/server#terminal) for details.

- Audit Logging Configuration: Added configuration option to enable/disable audit logging. Enabled by default.

  ```yaml
  audit:
    enabled: true   # default: true
  ```

  Or via environment variable: `DAGU_AUDIT_ENABLED=false`

  See [Audit Logging](/server-admin/server#audit-logging) for details.

- Git Sync: Synchronize DAG definitions with a Git repository. See [Git Sync](/server-admin/git-sync).

- Catchup (Missed Run Replay): New `catchup_window` field enables automatic replay of missed cron runs when the scheduler restarts after downtime. The scheduler tracks per-DAG watermarks and replays missed intervals in chronological order, one per scheduler tick. The `overlap_policy` field (`"skip"`, `"all"`, or `"latest"`) controls behavior when the DAG is still running during catchup. See [Scheduling — Catchup](/writing-workflows/scheduling#catchup-missed-run-replay).

- Unified Stop/Restart Scheduling: Stop and restart schedules are now evaluated by the same TickPlanner module that handles start schedules. Stop schedules fire only when the DAG's latest status is `running`. Restart schedules fire unconditionally. Watermarks track only start-schedule runs to prevent stop/restart times from corrupting catchup computation.

- Remote Agent Tool: New `remote` tool enabling task delegation to remote Dagu nodes. Agents can spawn and manage work across distributed instances with optional session ID support for idempotent session creation. See [Agent Tools](/features/agent/tools).

- Remote Node Management: Admin UI page for managing remote worker nodes with full CRUD operations and connection testing. REST API endpoints for remote node configuration. See [Distributed Execution](/server-admin/distributed/).

- Document Management: Comprehensive document management system with full CRUD and search capabilities. Dedicated Docs page with tree navigation and Markdown rendering for project documentation alongside DAG workflows.

- Git-Sync Reconciliation: Enhanced Git-sync with forget, delete, and move operations for sync item management. Cleanup functionality to remove all missing items at once. See [Git Sync](/server-admin/git-sync).

- License Management: License validation, status tracking, and feature gating system for RBAC and audit logging.

- Agent Personality (Soul): Agent personality management system with full CRUD capabilities. Users can select and customize agent personalities for chat sessions.

- Agent API Cost Tracking: Per-message cost tracking for LLM API calls with USD pricing metadata. Enhanced agent step message persistence for cost analysis.

- Provider-Native Web Search for Agent: Agents can use provider-native web search capabilities. Users can enable web search and configure maximum uses per request in agent settings.

- Singleton Enqueue Option: New `singleton` constraint for the `/dag-runs/enqueue` endpoint ensures only one DAG with the same name can be running or queued at any time. (#1672)

### Deprecated

- DAG-level `max_active_runs` field: The `max_active_runs` field in DAG files is now deprecated for local (DAG-based) queues. Local queues now always use FIFO processing with concurrency of 1.

  **Migration**: For concurrency control, define global queues in `~/.config/dagu/config.yaml` and assign DAGs using the `queue` field:

  ```yaml
  # ~/.config/dagu/config.yaml
  queues:
    enabled: true
    config:
      - name: my-queue
        max_concurrency: 3

  # In your DAG file
  name: my-dag
  queue: my-queue  # Use global queue for concurrency control
  ```

  The field is still accepted for backward compatibility but emits a build warning and is ignored for local queues.

- `max_active_runs: -1` (queue bypass): Setting `max_active_runs` to `-1` to bypass queueing is deprecated. All DAGs now go through the queue system with local queues defaulting to FIFO (concurrency 1).

### Fixed

- Sub-DAG Loading with Long Names: Fixed a bug where sub-DAG execution failed for DAG names near the 40-character limit. Temp file naming now truncates the DAG name prefix so the generated filename (without extension) never exceeds the `DAGNameMaxLen` validation limit.

- Sub-DAG Spec View: Fixed "file not found" error when viewing the spec tab for sub-DAG runs in the UI. Added dedicated API endpoint `/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/spec` that properly retrieves specs from the parent-child storage hierarchy.

- Container Step Output Capture: Fixed an issue where `container.command` was not executed when specified inside the container block without a top-level `command` field. Now `container.command` is properly used as the command to run, and output is correctly captured.

  ```yaml
  # This now works correctly
  steps:
    - id: step1
      container:
        image: alpine:3
        command:
          - echo
          - '{"name": "Alice", "age": 30}'
      output: RESULT  # Output is now captured
  ```

- Sub-DAG Error Masking in Parallel Execution: Fixed an issue where sub-DAG failures produced the cryptic error "no results available for node status determination" instead of the actual cause. When a child subprocess fails before writing status data, the error is now properly propagated with process exit details and captured stderr. Affected `node.go`, `dag_runner.go`, `parallel.go`, and `dag.go`.

- Windows Process Timeout and Subprocess Termination: Fixed `timeout_sec` not being enforced on Windows. The command executor's `Run()` method blocked on `cmd.Wait()` without responding to context cancellation, causing processes to run past their timeout. Refactored to run `cmd.Wait()` asynchronously with a `select` on context cancellation, and updated `KillProcessGroup()` on Windows to use `killProcessTree()` for complete subprocess tree termination. Returns exit code 124 on timeout. (#1635)

- Security: Path Traversal in DAG Creation API: DAG creation endpoint now validates names to prevent directory traversal attacks. (GHSA-6v48-fcq6-ff23, #1691)

- Docker HOME Folder Substitution: Added `-H` flag to `sudo` in `entrypoint.sh` so `~` correctly expands to `/home/dagu` instead of `/root` inside Docker containers. (#1699, reported by [@simonmysun](https://github.com/simonmysun))

- Cache Memory Bloat: Optimized cache implementation with more efficient eviction strategy to prevent excessive memory usage. (#1679, reported by community via #546)

- Webhook Fallback Body: Webhooks now support arbitrary JSON payloads with intelligent format detection and automatic fallback handling. (#1668)

- Queue Processing Stability: Enhanced queue processor stability with improved error handling and recovery mechanisms for DAG file operations during concurrent processing. (#1595, reported by [@ghansham](https://github.com/ghansham))

- Variable Expansion for Unknown Variables: Variable expansion now preserves unknown or undefined variables in their literal form instead of expanding to empty strings. (#1606)

- Scheduler Queue Capacity on Retry: Retries for DAGs using global queues are now properly enqueued instead of executed immediately, respecting queue capacity limits. (#1676, contributed by [@kriyanshii](https://github.com/kriyanshii), reported by [@ghansham](https://github.com/ghansham) via #1673)

- Working Directory Resolution: Enhanced working directory resolution to properly inherit from base configuration when not explicitly specified in DAG files. (#1641)

- Upgrade Command Stability: Improved upgrade download reliability with retry logic and exponential backoff. Strengthened Windows binary replacement. (#1646)

- Parallel + Call Parameter Splitting: Fixed expanded variable references being incorrectly split during parallel step execution with `call`. (#1665, reported by [@pdoronila](https://github.com/pdoronila) via #1658)

- Environment Variable Expansion for Non-Unix Shells: Improved variable expansion handling for edge cases involving single quotes and adjacent characters on Windows PowerShell and cmd. (#1666, reported by [@pdoronila](https://github.com/pdoronila) via #1661)

- Start Command Parameter Validation: Support for JSON-formatted parameters when executing DAG commands. Enhanced parameter validation for the `start` CLI command. (#1663, reported by [@pdoronila](https://github.com/pdoronila) via #1660)

- Frontend Build Segfaults: Replaced TerserPlugin with esbuild for faster, more reliable frontend builds. TerserPlugin was causing segfaults due to insufficient memory allocation. (#1645, contributed by [@yonas](https://github.com/yonas), reported via #901)

- Tag Sorting: Alphabetical sorting of tag filter combobox and DAG table tags list for better usability. (#1617, contributed by [@prods](https://github.com/prods))

- Queue Count Display: Fixed queue status reporting to exclude currently running items from the queued count. (#1602, contributed by [@sahalbelam](https://github.com/sahalbelam), reported via #1601)

### Contributors

This release represents a massive effort with **108 merged pull requests** since v1.30.3. We are deeply grateful to every contributor who helped make Dagu v2 a reality through code, bug reports, feature requests, reviews, and community support.

**Special Thanks** to [@ghansham](https://github.com/ghansham) and [@kriyanshii](https://github.com/kriyanshii) for providing many valuable feedback and ideas throughout the v2.0.0 development cycle. Their consistent engagement across issues, pull requests, and discussions has been instrumental in shaping this release.

#### Code Contributors

Contributors who authored merged pull requests for v2.0.0:

| Contributor | Contributions |
| --- | --- |
| [@prods](https://github.com/prods) (Pedro Rodriguez) | Windows process timeout and subprocess tree termination fix (#1635), tag sorting and label ordering fix (#1617) |
| [@kriyanshii](https://github.com/kriyanshii) | Production-ready Helm chart for Kubernetes deployment (#1613), scheduler queue capacity fix for retries (#1676) |
| [@sahalbelam](https://github.com/sahalbelam) | Singleton option for enqueue API (#1672), filename-based DAG ingestion (#1630), queue count display fix (#1602) |
| [@yonas](https://github.com/yonas) | Replaced TerserPlugin with esbuild to fix frontend build segfaults (#1645) |

#### Bug Reporters

Contributors who identified and reported bugs that were fixed in v2.0.0:

| Contributor | Reports |
| --- | --- |
| [@pdoronila](https://github.com/pdoronila) (Paul Doronila) | `${VAR}` interpolation broken on Windows (#1661), `--` separator required for params (#1660), `parallel:` + `call:` param splitting (#1658), base config `workingDir` inheritance (#1656), multiple dotenv files (#1657) |
| [@waterworthd-cim](https://github.com/waterworthd-cim) | False "cyclic plan detected" error with step ordering (#1618), `maxActiveSteps` has no effect (#1619) |
| [@insanity54](https://github.com/insanity54) (Chris) | LLM chat POST content-type set to `text/plain` (#1574), `jq` step outputs numbers in scientific notation (#1648) |
| [@sahalisro-blip](https://github.com/sahalisro-blip) | Node modules download error (#1561), queued DAG count incorrect (#1601) |
| [@prods](https://github.com/prods) (Pedro Rodriguez) | `timeoutSec` not enforced on Windows (#1636) |
| [@simonmysun](https://github.com/simonmysun) (Sun, Maoyin) | Ambiguous HOME folder substitution in Docker (#1698) |
| [@dendrite-soup](https://github.com/dendrite-soup) | Security vulnerability report: unauthenticated RCE in default config (GHSA-6qr9-g2xw-cw92, #1700) |
| [@dev-epices](https://github.com/dev-epices) | Step name 29-character limit in parallel execution (#1631) |
| [@sbartczak-aleno](https://github.com/sbartczak-aleno) (Szymon Bartczak) | No way to escape dollar sign ($) in non-shell contexts (#1628) |
| [@Kirandeep-Singh-Khehra](https://github.com/Kirandeep-Singh-Khehra) | `workingDir` not working with SSH executor (#1596) |
| [@abylon-io](https://github.com/abylon-io) (Pascal Thomas) | Environment variables not expanded in mail settings (#1557) |
| [@n3storm](https://github.com/n3storm) (Nestor Diaz Valencia) | Website docs menu entry pointing to old domain (#1644) |
| [@aigeling](https://github.com/aigeling) | Documentation site unreachable (#1650) |
| [@evanzhang87](https://github.com/evanzhang87) (Evan) | Live demo user not working (#1560) |
| [@Evs91](https://github.com/Evs91) | S3 Object Storage not recognized as valid type (#1690) |
| [@scilo7](https://github.com/scilo7) | Immediate execution does not respect `workerSelector` (#1638) |
| [@williamohara](https://github.com/williamohara) (William O'Hara) | Health endpoint access logging noise (#1694) |

#### Feature Requesters

Contributors who proposed features that were implemented in v2.0.0:

| Contributor | Requests |
| --- | --- |
| [@ghansham](https://github.com/ghansham) | Key-value tags (#1495), queue capacity on retry (#1673), dynamic parameters (#1677), failed DAG queue behavior (#1674) |
| [@kevinsimper](https://github.com/kevinsimper) (Kevin Simper) | Trigger type visibility in DAG run history (#1610) |
| [@bagemt](https://github.com/bagemt) (mt) | Container shell wrapper / generic entrypoint overwrite (#1589), interactive DAG graph library suggestion (#1593) |
| [@sahalbelam](https://github.com/sahalbelam) | Singleton support for enqueue API (#1643), URL field for enqueue API (#1609) |
| [@kriyanshii](https://github.com/kriyanshii) | Tag-wise search for DAG runs (#1494) |
| [@NebulaCoding1029](https://github.com/NebulaCoding1029) | SFTP/FTP executor support (#1079) |
| [@ByamB4](https://github.com/ByamB4) (Byambadalai Sumiya) | Security features (#1687) |
| [@Kaiden0001](https://github.com/Kaiden0001) | Log pagination improvements (#1579) |
| [@thimuslux](https://github.com/thimuslux) (ThiMusLUX) | Basic condition If/Then/Else (#1629) |
| [@artemklevtsov](https://github.com/artemklevtsov) | Helm chart for Kubernetes (#1492) |
| [@berkaydedeoglu](https://github.com/berkaydedeoglu) | Worker ID visibility (#1500) |

#### Community Support and Reviewers

Contributors who provided code reviews, helped diagnose bugs, answered questions, and supported the community throughout the v2.0.0 development cycle:

| Contributor | Support |
| --- | --- |
| [@ghansham](https://github.com/ghansham) | Extensive code reviews, issue triage, and community support across 15+ issues and PRs including #1596, #1609, #1610, #1629, #1631, #1643, #1644, #1657, #1669, #1672, #1674, #1676, #1677. One of the most active community members. |
| [@mkalinski93](https://github.com/mkalinski93) (Michael Brendle) | Distributed workers discussion and feedback (#1686) |
| [@vnghia](https://github.com/vnghia) (Nghia) | Docker executor deprecation discussion (#1515) |
| [@wilsoncd35](https://github.com/wilsoncd35) (Charlie Wilson) | `logOutput` sub-DAG inheritance report (#1555) |
| [@ben-auo](https://github.com/ben-auo) | Containerd discussion (#1323) |

#### Historical Code Contributors

Contributors who authored code in previous releases that forms the foundation of v2.0.0:

[@ArseniySavin](https://github.com/ArseniySavin),
[@ddddddO](https://github.com/ddddddO),
[@garunitule](https://github.com/garunitule),
[@Kiyo510](https://github.com/Kiyo510),
[@Lewiscowles1986](https://github.com/Lewiscowles1986),
[@liooooo29](https://github.com/liooooo29),
[@rafiramadhana](https://github.com/rafiramadhana),
[@RamonEspinosa](https://github.com/RamonEspinosa),
[@rocwang](https://github.com/rocwang),
[@stefaan1o](https://github.com/stefaan1o),
[@x2ocoder](https://github.com/x2ocoder),
[@x4204](https://github.com/x4204),
[@fishnux](https://github.com/fishnux),
[@triole](https://github.com/triole),
[@yarikoptic](https://github.com/yarikoptic),
[@zph](https://github.com/zph),
[@arky](https://github.com/arky),
[@Arvintian](https://github.com/Arvintian),
[@jerry-yuan](https://github.com/jerry-yuan),
[@jonnochoo](https://github.com/jonnochoo),
[@lvoeg](https://github.com/lvoeg),
[@reneleonhardt](https://github.com/reneleonhardt),
[@david-waterworth](https://github.com/david-waterworth),
[@Tagnard](https://github.com/Tagnard),
[@thefishhat](https://github.com/thefishhat),
[@AdityaTel89](https://github.com/AdityaTel89),
[@Sarvesh-11](https://github.com/Sarvesh-11),
[@SiwonP](https://github.com/SiwonP),
[@christinoleo](https://github.com/christinoleo)

#### Community Participants

Everyone who participated in discussions, reported feedback, or helped other users during the v2.0.0 cycle:

[@2012ZGZYY](https://github.com/2012ZGZYY),
[@accforgithubtest](https://github.com/accforgithubtest),
[@admerzeau](https://github.com/admerzeau),
[@agajic-modoolar](https://github.com/agajic-modoolar),
[@alangrafu](https://github.com/alangrafu),
[@alext-extracellular](https://github.com/alext-extracellular),
[@alfhj](https://github.com/alfhj),
[@alienscience](https://github.com/alienscience),
[@aptemus](https://github.com/aptemus),
[@AX-AMote](https://github.com/AX-AMote),
[@bellackn](https://github.com/bellackn),
[@bielids](https://github.com/bielids),
[@biraj21](https://github.com/biraj21),
[@borestad](https://github.com/borestad),
[@bremyozo](https://github.com/bremyozo),
[@cernoel](https://github.com/cernoel),
[@chrishoage](https://github.com/chrishoage),
[@CMiksche](https://github.com/CMiksche),
[@codinggeeks06](https://github.com/codinggeeks06),
[@Daffdi](https://github.com/Daffdi),
[@DarkWiiPlayer](https://github.com/DarkWiiPlayer),
[@dat-adi](https://github.com/dat-adi),
[@dAtBigFish](https://github.com/dAtBigFish),
[@dev-a](https://github.com/dev-a),
[@dmitriy-b](https://github.com/dmitriy-b),
[@don-philipe](https://github.com/don-philipe),
[@eerison](https://github.com/eerison),
[@erwan-airone](https://github.com/erwan-airone),
[@eugenechyrski](https://github.com/eugenechyrski),
[@fbartels](https://github.com/fbartels),
[@frafra](https://github.com/frafra),
[@georgeck](https://github.com/georgeck),
[@GhisF](https://github.com/GhisF),
[@gyger](https://github.com/gyger),
[@hbina](https://github.com/hbina),
[@helmut72](https://github.com/helmut72),
[@hgeritzer](https://github.com/hgeritzer),
[@HtcOrange](https://github.com/HtcOrange),
[@iainad](https://github.com/iainad),
[@imkebe](https://github.com/imkebe),
[@jarnik](https://github.com/jarnik),
[@jeremydelattre59](https://github.com/jeremydelattre59),
[@jhuang732](https://github.com/jhuang732),
[@JohnMatthiasWabwire](https://github.com/JohnMatthiasWabwire),
[@jonasban](https://github.com/jonasban),
[@jonathonc](https://github.com/jonathonc),
[@jrisch](https://github.com/jrisch),
[@JuchangGit](https://github.com/JuchangGit),
[@jyroscoped](https://github.com/jyroscoped),
[@kacamific](https://github.com/kacamific),
[@kachida](https://github.com/kachida),
[@kamandir](https://github.com/kamandir),
[@kylejbrk](https://github.com/kylejbrk),
[@lnlion](https://github.com/lnlion),
[@mdanilakis](https://github.com/mdanilakis),
[@Mice7R](https://github.com/Mice7R),
[@mingjianliu](https://github.com/mingjianliu),
[@mitchplze](https://github.com/mitchplze),
[@mnmercer](https://github.com/mnmercer),
[@Netmisa](https://github.com/Netmisa),
[@nicokant](https://github.com/nicokant),
[@nightly-brew](https://github.com/nightly-brew),
[@normal-coder](https://github.com/normal-coder),
[@overflowy](https://github.com/overflowy),
[@Pangolin2097](https://github.com/Pangolin2097),
[@peterbuga](https://github.com/peterbuga),
[@piotrwalkusz1](https://github.com/piotrwalkusz1),
[@plc-dev](https://github.com/plc-dev),
[@pratio](https://github.com/pratio),
[@rrottmann](https://github.com/rrottmann),
[@saishreyakumar](https://github.com/saishreyakumar),
[@samuelgodoy](https://github.com/samuelgodoy),
[@sascha-andres](https://github.com/sascha-andres),
[@Sedymariama](https://github.com/Sedymariama),
[@semyon-t](https://github.com/semyon-t),
[@SGRelic](https://github.com/SGRelic),
[@SoarinFerret](https://github.com/SoarinFerret),
[@tapir](https://github.com/tapir),
[@tetedange13](https://github.com/tetedange13),
[@tguructa](https://github.com/tguructa),
[@thibmart1](https://github.com/thibmart1),
[@topjor](https://github.com/topjor),
[@TrezOne](https://github.com/TrezOne),
[@Vad1mo](https://github.com/Vad1mo),
[@vhespanha](https://github.com/vhespanha),
[@volong113322-tech](https://github.com/volong113322-tech),
[@wakatara](https://github.com/wakatara),
[@xinxinxinye](https://github.com/xinxinxinye),
[@yangkghjh](https://github.com/yangkghjh),
[@ylaizet](https://github.com/ylaizet),
[@yosefy](https://github.com/yosefy),
[@yurivish](https://github.com/yurivish),
[@ZivenLu](https://github.com/ZivenLu),
[@zobzn](https://github.com/zobzn)

## v1.30.0 (2026-01-04)

### Added

- SSH Shell Configuration: Added `shell` field to SSH executor configuration for wrapping remote commands in a shell. This enables shell features like variable expansion, pipes, and command chaining on remote servers. Supports both DAG-level and step-level configuration, with step-level `shell` field as a fallback for convenience.

  ```yaml
  ssh:
    user: deploy
    host: app.example.com
    shell: /bin/bash  # Commands wrapped as: /bin/bash -c 'command'
    # Or array syntax: shell: ["/bin/bash", "-e"]

  steps:
    - command: echo $HOME && ls -la  # Shell features now work
  ```

  See [SSH](/step-types/ssh) for full documentation.

- Simplified Executor Syntax: Added `type` and `config` fields at step level as a cleaner alternative to the `executor` block. Both syntaxes are fully supported. (#1525)

  ```yaml
  # New shorthand syntax
  steps:
    - id: deploy
      type: ssh
      config:
        host: prod.example.com
        user: deploy
      command: ./deploy.sh

  # Legacy syntax (removed in v1.31.0)
  steps:
    - id: deploy
      executor:
        type: ssh
        config:
          host: prod.example.com
          user: deploy
      command: ./deploy.sh
  ```

- Chat Step Type: Added a new step type for integrating Large Language Models into workflows. Execute LLM requests to OpenAI, Anthropic, Google Gemini, OpenRouter, and local models (Ollama, vLLM). (#1548)

  ```yaml
  steps:
    - type: chat
      llm:
        provider: openai
        model: gpt-4o
      messages:
        - role: user
          content: "What is 2+2?"
      output: ANSWER
  ```

  **Key Features:**
  - Multi-provider support: OpenAI, Anthropic, Gemini, OpenRouter, and local OpenAI-compatible APIs (aliases: `ollama`, `vllm`, `llama` map to `local`)
  - DAG-level configuration: Define `llm:` at DAG level to share settings across multiple chat steps
  - Multi-turn sessions: Steps inherit session history from dependencies via `depends`, enabling context-aware AI workflows
  - Extended thinking mode: Enable deeper reasoning with `thinking.enabled` and effort levels (`low`, `medium`, `high`, `xhigh`)
  - Streaming output: Response tokens stream to stdout by default (disable with `stream: false`)
  - Automatic retry: Exponential backoff on transient errors (rate limits, server errors, timeouts)

  See [Chat](/features/chat/) for full documentation.

- Per-DAG Prometheus Metrics: Enhanced observability with granular per-DAG metrics and histograms. (#1411)
  - `dagu_dag_runs_currently_running_by_dag` - Running count per DAG
  - `dagu_dag_runs_queued_by_dag` - Queue depth per DAG
  - `dagu_dag_runs_total_by_dag` - Run counts by DAG and status
  - `dagu_dag_run_duration_seconds` - Duration histogram per DAG
  - `dagu_queue_wait_seconds` - Queue wait time histogram per DAG

  See [Prometheus Metrics](/server-admin/prometheus-metrics) for full documentation.

- Container Exec Mode: Execute commands in already-running containers instead of creating new ones. This enables running workflows in containers started by Docker Compose or other orchestration tools. (#1515)

  **String form** - exec with container's default settings:

  ```yaml
  container: my-running-container

  steps:
    - command: php artisan migrate
    - command: php artisan cache:clear
  ```

  **Object form** - with user, working_dir, and env overrides:

  ```yaml
  container:
    exec: my-running-container
    user: root
    working_dir: /var/www
    env:
      - APP_DEBUG=true

  steps:
    - command: composer install
  ```

  Exec mode works at both DAG-level and step-level. The container must be running; Dagu waits up to 120 seconds for the container to be in running state.

  See [Container Field](/writing-workflows/container#exec-mode-use-existing-container) for full documentation.

- Worker ID Tracking: Added worker ID tracking to DAG runs for distributed setups. Users can now see which worker executed their jobs in both the DAG runs list and detail views. (#1500)
  - Local execution displays `local` as the worker ID
  - Distributed execution displays the worker ID (format: `{hostname}@{pid}`)
  - Worker ID is shown in the DAG runs table and run details panel

- Configurable Cache Limits: Added `cache` configuration option with presets to control memory usage for in-memory caches. (#1411)

  ```yaml
  cache: normal   # options: low, normal, high (default: normal)
  ```

  Or via environment variable: `DAGU_CACHE=low`

  | Preset | DAG | DAGRun | APIKey | Webhook |
  |--------|-----|--------|--------|---------|
  | `low`  | 500 | 5,000  | 100    | 100     |
  | `normal` | 1,000 | 10,000 | 500 | 500   |
  | `high` | 5,000 | 50,000 | 1,000 | 1,000 |

  See [Server Configuration](/server-admin/server#cache-configuration) for details.

- `DAGU_PARAMS_JSON` availability: Every step now receives the merged parameter payload as JSON via the `DAGU_PARAMS_JSON` environment variable, even when parameters are supplied through legacy CLI strings. If a run starts with raw JSON parameters, the original payload is preserved verbatim. This makes it easier for scripts to consume structured parameter data without re-parsing shell strings. (#1550)
- DAG Spec Tab in Status View: Added a new "Spec" tab to the DAG status page and DAG run details modal/panel. This tab displays the DAG YAML specification in readonly mode with the Schema Documentation sidebar available for reference. The spec shown is the exact spec that was used at execution time, not the current spec. (#XXXX)
- Wait Status Email Notifications: Added `mail_on.wait` and `wait_mail` configuration for sending email notifications when a DAG enters wait status (Human In The Loop). This enables teams to be notified when workflows require human approval.

  ```yaml
  mail_on:
    wait: true

  wait_mail:
    from: dagu@example.com
    to: approvers@example.com
    prefix: "[WAITING]"
    attach_logs: false
  ```

  See [Email Notifications](/writing-workflows/email-notifications#wait-status-notifications) for details.

- HITL (Human-in-the-Loop): Added `hitl` executor for pausing workflows until human approval. Enables approval gates where manual review is required before proceeding.

  ```yaml
  steps:
    - command: ./deploy.sh staging
    - type: hitl
      config:
        prompt: "Approve production?"
        input: [APPROVED_BY]
        required: [APPROVED_BY]
    - command: ./deploy.sh production
  ```

  Key features:
  - Pause workflow execution for human review
  - Collect parameters from approvers as environment variables
  - Approve or reject via web UI or REST API
  - New statuses: `waiting` (paused for approval) and `rejected` (approval denied)

  See [Approval](/writing-workflows/approval) for full documentation.

- Wait Handler: Added `handler_on.wait` lifecycle handler that executes when a workflow enters wait status.

  ```yaml
  handler_on:
    wait:
      command: notify-slack.sh "${DAG_WAITING_STEPS}"

  steps:
    - type: hitl
  ```

  See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) for full documentation.

- Chat Executor: Added a new executor for integrating Large Language Models into workflows. Supports OpenAI, Anthropic, Google Gemini, OpenRouter, and local models (Ollama, vLLM).

  ```yaml
  steps:
    - type: chat
      llm:
        provider: openai
        model: gpt-4o
      messages:
        - role: user
          content: "What is 2+2?"
      output: ANSWER
  ```

  Key features:
  - Multi-turn sessions: Steps inherit session history from dependencies
  - Variable substitution: Message content supports `${VAR}` syntax
  - Streaming: Response tokens are streamed to stdout by default
  - Multiple providers: `openai`, `anthropic`, `gemini`, `openrouter`, `local`
  - Automatic retry: Retries on rate limits and transient errors with exponential backoff

  See [Chat Executor](/features/chat/) for full documentation.

### Changed

- Metrics Endpoint Access Control: The `/api/v1/metrics` endpoint now requires authentication by default for improved security. Configure `metrics: "public"` or set `DAGU_SERVER_METRICS=public` to restore the previous public access behavior. When private, use API tokens or basic auth for Prometheus scraping. (#1411)

  ```yaml
  # Require authentication (new default)
  metrics: "private"

  # Allow public access (previous behavior)
  metrics: "public"
  ```

  See [Prometheus Metrics](/server-admin/prometheus-metrics) for configuration examples.

### Fixed

- Config Path Resolution: All configuration paths (DAGsDir, LogDir, DataDir, etc.) are now resolved to absolute paths at load time with proper error handling. Previously, path resolution failures were silently logged and the original unresolved path was used, which could cause mysterious runtime failures. Now, if any config path cannot be resolved to an absolute path, configuration loading fails with a clear error message.

- Multiple dotenv files: Fixed loading of multiple `.env` files. Previously, only the first file was processed. Now all files are loaded sequentially, with later files overriding values from earlier ones. Duplicate file paths are automatically deduplicated. Note: `.env` is always prepended to the list unless `dotenv: []` is specified. (#1519)

  ```yaml
  # All files are now loaded, with later files overriding earlier ones
  dotenv:
    - .env.defaults    # .env loaded first (auto-prepended), then this
    - .env.local       # Overrides earlier files
    - .env.production  # Overrides all earlier files
  ```

- Cache item counting: Fixed cache `Store` method incorrectly incrementing item counter when updating existing keys, and `Invalidate` method decrementing counter for non-existent keys. (#1411)

## v1.29.0 (2025-12-28)

### Added

- Spec: Added `log_output` field at DAG and step levels to control stdout/stderr logging behavior - `separate` (default) writes to separate `.out`/`.err` files, `merged` writes both to a single `.log` file with interleaved output (#1505)
- DAG Run Outputs Collection: Collect step outputs into a structured `outputs.json` file per DAG run. View collected outputs in the Web UI via the new Outputs tab. (#1466)
  - Outputs are automatically collected from steps with `output` field
  - Secret values are automatically masked in outputs
  - Enhanced `output` field syntax supports object form with `name`, `key`, and `omit` options:

```yaml
steps:
  # Simple string form (existing behavior)
  - id: get_count
    command: echo "42"
    output: COUNT

  # Object form with custom key
  - id: get_version
    command: cat VERSION
    output:
      name: VERSION
      key: appVersion  # Custom key in outputs.json (default: camelCase of name)

  # Object form with omit
  - id: internal_step
    command: echo "processing"
    output:
      name: TEMP
      omit: true  # Exclude from outputs.json but still usable in DAG
```

- API endpoint: `GET /api/v1/dag-runs/{name}/{dagRunId}/outputs`
- See [DAG Run Outputs](/writing-workflows/outputs) for full documentation
- UI: Added wrap/unwrap toggle button in log viewer for better readability of long lines
- API Key Management: Added comprehensive API key management for programmatic access with role-based permissions. API keys provide a secure alternative to static tokens with fine-grained access control.
  - Create, list, update, and delete API keys via Web UI or REST API
  - Role-based permissions (admin, manager, operator, viewer) per key
  - Usage tracking with `lastUsedAt` timestamp
  - Secure key generation with bcrypt hashing
  - Keys use `dagu_` prefix for easy identification
  - Web UI management at Settings > API Keys (admin only)
  - Full REST API at `/api/v1/api-keys` endpoints

```bash
# Create an API key
curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-pipeline", "role": "operator"}'

# Use the API key
curl -H "Authorization: Bearer dagu_your-key-here" \
  http://localhost:8080/api/v1/dags
```

Requires builtin authentication mode (`auth.mode: builtin`). See [API Keys documentation](/server-admin/authentication/api-keys) for details.

- Webhook Management: Added DAG-specific webhooks for triggering workflow executions from external systems like CI/CD pipelines, GitHub, and Slack.
  - Create, regenerate, enable/disable, and delete webhooks via Web UI or REST API
  - DAG-specific tokens (one webhook per DAG) with `dagu_wh_` prefix
  - Payload passthrough via `WEBHOOK_PAYLOAD` environment variable
  - Idempotent execution support with custom `dagRunId`
  - Usage tracking with `lastUsedAt` timestamp
  - Secure token storage with bcrypt hashing
  - Full REST API at `/api/v1/webhooks` and `/api/v1/dags/{fileName}/webhook` endpoints

```bash
# Create a webhook for a DAG
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $JWT_TOKEN"

# Trigger DAG via webhook with payload
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer dagu_wh_your-webhook-token" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"branch": "main", "commit": "abc123"}}'
```

Requires builtin authentication mode (`auth.mode: builtin`). See [Webhooks documentation](/server-admin/authentication/webhooks) for details.

- Multiple Commands per Step: Steps can now execute multiple commands sequentially using an array syntax. This allows sharing step configuration (`env`, `working_dir`, `retry_policy`, `preconditions`, `container`, etc.) across multiple commands instead of duplicating it across separate steps.

```yaml
steps:
  - id: build_and_test
    command:
      - npm install
      - npm run build
      - npm test
    env:
      - NODE_ENV: production
    working_dir: /app
```

Commands run in order and stop on first failure. Retries restart from the first command (no checkpoint/resume from middle).

Supported executors: shell, command, docker, container, ssh. Executors that do not support multiple commands (jq, http, archive, mail, github_action, dag) will reject the configuration at parse time.

### Fixed

- Config: Fixed `error_mail` and `info_mail` partial field overrides not working when only specifying `prefix` or `attach_logs` without `from`/`to` fields. Previously, single-field overrides were silently ignored. (#1512)
- Config: Fixed `smtp` partial field overrides not working when only specifying `username` or `password` without `host`/`port` fields.

## v1.28.0 (2025-12-24)

### Added

- Step-Level Container Field: Added `container` field for individual steps, providing the same configuration options as DAG-level container but for per-step container execution. This is the recommended way to run steps in containers, replacing the verbose `executor: docker` syntax.

```yaml
steps:
  - id: build
    container:
      image: node:24
      volumes:
        - ./src:/app
      working_dir: /app
    command: npm run build

  - id: test
    container:
      image: python:3.11
      env:
        - PYTHONPATH=/app
    command: pytest
```

### Changed

- Documentation: Updated all documentation to use the new step-level `container` syntax instead of `executor: docker`
- JSON Schema: Updated DAG schema to include step-level `container` field with proper validation
- Spec Refactor (internal): Restructured spec types and build logic for improved maintainability (#1499)
- UI: Removed link to Discord and Github from the frontend

### Validation

- Added validation to prevent using `container` field together with `executor` field (conflicting execution methods)
- Added validation to prevent using `container` field together with `script` field (scripts not supported in containers)

## v1.27.0 (2025-12-21)

### Added

- CLI: Added `cleanup` command for removing old DAG-run data for specified DAG-name

### Fixed

- Runtime, API: Fix issues that a DAG run often fails due to max active run check

### Changed

- UI: Updated frontend design color schema and removed dark mode UI

## v1.26.7 (2025-12-20)

### Added

- Runtime: Add support for multi-level nested DAG execution
- Spec: Add `containerName` field to DAG-level `container` field

## v1.26.4 (2025-12-14)

### Added

- API: Added optional `singleton` flag to `POST /dags/{fileName}/enqueue` endpoint to prevent duplicate runs when a DAG is already executing or queued; returns HTTP 409 Conflict when enabled and active/queued runs exist (#1483, #1460)

### Changed

- Deps: Upgraded gopsutil from v3 to v4 (#1470)
  - Note: On Linux, `UsedPercent` for memory now derives from `MemAvailable` rather than the previous method, which may alter reported values by 6-10%
- Release: Removed NetBSD from release targets

### Fixed

- Scheduler: Queue processor now respects `maxConcurrency` configuration in global config for DAG-based queues (#1482)
- Runtime: Fixed dequeue command missing queue name parameter, causing API-based dequeue operations to fail (#1481)
- Auth: API token authentication now works alongside builtin authentication mode; unified middleware supports JWT Bearer tokens, API tokens, Basic auth, and OIDC simultaneously (#1480, #1478, #1475)
- UI: User Management menu now only displays for admin users when authentication mode is "builtin"; reset password functionality restricted to admin users (#1484)
- Runtime: Special environment variables (`DAG_RUN_ID`, `DAG_NAME`, etc.) now work correctly in `handler_on.exit` and other handler contexts (#1474)
- Security: Escaped config path strings injected into HTML templates to prevent potential JavaScript injection vulnerabilities on Windows (#1472)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Dequeue command queue name fix (#1481) | [@kriyanshii](https://github.com/kriyanshii) |
| Singleton flag feature request (#1460) | [@kriyanshii](https://github.com/kriyanshii) |
| User creation error with builtin auth bug report (#1478) | [@Kaiden0001](https://github.com/Kaiden0001) |
| DAG_RUN_ID in handlers bug report (#1474) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Remote node selection with builtin auth bug report (#1475) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Singleton enqueue feedback | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.26.2...v1.26.3](https://github.com/dagu-org/dagu/compare/v1.26.2...v1.26.3)

## v1.26.2 (2025-12-10)

### Added

- Spec: Added optional `negate` flag for preconditions at both DAG and step levels to invert condition evaluation (#1451)
- Spec: Added `init` handler field that executes after preconditions but before workflow steps - if it fails, subsequent steps are prevented from executing (#1455)
- Spec: Added `abort` handler as canonical replacement for the deprecated `cancel` handler (#1455)
- Spec: Added `skipBaseHandlers` option to prevent sub-DAGs from inheriting parent handler configurations (#1455)
- Spec: Added `continue_on` shorthand syntax - users can now specify `continue_on: "skipped"` or `continue_on: "failed"` instead of verbose object definitions (#1454)
- CLI: Added `--default-working-dir` flag to `start` and `enqueue` commands to specify a fallback working directory for DAG executions; automatically propagates to sub-DAGs (#1459)
- Feature: Added comprehensive resource monitoring for CPU, memory, disk, and system load with in-memory retention store and API endpoint (`GET /services/resources/history`) (#1461)
- UI: Added resource usage visualization charts on System Status page (#1461)
- Feature: Implemented built-in JWT-based authentication system with role-based access control (RBAC) (#1463)
  - Four-tier role hierarchy: admin, manager, operator, viewer
  - Complete user management APIs (create, list, view, update, delete)
  - File-backed user store with atomic writes and thread-safety
  - Login flow, protected routes, user management UI
- Config: Added `AUTH_MODE` environment variable supporting `none`, `basic`, and `builtin` modes (#1463)

### Changed

- Config: Refactored configuration loader to use service-scoped loading that only loads necessary settings for each command context, improving startup performance (#1467)
- Config: Replaced public `Global` config field with `Core` across the codebase (#1467)
- Config: Standardized key=value parsing using `strings.Cut` instead of `strings.SplitN` (#1467)
- API: v1 API routes are now disabled when authentication is enabled (#1463)

### Fixed

- Runtime: Log tails and recent stderr now decode multiple encodings (Shift_JIS, EUC-JP, ISO-8859-1, Windows-1252, GBK, Big5, EUC-KR, UTF-8) properly based on system locale (#1449)
- Runtime: Special environment variables (`DAG_NAME`, `DAG_RUN_ID`, `DAG_RUN_LOG_FILE`) are now properly accessible in failure handlers and executor config evaluation (#1448)
- Queue: Fixed queued DAG jobs failing to process with "name or path is required" error - queue items now use lazy, file-backed loading with proper error handling (#1457, #1437)
- UI: Disabled step retry buttons while a DAG is actively running to prevent unintended behavior (#1447)
- Validation: Added maximum DAG name length validation (40 characters) with pre-validation on rename operations (#1469)
- Config: Made auth mode nullable in configuration, establishing "none" as the default with runtime validation (#1469)
- UI: Enhanced dark-mode text selection styling for input fields (#1469)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Stop step retry while DAG is running UI fix (#1447) | [@kriyanshii](https://github.com/kriyanshii) |
| Queued DAGs not starting bug report (#1437) | [@kriyanshii](https://github.com/kriyanshii) |
| Init handler field feedback | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.25.1...v1.26.0](https://github.com/dagu-org/dagu/compare/v1.25.1...v1.26.0)

## v1.25.1 (2025-12-05)

### Fixed

- Mail: Added STARTTLS and LOGIN auth support for SMTP servers (#1446)
- Windows: Fixed bug in command construction with PowerShell/cmd.exe (#1445)

## v1.25.0 (2025-12-04)

### Added

- UI: Display script detail dialog on steps list (#1435)
- UI: Added Paths display panel in System Status page, showing system filesystem locations (DAGs, logs, config files, etc.)
- Config: Resolve path environment variables to absolute paths and sync for subprocesses (#1430)

### Changed

- Config: Log encoding now auto-detected from system locale (Unix) or Windows code page instead of defaulting to UTF-8 (#1439)
- API: DAG rename no longer renames run history to prevent data loss

### Fixed

- Core: Resolve working directory relative paths correctly - DAG-level `working_dir` resolves against DAG file location, step-level `dir` resolves against DAG's `working_dir` (#1436)
- Windows: Improved PowerShell and cmd.exe shell handling (#1439)
  - Scripts in working directory now execute correctly (auto-prefixes `.\` when needed)
  - PowerShell scripts now fail properly on non-zero exit codes from external commands
  - Environment variable matching is now case-insensitive
  - Added platform-specific base environment variables
- UI: Fixed graph visualization crash when step names contain parentheses (#1440, #1434)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Graph crash with parentheses in step names fix (#1440) | [@Tagnard](https://github.com/Tagnard) |
| Graph crash bug report (#1434) | [@DarkWiiPlayer](https://github.com/DarkWiiPlayer) |
| Windows version testing and bug report | O.Yena on Discord |

## v1.24.9 (2025-11-30)

### Added

- DAG: Set a default shell once per workflow via a new root-level `shell` field; both DAG and step `shell` values accept strings or arrays so you can pass shell flags without quoting hassles (#1426)
- UI: Running and failed step names displayed on the DAG runs page for quick status overview without navigating to details (#1420, #1401)
- Installer: Windows support with PowerShell and cmd.exe installation options (#1428)

### Changed

- CLI: `dequeue` now accepts a queue name positional argument and will pop the oldest item when `--dag-run` is omitted; provide `--dag-run` to target a specific run (#1421)
- Core: Refactored logging code to use typed attributes for better observability (#1422)

### Fixed

- Scheduler: Fixed DAG entry reader not starting on startup, causing scheduled runs not to execute (#1427, #1423)
- Executor: Handle Windows script extensions for proper command execution (#1425)
- Config: Use correct config file path on Windows (#1424)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Running/failed steps list on DAG runs page (#1420) | [@kriyanshii](https://github.com/kriyanshii) |
| Running/failed steps feature request (#1401) | [@ghansham](https://github.com/ghansham) |
| Scheduled runs not executing bug report (#1423) | [@gyger](https://github.com/gyger) |
| Scheduled runs issue confirmation (#1423) | [@SGRelic](https://github.com/SGRelic) [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Windows issues report (#1424, #1425) | O.Yena on Discord |

## v1.24.8 (2025-11-23)

### Fixed

- Core: ensure DAG working directory exists
- Core: fix bug in DAG-run data retrieval
- API: fix bug in the queue items API endpoint
- Core: fix bug in queue item processing

### Added

- Spec/API/UI: Added `timeout_sec` step-level field to cap individual step execution time; when set it overrides any DAG-level timeout for that step (#1412)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Step-level `timeout_sec` field (#1412) | [@kriyanshii](https://github.com/kriyanshii) |
| Queue issue report (#1417) | [@ghansham](https://github.com/ghansham) |

## v1.24.7

### Fixed

- Auth/API: Exempt `/api/v1/metrics` from authentication so Prometheus scrapes succeed out of the box (#1409)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| OIDC issue report | [@alangrafu](https://github.com/alangrafu) [@Netmisa](https://github.com/Netmisa) |

## v1.24.6

### Fixed

- Auth/API: Exempt `/api/v1/metrics` from authentication so Prometheus scrapes succeed out of the box (#1409)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Metrics auth bypass report (#1409) | [@jeremydelattre59](https://github.com/jeremydelattre59) |

## v1.24.5

### Changed

- Status: Renamed the `canceled` lifecycle label to `aborted` across the CLI, runtime, APIs, schemas, and UI so status analytics and automations reference a single canonical value.

### Fixed

- Docker executor: Preserve step-level container entrypoints so step commands can rely on the image's default binary (#1403)
- Auth/API: Add configurable public paths so `/api/v*/health` bypasses authentication for uptime probes by default (#1404)
- Auth/OIDC: Guard verifier initialization so unreachable issuers fail gracefully instead of crashing the server (#1407)
- Auth/API: Exempt `/api/v1/metrics` from authentication so Prometheus scrapes succeed out of the box (#1409)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Step-level Docker executor entrypoint fix (#1403) | [@vnghia](https://github.com/vnghia) |
| Status label rename to `aborted` | [@ghansham](https://github.com/ghansham) |
| Health endpoint access report (#1404) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| OIDC init panic report (#1407) | [@alangrafu](https://github.com/alangrafu) |
| Metrics auth bypass report (#1409) | [@jeremydelattre59](https://github.com/jeremydelattre59) |

## v1.24.2

### Added

- Executors: Added a `raw` output option to the JQ executor for emitting unquoted strings and primitives (#1392)
- Installer: Added a `--working-dir` flag to place temporary files outside `/tmp`, useful on constrained systems (#1388)
- Spec: Resolve parameter schema references relative to the process cwd, declared `working_dir`, or the DAG file location so JSON Schema files can be co-located with DAGs (#1371)

### Fixed

- UI: Ensure repeat-policy sub DAG run lists refresh their timestamps and counts without needing a window refocus by polling `/sub-dag-runs` while expanded (#1389)
- Spec/UI: Stabilize default parameter ordering so Start DAG modal fields stay in place while editing (#1395)
- OIDC: Automatically clear expired dashboard cookies and restart the auth flow so stale tokens no longer block the UI after restarts (#1394)

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| JQ executor raw output option (#1392) | [@kriyanshii](https://github.com/kriyanshii) |
| Repeat execution timestamp refresh report (#1389) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Parameter field reorder report (#1395) | [@mitchplze](https://github.com/mitchplze) |
| OIDC dashboard lock-out report (#1394) | [@mitchplze](https://github.com/mitchplze) |
| Param schema resolution & skip validation option (#1371) | [@thefishhat](https://github.com/thefishhat) |
| Installer working directory flag request (#1388) | [@jeremydelattre59](https://github.com/jeremydelattre59) |

## v1.24.0 (2025-11-03)

### Added

- API: Added optional `dagName` field to `/dags/{fileName}/start` and `/dags/{fileName}/enqueue` for overriding the DAG name used at runtime (#1365)
- API: Added `GET /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs` endpoint to retrieve timing and status information for all sub DAG runs, useful for tracking repeated executions of sub DAG steps (#1041)
- UI: Enhanced sub DAG run display with execution timeline showing datetime, status indicators, and lazy loading of execution details (#1041)
- API: Added `POST /api/v1/dag-runs/{name}/{dagRunId}/reschedule` endpoint for replaying runs while enforcing singleton mode to block reschedules when the DAG already has active or queued runs (#1347)
- API: Added `POST /api/v1/dag-runs/enqueue` to enqueue DAG-runs directly from inline YAML specs without creating DAG files, including optional queue overrides (#1375)
- CLI: Added `--from-run-id` flag to `dagu start` for cloning historic runs with their saved parameters (#1378)
- CLI: Added `dagu exec` command to run shell commands without writing YAML files, with full logging, history, environment control, and queue support (#1348)
- UI: Added grouped view with preset and specific date range selectors on the DAG-runs page for faster historical exploration (#1377)
- Executors: Added an archive executor (`type: archive`) with extract, create, and list operations

### Improved

- UI: Persisted DAG/queue/search filters across navigation using a remote-aware search state provider so bookmarked URLs and session filters stay aligned (#1379)

### Fixed

- Windows: Restored queued DAG execution by exporting the necessary environment variables when spawning processes from the queue runner (#1373)
- UI: Fixed DAG rendering while zooming out (#1380)
- Server/API: Run command/env substitution for base paths and auth credentials when wiring routes, keeping originals only if evaluation fails and logging a warning

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| `--name` flag feature clarification and feedback (#1349) | [@ghansham](https://github.com/ghansham) |
| Repeat execution timeline enhancements feature request (#1041) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Serial number ordering feedback and suggestion (#1041) | [@ghansham](https://github.com/ghansham) |
| Singleton reschedule guard feedback (#1347) | [@hamadayouta](https://github.com/hamadayouta) |
| Windows queue execution failure report and verification (#1372) | [@lvoeg](https://github.com/lvoeg) |
| `--from-run-id` flag co-author (#1378) | [@kriyanshii](https://github.com/kriyanshii) |
| Inline spec enqueue implementation (#1375) | [@kriyanshii](https://github.com/kriyanshii) |
| DAG zoom out rendering fix (#1380) | [@kriyanshii](https://github.com/kriyanshii) |

## v1.23.3 (2025-10-26)

### Added

- CLI: Added `--name` flag to `start`, `retry`, and `enqueue` commands to override the DAG name specified in the YAML file (#1363)
- DAG: Support shell-like parameter expansion for `env` and `parameters` fields, including `${VAR:offset:length}` slices and shell-style defaults (`${VAR:-fallback}`) (#1354)
- Distributed: Added comprehensive Kubernetes deployment manifests with ConfigMaps, PVCs, and separate server/worker deployments (#1360)
- Distributed: Added automatic cleanup of stale coordinator service registrations (#1360)
- Distributed: Added retry mechanism with exponential backoff for coordinator client connections (#1360)

### Improved

- Distributed: Enhanced distributed execution with better worker coordination and status propagation (#1360)
- Distributed: Improved child DAG status propagation in distributed mode to correctly report final status to parent workflows (#1358)
- OIDC: Improved OIDC configuration validation with better error messages and logging (#1361)
- OIDC: Enhanced OIDC authentication flow with proper state management and error handling (#1361)
- API: Better error handling in API endpoints with more descriptive error messages (#1361)

### Fixed

- Distributed: Fixed child DAG status not being properly propagated to parent in distributed execution (#1358)
- Distributed: Fixed parallel execution status tracking for sub-DAGs (#1358)
- Distributed: Fixed service registry cleanup and stale entry detection (#1360)

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| OIDC authentication broken interface issue report (#1359) | [@mitchplze](https://github.com/mitchplze) |
| Distributed execution lock issue on Kubernetes (#1353) | [@yangkghjh](https://github.com/yangkghjh) |
| Shell-like parameter expansion feature request (#1352) | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.23.2...v1.23.3](https://github.com/dagu-org/dagu/compare/v1.23.2...v1.23.3)

## v1.23.2 (2025-10-22)

### Fixed

- Server: Fixed subprocess environment variable propagation - server now correctly passes environment variables to subprocesses (#1351)

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| DAG manual launch bug report and detailed reproduction (#1345) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| WebUI blank page MIME type error report (#1350) | [@overflowy](https://github.com/overflowy) |

**Full Changelog**: [v1.23.1...v1.23.2](https://github.com/dagu-org/dagu/compare/v1.23.1...v1.23.2)

## v1.23.1 (2025-10-21)

### Documentation

- Updated GitHub Actions executor documentation

### Contributors

No external contributors for this release - documentation update only.

**Full Changelog**: [v1.23.0...v1.23.1](https://github.com/dagu-org/dagu/compare/v1.23.0...v1.23.1)

## v1.23.0 (2025-10-21)

### Changed

- Status: Adopted canonical lowercase tokens for DAG and node lifecycle states (`not_started`, `queued`, `running`, `succeeded`, `partially_succeeded`, `failed`, `canceled`), and updated API examples, docs, and telemetry labels to match.
- Security: Implemented security filtering for system environment variables passed to step processes and sub DAGs. System variables remain available for expansion (`${VAR}`) during DAG configuration parsing, but only whitelisted variables (`PATH`, `HOME`, `LANG`, `TZ`, `SHELL`) and variables with allowed prefixes (`DAGU_*`, `LC_*`, `DAG_*`) are passed to the step execution environment. This prevents accidental exposure of sensitive credentials to subprocess environments. Other variables must be explicitly defined in the workflow's `env` section to be available in step processes.
- Scheduler: Queue handler now processes items asynchronously, acknowledging work before heartbeat checks so long-running startups no longer starve the queue.
- Runtime: Subcommand execution inherits the filtered base environment and uses the caller's working directory.

### Added

- CLI: Added `--dagu-home` global flag to override the application home directory on a per-command basis. Useful for testing, running multiple instances with isolated data, and CI/CD scenarios.
- CLI: Added `dagu validate` command to validate DAG specifications without executing them. Prints human‑readable errors and exits with code 1 on failure.
- API: Added `POST /api/v1/dags/validate` to validate DAG YAML. Returns `{ valid: boolean, errors: string[], dag?: DAGDetails }`.
- API: `POST /api/v1/dags` now accepts optional `spec` to initialize a DAG. The spec is validated before creation and returns 400 on invalid input.
- API: Added `POST /api/v1/dag-runs` to create and start a DAG-run directly from an inline YAML `spec` without persisting a DAG file. Supports optional `name`, `params`, `dagRunId`, and `singleton`.
- API: Added `nextRun` sort option to `GET /api/v1/dags` to sort DAGs by their next scheduled run time. DAGs with earlier next runs appear first in ascending order, and DAGs without schedules appear last.
- Steps: Add support for shebang detection in `script`.
- Steps: Multi-line `command` strings now execute as inline scripts, including support for shebang.
- DAG: Introduced a `secrets` block that references external providers (built-in `env` and `file`) and resolves values at runtime with automatic log/output masking.
- Parameters: Added JSON Schema validation mode with `schema`.
- Runtime: Injects `DAG_RUN_STATUS` into handler environments so exit/success/failure/cancel scripts can branch on the final canonical status.
- Executors: Added an experimental GitHub Actions executor (`type: gha`) powered by nektos/act; action inputs come from the new step-level `params` map.
- UI: Added accordion-style expandable node rows to display step logs inline, similar to GitHub Actions, reducing the need to open popup windows (#1313).

### Fixed

- DAG name validation is centralized and enforced consistently: names must be `<= 40` chars and match `[A-Za-z0-9_.-]+`. Endpoints that accept `name` now return `400 bad_request` for invalid names.
- Docker: Fixed container initialization bug with `registry_auths` field (#1330)
- Windows: Fixed process cancellation not terminating subprocesses by recursively killing all child processes (#1342)
- UI: Fixed duration display update bug in DAG run details
- Other small issues and improvements

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Docker-in-Docker container execution issues (#1228, #1231, #1235) and registry_auths bug report (#1327) | [@bellackn](https://github.com/bellackn) |
| Container name support (#1237), bash requirement (#1239), command field (#1261), log buttons (#1301), and scroll issues (#1324) | [@Pangolin2097](https://github.com/Pangolin2097) |
| Accordion-style log expansion feature request (#1313) | [@borestad](https://github.com/borestad) |
| SSH environment variables feature request (#1238) | [@n3storm](https://github.com/n3storm) |
| SSH config override issue report (#1249) | [@TrezOne](https://github.com/TrezOne) |
| DAG dependency resolution error report (#1262) | [@JuchangGit](https://github.com/JuchangGit) |
| Quickstart guide issue report (#1263) | [@Vad1mo](https://github.com/Vad1mo) |
| Parallel JSON execution issues (#1274) | [@tetedange13](https://github.com/tetedange13) |
| Grouped DAGs mobile UI bug report (#1294) | [@jarnik](https://github.com/jarnik) |
| Cleanup and status propagation feature request (#1305) | [@vnghia](https://github.com/vnghia) |
| Environment variables behavior bug report (#1320) | [@thibmart1](https://github.com/thibmart1) |
| System status UI issue report (#1224) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Script execution error (#1203) and stop-all API feature request (#1211) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Dotenv loading bug report (#1210) | [@don-philipe](https://github.com/don-philipe) |
| Script field issue report (#1334) | [@xinxinxinye](https://github.com/xinxinxinye) |
| Queue override implementation (#1240) and clear queue feature (#1298, #1299) | [@kriyanshii](https://github.com/kriyanshii) |
| JSON Schema validation for params implementation (#1273) | [@thefishhat](https://github.com/thefishhat) |
| SSH script validation implementation (#1308) | [@AdityaTel89](https://github.com/AdityaTel89) |
| README updates (#1326), unit tests (#1329), and legacy directory warning (#858, #1336) | [@arky](https://github.com/arky) |
| Windows process cancellation fix with recursive subprocess termination (#1207, #1342) | [@lvoeg](https://github.com/lvoeg) |
| Extensive troubleshooting and community support: container name (#1237), SSH environment variables (#1238), DAG dependency resolution (#1262), cleanup and status propagation (#1305), environment variables behavior (#1320), clear queue feature (#1298), Docker-in-Docker (#1235), and CLI/masking discussions (#1314, #1317, #1273) | [@ghansham](https://github.com/ghansham) |

## v1.22.0 (2025-08-24)

### New Features

- Shorthand Step Syntax: Added simplified step definition without requiring explicit name and command fields (#1206)

  ```yaml
  steps:
    - echo "hello"
  ```

  Equivalent to:

  ```yaml
  steps:
    - id: step_1
      command: echo "hello"
  ```

- Working Directory Support: Added DAG-level and step-level working directory configuration with inheritance for better file path management
- Load Environment Support: Enhanced environment variable loading capabilities with improved dotenv support
- Queue Dashboard UI: Complete queue management interface with visual feedback and improved user experience (#1217)
- DAG Name Input Modal: Improved UI for DAG name input and management with better validation (#1218)
- Max Active Runs Enforcement: DAG-level `max_active_runs` configuration enforcement in API and CLI when starting DAG-runs (#1214) - Thanks to [@ghansham](https://github.com/ghansham) for feedback
- Queue Configuration Rename: Renamed `queue.max_active_runs` to `queue.maxConcurrency` for clarity and consistency (#1215)

### Improvements

- Directory Lock Management: Improved directory lock and active process management for better reliability and reduced race conditions (#1202)
- Empty Directory Cleanup: Automatic removal of empty directories for proc and queue management to keep storage clean (#1208)
- Default Start Command: Made 'start' the default command, removing single flag requirement for better CLI usability
- Max Active Runs Logic: Enhanced check logic for `max_active_runs` configuration with improved validation (#1216)
- Queue UI Enhancements: Applied user feedback to improve queue UI usability and functionality (#1221, #1222)

### Bug Fixes

- Script Execution: Fixed script block execution that was failing with script parsing errors (#1204) - Thanks to [@Kaiden0001](https://github.com/Kaiden0001) for reporting the issue
- Parallel Execution: Fixed parallel execution parameter handling for JSON references and complex data structures (#1219) - Thanks to [@tetedange13](https://github.com/tetedange13) for reporting the issue

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Script execution bug report (command not found error) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Parallel execution with JSON references issue report | [@tetedange13](https://github.com/tetedange13) |
| Queue feature implementation feedback | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.21.0...v1.22.0](https://github.com/dagu-org/dagu/compare/v1.21.0...v1.22.0)

## v1.21.0 (2025-08-17)

### New Features

- Optional Step Names: Made step names optional to remove the 40-character limit restriction, allowing more flexibility in workflow definitions (#1193) - Thanks to [@jonathonc](https://github.com/jonathonc) for raising the issue
- Singleton DAG Execution: Added `--singleton` flag to ensure only one instance of a DAG runs at a time, preventing duplicate executions (#1195) - Thanks to [@Kaiden0001](https://github.com/Kaiden0001) for the feature request
- DAG-level SSH Configuration: Implemented DAG-level SSH config for better control over remote executions across all steps (#1184)
- Example DAGs for New Users: Auto-create example DAGs when starting Dagu for the first time, helping new users get started quickly (#1190)
- DAG-run Details Refresh: Added refresh button to the DAG-run details page for immediate status updates (#1192)
- Invalid DAG Handling: Improved UI handling of invalid DAG configurations with better error messages and graceful degradation (#1186)

### Improvements

- Queue Directory Management: Ensure queue directory is created before starting file watch to prevent startup errors (#1191)
- Coordinator Hostname Resolution: Register configured hostname instead of resolved IP in coordinator.json for better network configuration (#1188) - Thanks to [@peterbuga](https://github.com/peterbuga) for reporting and proposing the solution

### Documentation

- Examples Update: Updated and cleaned up example DAGs to reflect current best practices (#1185)
- Architecture Documentation: Updated architecture diagrams and documentation

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Optional step names feature request (40 char limit issue) | [@jonathonc](https://github.com/jonathonc) |
| Singleton flag feature request (split start API) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Coordinator hostname resolution issue and solution | [@peterbuga](https://github.com/peterbuga) |

**Full Changelog**: [v1.20.0...v1.21.0](https://github.com/dagu-org/dagu/compare/v1.20.0...v1.21.0)

## v1.20.0 (2025-08-10)

### New Features

- DAG Run Configuration: Added ability to lock parameters and run ID in DAG configuration for controlled execution (#1176) - Thanks to [@kriyanshii](https://github.com/kriyanshii)
- System Status UI: Added comprehensive system health monitoring for scheduler and coordinator services (#1177)
- Manual Refresh Controls: Added refresh buttons to Dashboard, DAG-runs, and DAG-definitions pages for immediate data updates (#1178)
- Immediate Execution Option: Added checkbox to start DAGs immediately, bypassing the queue for urgent workflows (#1171)
- Feedback Integration: Added feedback button to sidebar with Web3Forms integration for better user communication (#1173)
- Community Link: Added Discord community link to navigation sidebar for easier access to support (#1175)
- Auto-Navigation: Automatically navigate to DAG-run detail page after starting or enqueuing a DAG (#1172)

### Improvements

- Queue Management: Refactored process store to use hierarchical directory structure, separating group names (queues) from DAG names for better organization (#1174)
- Scheduler Timeout Handling: Fixed scheduler queue reader to discard items when DAG runs don't become active within 10 seconds, preventing queue stacking (#1169) - Thanks to [@jrisch](https://github.com/jrisch) for reporting

### Bug Fixes

- Status Display: Fixed DAG header showing "0" instead of "not started" for DAGs that haven't been executed (#1168)

### Documentation

- Roadmap: Updated project roadmap with latest development priorities

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| DAG run configuration with parameter locking | [@kriyanshii](https://github.com/kriyanshii) |
| Timeout issues report and feedback | [@jrisch](https://github.com/jrisch) |

**Full Changelog**: [v1.19.0...v1.20.0](https://github.com/dagu-org/dagu/compare/v1.19.0...v1.20.0)

## v1.19.0 (2025-08-06)

### New Features

- DAG-level Container Field: Added support for running all steps in a single container with DAG-level container configuration (#1154)
- Zombie DAG Detection: Added automatic detection and cleanup of zombie DAG runs with configurable detection interval (#1163) - Thanks to [@jonasban](https://github.com/jonasban) for feedback
- Container Registry Authentication: Added support for pulling images from private registries with username/password and token-based authentication (#1165) - Thanks to [@vnghia](https://github.com/vnghia) for the feature request

### Improvements

- Scheduler Health Check: Fixed health check server startup to work correctly with multiple scheduler instances (#1157) - Thanks to [@jonasban](https://github.com/jonasban) for reporting
- Stop Operation: Fixed stop operation to properly handle multiple running instances of the same DAG (#1167) - Thanks to [@jeremydelattre59](https://github.com/jeremydelattre59) for reporting
- Scheduler Queue Processing: Fixed scheduler to use heartbeat monitoring instead of status files for more reliable process detection (#1166) - Thanks to [@jrisch](https://github.com/jrisch) for feedback
- Environment Variables: Corrected environment variable mapping for coordinator host and port configuration (#1162)
- Docker Permissions: Ensured DAGU_HOME directory has proper permissions in Docker containers (#1161)

### Bug Fixes

- Continue On Skipped: Fixed exit code 0 incorrectly triggering continuation for skipped steps with repeat policies (#1158) - Thanks to [@jeremydelattre59](https://github.com/jeremydelattre59) for reporting and [@thefishhat](https://github.com/thefishhat) for the fix
- Queue Processing: Fixed process store to correctly use queue name when specified (#1155) - Thanks to [@jonasban](https://github.com/jonasban) and [@ghansham](https://github.com/ghansham) for reporting

### Documentation

- Docker Compose Example: Added example configuration for Docker Compose setup
- Roadmap: Updated project roadmap based on general features

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Zombie DAG detection feedback, health check and queue processing bug reports | [@jonasban](https://github.com/jonasban) |
| Continue on skipped bug report, stop operation issue report | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Exit code continuation fix | [@thefishhat](https://github.com/thefishhat) |
| Queue processing bug report | [@ghansham](https://github.com/ghansham) |
| Container registry authentication feature request | [@vnghia](https://github.com/vnghia) |
| Scheduler heartbeat monitoring feedback | [@jrisch](https://github.com/jrisch) |

**Full Changelog**: [v1.18.6...v1.19.0](https://github.com/dagu-org/dagu/compare/v1.18.6...v1.19.0)

## v1.18.6 (2025-08-03)

### Bug Fixes

- Scheduler: Fixed health check server startup race condition when multiple scheduler instances are deployed (#1157) - Thanks to [@jonasban](https://github.com/jonasban) for reporting

### Improvements

- Node.js: Upgraded to Node.js 22 (#1150) - Thanks to [@reneleonhardt](https://github.com/reneleonhardt)

### New Features

- npm Package Verification: Added automatic verification after npm package publishing (#1149)
- npm Installation: Added support for installing Dagu via npm

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Health check race condition (report) | [@jonasban](https://github.com/jonasban) |
| Upgraded Node.js to 22 | [@reneleonhardt](https://github.com/reneleonhardt) |

**Full Changelog**: [v1.18.0...v1.18.6](https://github.com/dagu-org/dagu/compare/v1.18.5...v1.18.6)

## v1.18.0 (2025-07-29)

### New Features

- Step-level Environment Variables: Added support for environment variables at the step level (#1148) - Thanks to [@admerzeau](https://github.com/admerzeau) for reporting
- Enhanced Repeat Policy: Added explicit `until` and `while` modes for clearer repeat logic (#1050) - Thanks to [@thefishhat](https://github.com/thefishhat)
- Live Log Loading: Added real-time log streaming in the Web UI with reload button (#1085) - Thanks to [@tapir](https://github.com/tapir) for reporting
- Exponential Backoff for RetryPolicy: Added support for exponential backoff in retry policies (#1096, #1093) - Thanks to [@Sarvesh-11](https://github.com/Sarvesh-11)
- OpenID Connect (OIDC) Authentication: Added OIDC support for Web UI authentication (#1107) - Thanks to [@Arvintian](https://github.com/Arvintian)
- Partial Success Status: Added step-level partial success status for sub-DAG executions (#1115) - Thanks to [@ghansham](https://github.com/ghansham) for the feature request
- Distributed Workflow Execution: Implemented distributed task execution via worker processes (#1116, #1145)
- Multiple Email Recipients: Added support for multiple recipients in email notifications (#1125)
- High Availability Support: Added redundant scheduler support for high availability (#1147)
- TLS/mTLS Support: Added TLS/mTLS support for coordinator service
- Scheduler Health Check: Added health check endpoint for scheduler monitoring (#1129) - Thanks to [@jonasban](https://github.com/jonasban) for the feature request
- Default DAG Sorting Configuration: Added configuration for default DAG list sorting (#1135)
- GitHub Repository Link: Added GitHub repository link to sidebar
- npm Installation Support: Added global npm package for easy cross-platform installation via `npm install -g @dagu-org/dagu`

### Improvements

- Output Capture: Fixed maximum size setting for output capture
- Web UI Sidebar: Replaced automatic hover with manual toggle control, added persistence (#1121) - Thanks to [@ghansham](https://github.com/ghansham) for feedback
- DAG Sorting: Moved sorting logic from frontend to backend for proper pagination (#1123, #1134) - Thanks to [@ghansham](https://github.com/ghansham) for reporting
- Dependency Upgrades: Updated multiple dependencies (#1127) - Thanks to [@reneleonhardt](https://github.com/reneleonhardt)
- Duration Display: Fixed invalid date display in duration fields (#1137)
- Orphaned DAG Handling: Fixed handling of orphaned running DAGs after unexpected restarts (#1122)
- Log File Migration: Fixed log file path migration from legacy format (#1124)
- Pagination: Fixed hardcoded pagination limit (#1126)
- DAG State Preservation: Preserve previous DAG state when dequeuing (#1118)

### Bug Fixes

- Installation Script: Fixed installer script issues (#1091) - Thanks to [@Sarvesh-11](https://github.com/Sarvesh-11)
- DAG List Sorting: Fixed sort key issue in DAG list (#1134) - Thanks to [@ghansham](https://github.com/ghansham) for reporting
- Next Run Display: Fixed next run display for timezones (#1138)

### Documentation

- OIDC Documentation: Added comprehensive OIDC authentication documentation
- Heartbeat Interval: Documented heartbeat interval behavior

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| Installation script fixes, exponential backoff for retry policies | [@Sarvesh-11](https://github.com/Sarvesh-11) |
| Dependency upgrades | [@reneleonhardt](https://github.com/reneleonhardt) |
| Enhanced repeat policy with while/until modes | [@thefishhat](https://github.com/thefishhat) |
| OIDC authentication implementation | [@Arvintian](https://github.com/Arvintian) |
| Step-level environment variables feature request | [@admerzeau](https://github.com/admerzeau) |
| Live log loading feature request | [@tapir](https://github.com/tapir) |
| Partial success status request, DAG sorting issue, sidebar improvements | [@ghansham](https://github.com/ghansham) |
| Scheduler health check feature request | [@jonasban](https://github.com/jonasban) |

### New Contributors

- [@Sarvesh-11](https://github.com/Sarvesh-11) made their first contribution in [PR 1091](https://github.com/dagu-org/dagu/pull/1091)
- [@reneleonhardt](https://github.com/reneleonhardt) made their first contribution in [PR 1127](https://github.com/dagu-org/dagu/pull/1127)

**Full Changelog**: [v1.17.4...v1.18.0](https://github.com/dagu-org/dagu/compare/v1.17.4...v1.18.0)

## v1.17.4 (2025-06-30)

### New Features

- Interactive DAG Selection: Run `dagu start` without arguments to select DAGs interactively (#1074)
- Bubble Tea Progress Display: Replaced ANSI progress display with Bubble Tea TUI framework
- OpenTelemetry Support: Added distributed tracing with W3C trace context propagation (#1068)
- Windows Support: Initial Windows compatibility with PowerShell and cmd.exe (#1066)

### Improvements

- Scheduler Refactoring: Cleaned up scheduler code for better maintainability (#1062)
- Error Handling: Handle corrupted status files in scheduler queue processing

### Bug Fixes

- UI: Fixed 'f' key triggering fullscreen mode while editing DAGs (#1075)
- SSH Executor: Fixed handling of `||` and `&&` operators in command parsing (#1067)
- JSON Schema: Corrected DAG JSON schema for schedule field (#1071)
- Scheduler: Fixed scheduler discarding queued items when scheduled by `enqueue` (#1070)
- Base DAG: Fixed parameter parsing issue in base DAG loading

### Documentation

- Updated CLI documentation for interactive DAG selection
- Added OpenTelemetry configuration examples
- Fixed configuration documentation to match implementation
- Added missing feature pages to sidebar

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| Initial Windows support - PowerShell/cmd.exe compatibility | [@pdoronila](https://github.com/pdoronila) |
| Scheduler refactoring for improved maintainability | [@thefishhat](https://github.com/thefishhat) |
| Interactive DAG selection feature request | [@yottahmd](https://github.com/yottahmd) |
| OpenTelemetry distributed tracing feature request | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| SSH executor double pipe operator (report) | [@NebulaCoding1029](https://github.com/NebulaCoding1029) |
| 'f' key interference in DAG editor (report) | [@NebulaCoding1029](https://github.com/NebulaCoding1029) |
| Log cleanup feature request | [@NebulaCoding1029](https://github.com/NebulaCoding1029) |
| Scheduler queue bug (report) | Jochen |

## v1.17.3 (2025-06-25)

### New Features

- HTTP Executor: Added `skipTLSVerify` option to support self-signed certificates (#1046)

### Bug Fixes

- Configuration: Fixed DAGU_DAGS_DIR environment variable not being recognized (#1060)
- SSH Executor: Fixed stdout and stderr streams being incorrectly merged (#1057)
- Repeat Policy: Fixed nodes being marked as failed when using repeat policy with non-zero exit codes (#1052)
- UI: Fixed retry individual step functionality for remote nodes (#1049)
- Environment Variables: Fixed environment variable evaluation and working directory handling (#1045)
- Dashboard: Prevented full page reload on date change and fixed invalid date handling (commit 58ad8e44)

### Documentation

- Repeat Policy: Corrected documentation and examples to accurately describe behavior (#1056)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| HTTP executor skipTLSVerify feature | [@mnmercer](https://github.com/mnmercer) (report), [@nightly-brew](https://github.com/nightly-brew) (feedback) |
| DAGU_DAGS_DIR environment variable fix | [@Daffdi](https://github.com/Daffdi) (report) |
| SSH executor stdout/stderr separation | [@NebulaCoding1029](https://github.com/NebulaCoding1029) (report) |
| Repeat policy bug fixes and documentation | [@jeremydelattre59](https://github.com/jeremydelattre59) (reports) |
| Retry individual step UI fix | [@jeremydelattre59](https://github.com/jeremydelattre59) (report), [@thefishhat](https://github.com/thefishhat) (implementation) |
| Environment variable evaluation fixes | [@jhuang732](https://github.com/jhuang732) (report) |

## v1.17.2 (2025-06-20)

### Bug Fixes

- HTTP Executor: Fixed output not being written to stdout (#1042) - Thanks to [@nightly-brew](https://github.com/nightly-brew) for reporting

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| HTTP executor output capture fix | [@nightly-brew](https://github.com/nightly-brew) (report) |

## v1.17.1 (2025-06-20)

### New Features

- One-click Step Re-run: Retry an individual step without touching the rest of the DAG (#1030)
- Nested-DAG Log Viewer: See logs for every repeated sub run instead of only the last execution (#1029)

### Bug Fixes

- Docker: Fixed asset serving with base path and corrected storage volume locations (#1037)
- Docker: Updated Docker storage paths from `/dagu` to `/var/lib/dagu`
- Steps: Support camel case for step exit code field (#1031)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| One-click Step Re-run – retry an individual step without touching the rest of the DAG | 🛠️ [@thefishhat](https://github.com/thefishhat) |
| Nested-DAG Log Viewer – see logs for every repeated sub run | 💡 [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Docker image polish – fixes for asset paths & storage volumes | 🐳 [@jhuang732](https://github.com/jhuang732) (report) |

## v1.17.0 (2025-06-18)

### Major Features

#### Improved Performance

- Refactored execution history data for more performant history lookup
- Optimized internal data structures for better scalability

#### Hierarchical DAG Execution

Execute nested DAGs with full parameter passing and output bubbling:

```yaml
steps:
  - id: run_sub_dag
    run: sub-dag
    output: OUT
    params: "INPUT=${DATA_PATH}"

  - id: use_output
    command: echo ${OUT.outputs.RESULT}
```

#### Multiple DAGs in Single File

Define multiple DAGs in one YAML file using `---` separator:

```yaml
name: main-workflow
steps:
  - id: process
    run: sub-workflow  # Defined below

---

name: sub-workflow
steps:
  - id: task
    command: echo "Hello from sub-workflow"
```

#### Parallel Execution with Parameters

Execute commands or sub-DAGs in parallel with different parameters for batch processing:

```yaml
steps:
  - id: get_files
    command: find /data -name "*.csv"
    output: FILES

  - id: process_files
    run: process-file
    parallel: ${FILES}
    params:
      - FILE_NAME: ${ITEM}
```

#### Enhanced Web UI

- Overall UI improvements with better user experience
- Cleaner design and more intuitive navigation
- Better performance for large DAG visualizations

#### Advanced History Search

New execution history page with:

- Date-range filtering
- Status filtering (success, failure, running, etc.)
- Improved search performance
- Better timeline visualization

#### Better Debugging

- Precondition Results: Display actual results of precondition evaluations in the UI
- Output Variables: Show output variable values in the UI for easier debugging
- Separate Logs: stdout and stderr are now separated by default for clearer log analysis

#### Queue Management

Added enqueue functionality for both API and UI:

```bash
# Queue a DAG for later execution
dagu enqueue --run-id=custom-id my-dag.yaml

# Dequeue
dagu dequeue default
```

#### Partial Success Status

New "partial success" status for workflows where some steps succeed and others fail, providing better visibility into complex workflow states.

#### API v2

- New `/api/v1` endpoints with refactored schema
- Better abstractions and cleaner interfaces
- Improved error handling and response formats
- See [OpenAPI spec](https://github.com/dagu-org/dagu/blob/main/api/v1/api.yaml) for details

### Docker Improvements

#### Optimized Images

Thanks to @jerry-yuan:

- Significantly reduced Docker image size
- Split into three baseline images for different use cases
- Better layer caching for faster builds

#### Container Enhancements

Thanks to @vnghia:

- Allow specifying container name
- Support for image platform selection
- Better container management options

### Enhanced Features

#### Advanced Repeat Policy

Thanks to @thefishhat:

- Enhanced in v1.17.5: Explicit 'while' and 'until' modes for clear repeat logic
- Conditions for repeat execution
- Expected output matching  
- Exit code-based repeats

```yaml
steps:
  - id: wait_for_service
    command: check_service.sh
    repeat_policy:
      repeat: until        # NEW: Explicit mode (while/until)
      condition: "${STATUS}"
      expected: "ready"    # Repeat UNTIL status is ready
      interval_sec: 30
      limit: 60           # Maximum attempts

  - id: monitor_process
    command: pgrep myapp
    repeat_policy:
      repeat: while       # Repeat WHILE process exists
      exit_code: [0]       # Exit code 0 means found
      interval_sec: 10
```

### Bug Fixes & Improvements

- Fixed history data migration issues
- Improved error messages and logging
- Better handling of edge cases in DAG execution
- Performance improvements for large workflows
- Various UI/UX enhancements: #925, #898, #895, #868, #903, #911, #913, #921, #923, #887, #922, #932, #962

### Breaking Changes

#### DAG Type Field (v1.17.0-beta.13+)

Starting from v1.17.0-beta.13, DAGs now have a `type` field that controls step execution behavior:

- **`type: chain`** (new default): Steps are automatically connected in sequence, even if no dependencies are specified
- **`type: graph`** (previous behavior): Steps only depend on explicitly defined dependencies

To maintain the previous behavior, add `type: graph` to your DAG configuration:

```yaml
type: graph
steps:
  - id: task1
    command: echo "runs in parallel"
  - id: task2
    command: echo "runs in parallel"
```

Alternatively, you can explicitly set empty dependencies for parallel steps:

```yaml
type: graph
steps:
  - id: task1
    command: echo "runs in parallel"
    depends: []
  - id: task2
    command: echo "runs in parallel"
    depends: []
```

### Migration Required

 **History Data Migration**: Due to internal improvements, history data from 1.16.x requires migration:

```bash
# Migrate history data
dagu migrate history
```

After successful migration, legacy history directories are moved to `<DAGU_DATA_DIR>/history_migrated_<timestamp>` for safekeeping.

### Contributors

Huge thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| Optimized Docker image size and split into baseline images | [@jerry-yuan](https://github.com/jerry-yuan) |
| Container name & image platform support | [@vnghia](https://github.com/vnghia) |
| Enhanced repeat-policy conditions | [@thefishhat](https://github.com/thefishhat) |
| Queue functionality implementation | [@kriyanshii](https://github.com/kriyanshii) |
| Partial success status | [@thefishhat](https://github.com/thefishhat) |
| Countless reviews & feedback | [@ghansham](https://github.com/ghansham) |

### Installation

Try the beta version:

```bash
# Docker
docker run --rm -p 8080:8080 ghcr.io/dagu-org/dagu:latest dagu start-all

# Or download specific version
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash -s -- --version v1.17.0-beta
```

---

## v1.16.0 (2025-01-09)

### New Features

#### Enhanced Docker Image

- Base image updated to `ubuntu:24.04`
- Pre-installed common tools: `sudo`, `git`, `curl`, `jq`, `python3`, and more
- Ready for production use with essential utilities

#### Dotenv File Support

Load environment variables from `.env` files:

```yaml
dotenv: /path/to/.env
# or multiple files
dotenv:
  - .env
  - .env.production
```

#### 🔗 JSON Reference Expansion

Access nested JSON values with path syntax:

```yaml
steps:
  - id: sub_workflow
    run: sub_workflow
    output: SUB_RESULT
  - id: use_output
    command: echo "The result is ${SUB_RESULT.outputs.finalValue}"
```

If `SUB_RESULT` contains:

```json
{
  "outputs": {
    "finalValue": "success"
  }
}
```

Then `${SUB_RESULT.outputs.finalValue}` expands to `success`.

#### Advanced Preconditions

**Regex Support**: Use `re:` prefix for pattern matching:

```yaml
steps:
  - id: some_step
    command: some_command
    preconditions:
      - condition: "`date '+%d'`"
        expected: "re:0[1-9]"  # Run only on days 01-09
```

**Command Preconditions**: Test conditions with commands:

```yaml
steps:
  - id: some_step
    command: some_command
    preconditions:
      - command: "test -f /tmp/some_file"
```

#### Enhanced Parameter Support

**List Format**: Define parameters as key-value pairs:

```yaml
params:
  - PARAM1: value1
  - PARAM2: value2
```

**CLI Flexibility**: Support both named and positional parameters:

```bash
# Positional
dagu start my_dag -- param1 param2

# Named
dagu start my_dag -- PARAM1=value1 PARAM2=value2

# Mixed
dagu start my_dag -- param1 param2 --param3 value3
```

#### Enhanced Continue On Conditions

**Exit Code Matching**:

```yaml
steps:
  - id: some_step
    command: some_command
    continue_on:
      exit_code: [1, 2]  # Continue if exit code is 1 or 2
```

**Mark as Success**:

```yaml
steps:
  - id: some_step
    command: some_command
    continue_on:
      exit_code: 1
      mark_success: true  # Mark successful even if failed
```

**Output Matching**:

```yaml
steps:
  - id: some_step
    command: some_command
    continue_on:
      output: "WARNING"  # Continue if output contains "WARNING"
      
  # With regex
  - id: another_step
    command: another_command
    continue_on:
      output: "re:^ERROR: [0-9]+"  # Regex pattern matching
```

#### 🐚 Shell Features

**Piping Support**:

```yaml
steps:
  - id: pipe_example
    command: "cat file.txt | grep pattern | wc -l"
```

**Custom Shell Selection**:

```yaml
steps:
  - id: bash_specific
    command: "echo ${BASH_VERSION}"
    shell: bash

  - id: python_shell
    command: "print('Hello from Python')"
    shell: python3
```

#### Sub-workflow Output

Parent workflows now receive structured output from sub-workflows:

```json
{
  "name": "some_subworkflow",
  "params": "PARAM1=param1 PARAM2=param2",
  "outputs": {
    "RESULT1": "Some output",
    "RESULT2": "Another output"
  }
}
```

#### 🔗 Simplified Dependencies

String format now supported:

```yaml
type: graph
steps:
  - id: first
    command: echo "First"
  - id: second
    command: echo "Second"
    depends: first  # Simple string instead of array
```

### Improvements

- Environment Variable Expansion: Now supported in most DAG fields
- UI Enhancements: Improved DAG visualization for better readability
- Storage Optimization: Reduced state file sizes by removing redundant data

### Bug Fixes

- Fixed: DAGs with dots (`.`) in names can now be edited in the Web UI

### Contributors

Thanks to our contributor for this release:

| Contribution | Contributor |
|--------------|--------|
| Improved parameter handling for CLI - support for both named and positional parameters | [@kriyanshii](https://github.com/kriyanshii) |

---

## Previous Versions

For older versions, please refer to the [GitHub releases page](https://github.com/dagu-org/dagu/releases).

## Version Support

- Current: v1.16.x (latest features and bug fixes)
- Previous: v1.15.x (bug fixes only)
- Older: Best effort support

## Migration Guides

### Upgrading to v1.16.0

Most changes are backward compatible. Key considerations:

1. **Docker Users**: The new Ubuntu base image includes more tools but is slightly larger
2. **Parameter Format**: Both old and new formats are supported
3. **State Files**: Old state files are automatically compatible

### Breaking Changes

None in v1.16.0

## See Also

- [Installation Guide](/getting-started/installation) - Upgrade instructions
- [Configuration Reference](/server-admin/reference) - New configuration options
- [Examples](/writing-workflows/examples) - New feature examples
