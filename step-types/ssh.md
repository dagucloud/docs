# SSH

Execute commands on remote servers via SSH.

## DAG-Level Configuration

You can configure SSH settings at the DAG level to avoid repetition:

```yaml
# DAG-level SSH configuration
ssh:
  user: deploy
  host: production.example.com
  port: 22
  key: ~/.ssh/deploy_key
  password: ${env.SSH_PASSWORD}  # Optional; prefer keys
  strict_host_key: true  # Default: true for security
  known_host_file: ~/.ssh/known_hosts  # Default: ~/.ssh/known_hosts
  shell: "/bin/bash -e"  # Optional: string or array syntax for shell + args (DAG-level only)
  timeout: 60s  # Connection timeout (default: 30s)

steps:
  # All SSH steps inherit DAG-level configuration
  - id: health_check
    run: curl -f http://localhost:8080/health
  - id: restart_app
    run: systemctl restart myapp
    depends: health_check
```

## Step-Level Configuration

```yaml
steps:
  - action: ssh.run
    with:
      user: ubuntu
      host: 192.168.1.100
      key: /home/user/.ssh/id_rsa
      shell: "/bin/bash -o pipefail"  # Step-level `with.shell` accepts string form
      command: echo "Hello from remote server"
```

Connection fields under `with` replace the DAG-level `ssh` as a whole. A step that sets any of them inherits nothing from it.

## Configuration

