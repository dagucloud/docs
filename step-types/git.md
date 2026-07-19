# Git

Dagu has three built-in Git actions:

| Action | Use it to |
|--------|-----------|
| `git.checkout` | Clone a repository or update an existing checkout. |
| `git.worktree.add` | Create or reuse a linked worktree in a local repository. |
| `git.worktree.remove` | Remove a linked worktree and optionally delete its local branch. |

## Clone or update a repository

`action: git.checkout` clones the repository when the target path does not exist, or fetches and updates an existing checkout when the target is already a Git repository.

### Basic usage

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

### Checkout the default branch

Omit `ref` to checkout the repository default HEAD. On repeated runs against an existing checkout, Dagu fetches `origin` and updates the worktree to the current remote default HEAD.

```yaml
steps:
  - id: checkout_docs
    action: git.checkout
    with:
      repository: https://github.com/example/docs.git
      path: ./repos/docs
```

### Checkout a branch, tag, or commit

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

### Shallow checkout

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

### Authentication

#### HTTPS token

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

#### HTTPS username and password

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

#### SSH key

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

### Checkout fields

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

### Checkout outputs

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

### Existing checkout paths

If `path` already contains a Git repository, Dagu fetches `origin` and checks out the requested ref. If `path` exists but is not a Git repository, it must be empty; otherwise the step fails to avoid overwriting unrelated files.

Use `force: true` only when the workflow may intentionally discard local worktree changes.

## Linked worktrees

A linked worktree gives a local branch its own working directory while sharing the repository's Git data. This is useful when a workflow needs an isolated checkout for tests, builds, or code changes but should not clone the repository again.

Both worktree actions find the repository from the step's `working_dir`. Set `working_dir` to the repository root, a directory inside the repository, an existing linked worktree, or a bare repository. There is no `repository` field for these actions.

Worktree actions use the local `git` executable. They inspect and change local branches and worktree registrations, but they never fetch, push, or contact a remote.

### Create a worktree with a generated branch

Omit `branch` when the workflow only needs an isolated branch for this run. Dagu generates a valid branch name that starts with `dagu/`. Retries of the same step in the same DAG run use the same generated branch.

```yaml
working_dir: ./repo

steps:
  - id: worktree
    action: git.worktree.add

  - id: test
    depends: worktree
    working_dir: "${steps.worktree.outputs.path}"
    run: go test ./...

  - id: remove_worktree
    depends: test
    action: git.worktree.remove
    with:
      path: "${steps.worktree.outputs.path}"
```

The default directory is `<repository-root>.worktrees/<branch>`. A branch such as `feature/auth` therefore gets a nested path ending in `feature/auth`.

The `test` step reads the absolute worktree path directly from the add action. Worktree actions have fixed outputs, so the workflow does not declare an `output`, `outputs`, or `stdout.outputs` field.

### Create an explicit branch

Set `create_branch: true` when an explicitly named branch may need to be created. `base` can name a local commit, local branch, `origin` remote-tracking branch, or tag. It defaults to the repository's current `HEAD`.

```yaml
working_dir: ./repo

steps:
  - id: feature_worktree
    action: git.worktree.add
    with:
      branch: feature/api
      create_branch: true
      base: main
      path: ../worktrees/feature-api
```

Relative worktree paths resolve from the detected repository root, even when the step `working_dir` points to a nested directory. If the branch already exists, Dagu checks out that branch and ignores `base`.

The add action is safe to retry. If the requested branch is already registered at the requested path, Dagu reuses the worktree without resetting its `HEAD` or discarding local changes.

### Add fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `branch` | string | No | generated | Local branch checked out in the worktree. |
| `path` | string | No | `<repository-root>.worktrees/<branch>` | Worktree directory. Relative paths resolve from the repository root. |
| `create_branch` | boolean | No | `false` | Allow creation of an explicitly named branch. Generated branches can always be created. |
| `base` | string | No | repository `HEAD` | Local revision used when Dagu creates the branch. When `branch` is explicit, this requires `create_branch: true`. |

### Remove a worktree explicitly

Worktrees remain registered until `git.worktree.remove` or an external Git command removes them. Pass `path`, `branch`, or both. Passing both is safest when the values come from `git.worktree.add`, because Dagu verifies that both selectors identify the same registered worktree.

```yaml
working_dir: ./repo

steps:
  - id: worktree
    action: git.worktree.add
    with:
      branch: temporary-report
      create_branch: true

  - id: build_report
    depends: worktree
    working_dir: "${steps.worktree.outputs.path}"
    run: go test ./...

  - id: remove_worktree
    depends: build_report
    action: git.worktree.remove
    with:
      path: "${steps.worktree.outputs.path}"
      branch: "${steps.worktree.outputs.branch}"
      delete_branch: true
```

Removing a missing worktree succeeds and reports `worktree_removed: false`. This makes remove steps safe to retry.

### Remove fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `branch` | string | One of `branch` or `path` | - | Branch whose linked worktree should be removed. |
| `path` | string | One of `branch` or `path` | - | Worktree directory to remove. |
| `force` | boolean | No | `false` | Remove a worktree with uncommitted or untracked changes. |
| `delete_branch` | boolean | No | `false` | Delete the local branch after removing the worktree. Requires `branch`. |
| `force_delete_branch` | boolean | No | `false` | Delete the branch even when it is not merged into repository `HEAD`. Requires `delete_branch: true`. |

`force` and `force_delete_branch` protect different data. `force` permits deletion of changes in the worktree. `force_delete_branch` permits deletion of commits that are not merged into the repository's current `HEAD`.

### Worktree outputs

Read a worktree action result with `${steps.<step-id>.outputs.<field>}`.

`git.worktree.add` publishes:

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Absolute worktree path. |
| `branch` | string | Selected branch, including a Dagu-generated branch name. |
| `commit` | string | Worktree `HEAD` commit after the action. |
| `worktree_created` | boolean | Whether this action registered the worktree. |
| `branch_created` | boolean | Whether this action created the branch. |

`git.worktree.remove` publishes:

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Resolved worktree path, or an empty string when no path can be resolved. |
| `branch` | string | Resolved branch, or the supplied branch when no worktree exists. |
| `worktree_removed` | boolean | Whether the action removed a registered worktree. |
| `branch_deleted` | boolean | Whether the action deleted the local branch. |

### Safety rules

- Dagu refuses to remove the repository's primary working tree.
- A dirty worktree is preserved unless `force: true` is set.
- An unmerged branch is preserved unless both `delete_branch: true` and `force_delete_branch: true` are set.
- If both `branch` and `path` are supplied, they must identify the same registered worktree.
- A stale registration causes `git.worktree.add` to fail. Run `git.worktree.remove` with its branch or path to unregister it before retrying the add action.
- Dagu serializes worktree mutations that use the same repository metadata directory. Git commands run outside Dagu are not part of this coordination.

## See Also

- [Git Sync](/server-admin/git-sync) - Server-side synchronization for DAG definitions and managed files
- [Outputs](/writing-workflows/outputs) - How later steps consume action outputs
- [Shell](/step-types/shell) - Run custom Git commands when you need behavior outside `git.checkout`
