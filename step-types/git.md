# Git

Checkout source repositories from a DAG step without wrapping `git clone` and `git fetch` in shell scripts.

`action: git.checkout` clones the repository when the target path does not exist, or fetches and updates an existing checkout when the target is already a Git repository.

## Basic Usage

```yaml
steps:
  - id: checkout_source
    action: git.checkout
    with:
      repository: https://github.com/example/app.git
      ref: main
      path: ./workspace/app
```

Relative `path` values resolve from the step working directory.

## Checkout the Default Branch

Omit `ref` to checkout the repository default HEAD. On repeated runs against an existing checkout, Dagu fetches `origin` and updates the worktree to the current remote default HEAD.

```yaml
steps:
  - id: checkout_docs
    action: git.checkout
    with:
      repository: https://github.com/example/docs.git
      path: ./repos/docs
```

## Checkout a Branch, Tag, or Commit

`ref` can be a branch name, tag name, remote ref, or commit hash.

```yaml
steps:
  - id: checkout_release
    action: git.checkout
    with:
      repository: https://github.com/example/app.git
      ref: v1.4.2
      path: ./repos/app
```

```yaml
steps:
  - id: checkout_commit
    action: git.checkout
    with:
      repository: https://github.com/example/app.git
      ref: 4f8e4d4a9d81c4f4a7300a2d8e1a1c4f7e3c2b10
      path: ./repos/app
```

The checkout resolves the requested ref to a commit and updates the worktree to that commit.

## Shallow Checkout

Set `depth` to use shallow clone and fetch operations. Use `0` or omit the field for full history.

```yaml
steps:
  - id: checkout_fast
    action: git.checkout
    with:
      repository: https://github.com/example/app.git
      ref: main
      path: ./repos/app
      depth: 1
```

## Authentication

### HTTPS Token

```yaml
secrets:
  - name: GITHUB_TOKEN
    provider: env
    key: GITHUB_TOKEN

steps:
  - id: checkout_private
    action: git.checkout
    with:
      repository: https://github.com/example/private-repo.git
      ref: main
      path: ./repos/private-repo
      token: ${env.GITHUB_TOKEN}
```

### HTTPS Username and Password

```yaml
secrets:
  - name: GIT_PASSWORD
    provider: env
    key: GIT_PASSWORD

steps:
  - id: checkout_with_password
    action: git.checkout
    with:
      repository: https://git.example.com/team/repo.git
      path: ./repos/repo
      username: deploy
      password: ${env.GIT_PASSWORD}
```

### SSH Key

```yaml
steps:
  - id: checkout_over_ssh
    action: git.checkout
    with:
      repository: git@github.com:example/private-repo.git
      ref: main
      path: ./repos/private-repo
      ssh_key_path: /home/dagu/.ssh/deploy_key
```

Use `ssh_passphrase` when the private key is encrypted.
Use `username` when the SSH username is not embedded in the repository URL.

```yaml
steps:
  - id: checkout_over_ssh
    action: git.checkout
    with:
      repository: ssh://git.example.com/example/private-repo.git
      path: ./repos/private-repo
      username: deploy
      ssh_key_path: /home/dagu/.ssh/deploy_key
```

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `repository` | string | Yes | - | Git repository URL or local repository path. |
| `path` | string | Yes | - | Destination checkout path. Relative paths resolve from the step working directory. |
| `ref` | string | No | repository default HEAD | Branch, tag, remote ref, or commit to checkout. |
| `depth` | integer | No | `0` | Shallow clone/fetch depth. `0` means full history. |
| `force` | boolean | No | `false` | Force checkout when the existing worktree has local changes. |
| `token` | string | No | - | HTTPS token for repository authentication. |
| `username` | string | No | `git` when needed | Username for HTTPS password authentication or SSH key authentication. |
| `password` | string | No | - | HTTPS password for repository authentication. |
| `ssh_key_path` | string | No | - | Path to an SSH private key. |
| `ssh_passphrase` | string | No | - | Passphrase for `ssh_key_path`. |

`token` cannot be combined with `username` or `password`. `ssh_key_path` cannot be combined with `token` or `password`.

## Output

The action publishes a JSON result. Later steps can read fields through the checkout step's declared outputs.

```yaml
steps:
  - id: checkout_source
    action: git.checkout
    with:
      repository: https://github.com/example/app.git
      ref: main
      path: ./repos/app

  - id: print_commit
    run: echo "Checked out ${steps.checkout_source.outputs.commit}"
    depends: checkout_source
```

Example output:

```json
{
  "operation": "checkout",
  "path": "/workspace/repos/app",
  "ref": "main",
  "commit": "4f8e4d4a9d81c4f4a7300a2d8e1a1c4f7e3c2b10",
  "cloned": true,
  "changed": true
}
```

## Existing Paths

If `path` already contains a Git repository, Dagu fetches `origin` and checks out the requested ref. If `path` exists but is not a Git repository, it must be empty; otherwise the step fails to avoid overwriting unrelated files.

Use `force: true` only when the workflow may intentionally discard local worktree changes.

## See Also

- [Git Sync](/server-admin/git-sync) - Server-side synchronization for DAG definitions and managed files
- [Shell](/step-types/shell) - Run custom Git commands when you need behavior outside `git.checkout`