### DAG-Level Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `user` | Yes | - | SSH username |
| `host` | Yes | - | Hostname or IP address |
| `port` | No | `22` | SSH port |
| `key` | No | Auto-detect | Private key: a path, `{ file: <path> }`, or `{ secret: <ref> }` (see [Credentials from Secrets](#credentials-from-secrets)) |
| `password` | No | - | Password: a string or `{ secret: <ref> }`. Used only when no key is set |
| `passphrase` | No | - | Passphrase of an encrypted private key: a string or `{ secret: <ref> }` |
| `strict_host_key` | No | `true` | Enable host key verification |
| `known_host_file` | No | `~/.ssh/known_hosts` | Known hosts file path |
| `shell` | No | - | Shell for remote command execution (string or array, e.g., `"/bin/bash -e"` or `["/bin/bash","-e"]`) |
| `timeout` | No | `30s` | Connection timeout (e.g., `30s`, `1m`) |
| `bastion` | No | - | Bastion/jump host configuration (see below) |

### Step-Level Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `user` | Yes | - | SSH username |
| `host` | Yes | - | Hostname or IP address |
| `ip` | No | - | Alias for `host` |
| `port` | No | `22` | SSH port |
| `key` | No | Auto-detect | Private key: a path, `{ file: <path> }`, or `{ secret: <ref> }` |
| `password` | No | - | Password: a string or `{ secret: <ref> }`. Used only when no key is set |
| `passphrase` | No | - | Passphrase of an encrypted private key: a string or `{ secret: <ref> }` |
| `strict_host_key` | No | `true` | Enable host key verification |
| `known_host_file` | No | `~/.ssh/known_hosts` | Known hosts file path |
| `shell` | No | - | Shell for remote command execution (string form only; e.g., `"/bin/bash -e"`) |
| `shell_args` | No | - | Extra shell arguments, appended after those in `shell` |
| `timeout` | No | `30s` | Connection timeout |
| `bastion` | No | - | Bastion/jump host configuration |

Note: Password authentication is supported at both DAG and step level, but key-based authentication is strongly recommended.

The SSH `timeout` field limits connection establishment. DAG-level and step-level `timeout_sec` cover the complete operation, including TCP dialing, SSH handshake, bastion setup, and remote command execution. When execution is canceled or reaches either deadline, Dagu closes the SSH transport so the step can finish promptly.

### Shell Configuration

Dagu sends the step's commands to the remote server as one script on standard input. Without `shell`, the remote `/bin/sh` runs that script. Set `shell` to choose a different interpreter or add arguments:

```yaml
ssh:
  user: deploy
  host: app.example.com
  shell: ["/bin/bash", "-e"]  # Script runs as: /bin/bash -e, reading stdin (DAG-level example)

steps:
  - run: echo $HOME && ls -la  # Shell features like pipes, variables work
```

Shell features such as `$HOME`, `&&`, pipes, redirections, and globs work with the default `/bin/sh` too. Use `shell` when commands need a specific shell, such as Bash syntax.

**Shell Priority:**
1. Step-level SSH `with.shell` (string only)
2. DAG-level SSH config `shell` (string or array)
3. Step-level `shell` field on the step (string or array, acts as fallback for UX)
4. `/bin/sh`

**Specifying Shell Arguments**

- DAG-level `ssh.shell` or the step-level `shell` field accept either string or array syntax, which is parsed into the executable plus argument list.
- Step-level SSH `with.shell` currently accepts **string form only** because the configuration map is decoded into a string. Use quoted strings such as `"/bin/bash -eo pipefail"` there.

### Variable Expansion Behavior

Dagu expands only **DAG-scoped variables** (env, params, secrets, step outputs) before sending commands to the remote host. OS-only variables (e.g., `$HOME`, `$USER`, `$PATH`) are **not** expanded locally; they pass through unchanged, letting the remote shell resolve them. This applies regardless of whether `shell` is configured.

```yaml
ssh:
  user: deploy
  host: app.example.com

env:
  - DEPLOY_BRANCH: main

steps:
  - run: |
      cd $HOME/app              # $HOME NOT expanded; remote shell resolves it
      git checkout ${env.DEPLOY_BRANCH}  # Expanded by Dagu (defined in DAG env)
```

This allows you to write shell scripts that use remote variables without Dagu replacing them:

```yaml
steps:
  - action: ssh.run
    with:
      user: deploy
      host: app.example.com
      command: |
        for FILE in *.log; do
          echo "Processing $FILE"  # $FILE is preserved for the remote shell
        done
```

To emit a literal `$` in SSH commands or `with` fields, escape it as `\$`. When `shell` is
configured, the remote shell handles the escape; without `shell`, Dagu unescapes it before
sending.

To use a local OS value in SSH commands, explicitly import it via the DAG-level `env:` block:

```yaml
env:
  - LOCAL_HOME: ${HOME}  # Import local $HOME into DAG scope

steps:
  - action: ssh.run
    with:
      user: deploy
      host: app.example.com
      command: echo "Local home was ${env.LOCAL_HOME}, remote home is $HOME"
```

The same rule applies to SSH **`with` fields** (`user`, `host`, `key`, `password`, etc.). A reference like `key: $HOME/.ssh/deploy_key` will not expand `$HOME` because it is not DAG-scoped. Import it first:

```yaml
env:
  - HOME_DIR: ${HOME}

ssh:
  user: deploy
  host: app.example.com
  key: ${env.HOME_DIR}/.ssh/deploy_key
```

The `shell` field controls whether POSIX shell expansion features (default values, parameter substitution such as `${VAR:-default}`) are available; it does not affect whether OS variables are expanded.

### SSH Key Auto-Detection

If no key is specified, Dagu automatically tries these default SSH keys in order:
1. `~/.ssh/id_rsa`
2. `~/.ssh/id_ecdsa`
3. `~/.ssh/id_ed25519`
4. `~/.ssh/id_dsa`

Set `passphrase` to unlock an encrypted default key.

## Credentials from Secrets

`key`, `password`, and `passphrase` can read their values from Dagu's [secret registry](/web-ui/secrets). The private key and password then live neither on the Dagu host nor in the DAG file.

```yaml
ssh:
  user: deploy
  host: app.example.com
  key: { secret: ssh/deploy-key }
  passphrase: { secret: ssh/deploy-passphrase }
  bastion:
    host: jump.example.com
    user: jump-user
    password: { secret: ssh/jump-password }

steps:
  - run: hostname
```

The same forms work at DAG level, under `with` for `ssh.run`, `sftp.upload`, and `sftp.download`, and in each `bastion`:

| Field | Forms |
|-------|-------|
| `key` | A path, `{ file: <path> }`, or `{ secret: <ref> }` |
| `password` | A string or `{ secret: <ref> }` |
| `passphrase` | A string or `{ secret: <ref> }` |

`<ref>` names a Dagu-managed secret, such as `ssh/deploy-key`. It resolves in the DAG's workspace first and then in **Global**, as [`secrets[].ref`](/writing-workflows/secrets#registry-refs) does. The ref is literal: Dagu does not resolve `${...}` inside it.

`dagu validate` rejects a credential object with an unknown field, with both `secret` and `file`, or with a `secret` that is not a valid ref or contains `${...}`. The error names the field, such as `steps.deploy.with.key.secret`.

### Authentication Method

Each hop, the target host and its bastion, authenticates with one method:

1. A set `key`, unlocked with `passphrase` when the key is encrypted.
2. Otherwise a set `password`.
3. Otherwise the first default key found (see [SSH Key Auto-Detection](#ssh-key-auto-detection)), unlocked with `passphrase` when the key is encrypted.

A passphrase is ignored when the key is not encrypted.

### Resolution and Masking

- Each distinct ref that an authentication method uses resolves once when the run starts, together with `secrets:`. Every connection, step, and `foreach` item reads that value. A ref that no method uses, such as a password ref next to a key, is not resolved.
- A ref that fails to resolve fails the run before any step starts. The error names the field and the ref.
- Resolved values are masked wherever [`secrets:` values are masked](/writing-workflows/secrets#masking). They are not exported as environment variables, so step processes cannot read them.
- On a [distributed worker](/server-admin/distributed/workers/shared-nothing), the coordinator resolves the refs. It answers only refs that the DAG declares in `secrets:` or uses for SSH.

### Storing a Private Key

A private key must keep its line breaks. In the Web UI, select **Multi-line or file** when you create or rotate the secret, then paste the key or choose the key file. See [Create A Secret](/web-ui/secrets#create-a-secret).

When a key read from a secret does not parse, the error names the ref and never includes the value. A key that lost its line breaks is reported as not a private key.

### Inheritance

A credential set in a DAG's `ssh` or in a workspace `base.yaml` replaces the one inherited from a [base config](/server-admin/base-config#ssh-configuration), whatever the form of either. Setting `key` also drops the inherited `passphrase`, which belongs to the key it unlocks. Setting `password` replaces only the password.

## Bastion Host

Connect through a jump host:

```yaml
ssh:
  user: deploy
  host: private-server.internal
  bastion:
    host: bastion.example.com
    user: jump-user
    key: ~/.ssh/bastion_key

steps:
  - run: hostname
```

Step-level bastion:

```yaml
steps:
  - action: ssh.run
    with:
      user: deploy
      host: private-server.internal
      bastion:
        host: bastion.example.com
        user: jump-user
        key: ~/.ssh/bastion_key
      command: hostname
```

### Bastion Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `host` | Yes | - | Bastion hostname |
| `port` | No | `22` | Bastion SSH port |
| `user` | Yes | - | Bastion username |
| `key` | No | Auto-detect | Bastion private key: a path, `{ file: <path> }`, or `{ secret: <ref> }` |
| `password` | No | - | Bastion password: a string or `{ secret: <ref> }`. Used only when no key is set |
| `passphrase` | No | - | Passphrase of the bastion's encrypted private key: a string or `{ secret: <ref> }` |

## Multiple Commands

Multiple commands share the same step configuration:

```yaml
steps:
  - id: remote_checks
    action: ssh.run
    with:
      user: deploy
      host: production.example.com
      key: ~/.ssh/deploy_key
      command:
        - systemctl status nginx
        - systemctl status myapp
        - df -h /var/log
    preconditions:
      - condition: "${env.ENV}"
        expected: "production"
```

Instead of duplicating the SSH executor `with` block, `preconditions`, `retry_policy`, `env`, etc. across multiple steps, combine commands into one step.

**Important:** All commands run in **one SSH session** as a single script, so:
- A directory change or exported variable carries over to later commands
- The script runs with `set -e`, so the first failing command stops the rest

## Security Best Practices

1. **Host Key Verification**: Always enabled by default (`strict_host_key: true`)
   - Prevents man-in-the-middle attacks
   - Uses `~/.ssh/known_hosts` by default
   - Only disable for testing environments

2. **Key-Based Authentication**: Strongly recommended
   - Prefer keys over passwords at all times
   - Use dedicated deployment keys with limited permissions
   - Rotate keys regularly
   - Store keys in the secret registry with `key: { secret: <ref> }` instead of on the Dagu host

3. **Known Hosts Management**:
   ```bash
   # Add host to known_hosts before running DAGs
   ssh-keyscan -H production.example.com >> ~/.ssh/known_hosts
   ```

## Running Commands on Multiple Hosts

To execute the same command across multiple hosts in parallel, use `parallel.items` with a sub-DAG. Each host gets its own DAG run with separate logs, status, and retry tracking.

Define both DAGs in a single file using `---` as a document separator. The second document becomes a local DAG, resolved by name when `dag.run` references it.

```yaml
# deploy.yaml
steps:
  - name: run-on-servers
    parallel:
      items:
        - server1.example.com
        - server2.example.com
        - server3.example.com
      max_concurrent: 2
    action: dag.run
    with:
      dag: ssh-command
      params:
        HOST: ${ITEM}
---
name: ssh-command

params:
  - HOST: ""

steps:
  - name: run
    action: ssh.run
    with:
      host: ${params.HOST}
      user: deploy
      key: ~/.ssh/id_rsa
      command: uptime
```

When the same command needs a different SSH user, pass that user as a normal parameter:

```yaml
params:
  - SSH_USER: deploy

steps:
  - name: run-on-servers
    parallel:
      items:
        - server1.example.com
        - server2.example.com
      max_concurrent: 2
    action: dag.run
    with:
      dag: ssh-command
      params:
        HOST: ${ITEM}
        USER: ${params.SSH_USER}
---
name: ssh-command

params:
  - HOST: ""
  - USER: ""

steps:
  - name: run
    action: ssh.run
    with:
      host: ${params.HOST}
      user: ${params.USER}
      key: ~/.ssh/id_rsa
      command: uptime
```

See [parallel.items](/writing-workflows/execution-control#parallel-execution) for full fan-out options.

## See Also

- [SFTP](/step-types/sftp) - File transfer via SFTP
- [Docker](/step-types/docker) - Container execution
- [Shell](/step-types/shell) - Local commands
