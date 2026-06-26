# Community vs Licensed Self-Host

This page compares self-hosted Dagu deployments. It does not compare managed Dagu Cloud servers; managed availability and commercial terms are listed on the [pricing page](https://dagu.sh/pricing).

| Capability | Community self-host | Licensed self-host |
| --- | --- | --- |
| Core workflow engine, Web UI, scheduling, executors, and workers | Included | Included |
| Self-hosted workers | Included. Workers are not licensed separately. | Included. Workers are not licensed separately. |
| API keys | Limited to 2 API keys. | More than 2 API keys. |
| OIDC/SSO login | Requires an active self-host license. | Included when the license enables `sso`. |
| User lifecycle management | Admins can list and inspect users and reset passwords. | Create, update, disable, and delete users when the license enables `rbac`. |
| Audit logs | Requires an active self-host license that enables `audit`. | Included when the license enables `audit`. |
| Web UI notification routing | Requires an active self-host license or trial. | Included with an active self-host license or trial. |
| Incident routing | Requires an active self-host license or trial. | Included with an active self-host license or trial. No separate incident feature claim is required. |
| GitHub Integration | Requires a Dagu Pro self-host license on the target server. | Included for Dagu Pro self-host targets. |

## How License Checks Work

Some self-host features are controlled by explicit license feature claims:

- `sso` enables builtin OIDC/SSO login.
- `rbac` enables creating, updating, disabling, and deleting users.
- `audit` enables audit log access.

Other self-host features use an active-license check instead of a separate feature claim. Incident routing requires an active self-host license or trial, and existing self-host licenses include it without a separate incident claim. Web UI notification routing is documented as requiring an active self-host license or trial.

## Related Pages

- [Builtin Authentication](/server-admin/authentication/builtin)
- [OIDC Authentication](/server-admin/authentication/oidc)
- [Audit Logging](/server-admin/server#audit-logging)
- [Notifications](/web-ui/notifications)
- [Incident Routing](/web-ui/incidents)
- [GitHub Integration](/github-integration/)
- [Pricing](https://dagu.sh/pricing)
