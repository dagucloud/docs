# Multi-Environment Deployments

Run a separate Dagu deployment for each environment when development, staging, and production must have independent execution boundaries. Each deployment can synchronize reviewed workflow definitions from Git while keeping its scheduler, workers, storage, credentials, and runtime configuration separate.

::: warning Do Not Use Workspaces as Environments
[Workspaces](/web-ui/workspaces) organize and authorize workflows inside one Dagu installation. They do not create separate schedulers, local execution environments, coordinators, workers, queues, storage, or Git Sync configurations.
:::

## Reference Architecture

A Dagu deployment is the environment boundary. A deployment can be an all-in-one `dagu start-all` process or a distributed installation with separate server, scheduler, coordinator, and worker processes.

```text
Workflow repository
├── development branch ──> Development Dagu deployment
├── staging branch ──────> Staging Dagu deployment
└── production branch ───> Production Dagu deployment
```

Give every deployment its own:

- Dagu configuration and `DAGU_HOME`, or explicit `paths.*` locations
- scheduler and queue state
- coordinator and worker pool when using distributed execution
- DAG-run history, logs, artifacts, and persistent DAG state
- authentication, users, API keys, and managed secrets
- runtime profiles and profile secrets
- Git Sync configuration and repository credentials
- external URL and network policy

Do not mount the same writable data directory into independent environments. Shared storage is appropriate between processes that belong to one distributed Dagu deployment, but not between development, staging, and production deployments.

## Promote Workflows with Git Sync

[Git Sync](/server-admin/git-sync) distributes DAG definitions from a repository. Use a branch promotion workflow so each deployment advances only after the workflow version has passed the preceding environment.

A typical flow is:

1. Author and validate a workflow in development.
2. Review the change in Git.
3. Promote the reviewed commit to the branch tracked by staging.
4. Validate the workflow and its integrations in staging.
5. Promote the approved commit to the branch tracked by production.

Configure each deployed environment to track its own branch. Staging and production should normally be read-only so workflow edits cannot publish directly from those installations.

```yaml
# Staging config.yaml
git_sync:
  enabled: true
  repository: github.com/acme/workflows
  branch: staging
  push_enabled: false

  auth:
    type: token
    token: ${GITHUB_TOKEN}

  auto_sync:
    enabled: true
    on_startup: true
    interval: 300
```

```yaml
# Production config.yaml
git_sync:
  enabled: true
  repository: github.com/acme/workflows
  branch: production
  push_enabled: false

  auth:
    type: token
    token: ${GITHUB_TOKEN}

  auto_sync:
    enabled: true
    on_startup: true
    interval: 300
```

Use separate, least-privilege repository credentials for each deployment. A read-only deploy credential is sufficient when `push_enabled` is `false`.

Tracking the same moving branch from staging and production removes the promotion boundary: both deployments can receive a change during the same synchronization window. Use distinct promotion branches when changes must soak in staging before production.

## Keep Runtime Configuration Deployment-Local

Git Sync distributes workflow-authoring files. It does not copy deployment state such as managed secrets, runtime profiles, profile values, DAG-run history, or server-side DAG settings.

Provision those resources independently in each deployment:

- Create a `staging` profile in the staging deployment.
- Create a protected `prod` profile in the production deployment.
- Store staging and production credentials only in their respective deployments.
- Configure the effective default runtime profile for scheduled DAGs in each deployment's server-side DAG or workspace settings.

Runtime profiles inject variables and secrets into a run. They are useful for identifying the target context and keeping the DAG YAML portable, but they do not isolate the scheduler, local host, or distributed workers. See [Runtime Profiles](/writing-workflows/runtime-profiles).

## Use Environment-Specific Schedules

The same DAG file can contain schedules for more than one deployment profile:

```yaml
schedule:
  - expression: "30 */2 * * *"
    profile: staging
  - expression: "0 2 * * *"
    profile: prod

steps:
  - run: ./sync-data.sh
```

The `profile` on a schedule entry is an activation filter. The scheduler activates the entry only when it matches the DAG's effective default runtime profile. It does not select or override the profile used by the run. Profile-scoped entries are ignored when the DAG has no default runtime profile.

Unscoped schedule entries are active in every deployment that synchronizes the DAG. Keep a schedule unscoped only when that behavior is intentional. See [Scheduling](/writing-workflows/scheduling#profile-scoped-schedules).

## Configure Execution Independently

Choose local or distributed execution per deployment:

```yaml
# config.yaml
default_execution_mode: distributed
```

For distributed deployments, attach environment-specific labels to workers and use [`worker_selector`](/server-admin/distributed/worker-labels) when a workflow needs a particular capability or location. Workspace labels do not participate in worker selection.

Keep worker credentials and network access limited to the environment. A production worker should not share cloud credentials, database access, or writable filesystems with development or staging workers.

## Access Deployments from One Web UI

[Remote nodes](/server-admin/remote-nodes) let one Dagu Web UI connect to other Dagu deployments. This provides a convenient environment selector without merging their schedulers, workers, storage, or credentials.

```yaml
remote_nodes:
  - name: staging
    api_base_url: https://staging.example.com/api/v1
    auth_type: token
    auth_token: ${STAGING_DAGU_TOKEN}

  - name: production
    api_base_url: https://prod.example.com/api/v1
    auth_type: token
    auth_token: ${PRODUCTION_DAGU_TOKEN}
```

Use a dedicated API key with the minimum required role for each remote connection. Remote nodes improve navigation; the remote deployment remains the authority for authentication, execution, and stored data.

## Deployment Checklist

Before promoting workflows to production, verify that:

- the production deployment has independent storage and credentials
- Git Sync is read-only and tracks the intended promotion branch
- DAG changes have been validated before promotion
- runtime profiles and secrets exist in the target deployment
- scheduled DAGs have the intended effective default profile
- worker labels, network access, and external credentials match the environment
- authentication and TLS are configured for the production endpoint
- backups and retention policies cover production run data and persistent state

## Related Pages

- [Workspaces](/web-ui/workspaces)
- [Git Sync](/server-admin/git-sync)
- [Runtime Profiles](/writing-workflows/runtime-profiles)
- [Remote Nodes](/server-admin/remote-nodes)
- [Distributed Execution](/server-admin/distributed/)
- [Configuration](/server-admin/configuration)
