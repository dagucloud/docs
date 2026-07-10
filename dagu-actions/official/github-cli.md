# GitHub CLI (`github-cli@v1`)

Run GitHub repository, issue, pull request, release, or API automation through `gh`.

- Repository: [`dagucloud/github-cli`](https://github.com/dagucloud/github-cli)
- Runtime owned by the action: `cli/cli@v2.92.0` and `nodejs/node@v22.21.1` through action `tools`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/github-cli`](https://github.com/dagucloud/github-cli).

## Example

```yaml
steps:
  - id: repo
    action: github-cli@v1
    with:
      repo: dagucloud/dagu
      args: ["repo", "view", "--json", "name,description,url"]

  - id: print
    env:
      - REPO_JSON: ${steps.repo.outputs.stdout}
    run: printf '%s\n' "$REPO_JSON"
    depends: repo
```

`args` is passed to `gh` as an argument array, without shell parsing. Do not include the `gh` executable name.

For non-public data or write operations, pass a token through `env`. GitHub CLI reads `GH_TOKEN` or `GITHUB_TOKEN` for GitHub.com, and `GH_ENTERPRISE_TOKEN` or `GITHUB_ENTERPRISE_TOKEN` for GitHub Enterprise Server:

```yaml
secrets:
  - name: GH_TOKEN
    provider: env
    key: GH_TOKEN

steps:
  - id: latest_release
    action: github-cli@v1
    with:
      repo: dagucloud/dagu
      args:
        - api
        - repos/{owner}/{repo}/releases/latest
        - --jq
        - .tag_name
      env:
        GH_TOKEN: ${env.GH_TOKEN}
```

## Inputs

| Field | Description |
|-------|-------------|
| `args` | Required array of GitHub CLI arguments passed to `gh` without shell parsing. |
| `stdin` | Optional text written to `gh` stdin. |
| `env` | Extra environment variables for `gh`, such as `GH_TOKEN`, `GITHUB_TOKEN`, or `GH_ENTERPRISE_TOKEN`. |
| `repo` | Optional `GH_REPO` value in `[HOST/]OWNER/REPO` format. |
| `host` | Optional `GH_HOST` value for GitHub Enterprise or explicit host selection. |
| `workdir` | Optional working directory for `gh`. |
| `timeoutSeconds` | Maximum runtime for the command. Defaults to `300`, max `1800`. |

## Outputs

| Field | Description |
|-------|-------------|
| `ok` | `true` when `gh` exits with status 0. |
| `exitCode` | `gh` exit code. Timeouts use `124`; wrapper validation errors use `-1`. |
| `stdout` / `stderr` | Text written by `gh` to stdout and stderr. |
| `durationMs` | Runtime duration in milliseconds. |
| `ghVersion` | First line of `gh --version`. |
| `timedOut` | `true` when the wrapper terminated `gh` after `timeoutSeconds`. |
| `error` | Wrapper error object when validation or process startup fails. |

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)
