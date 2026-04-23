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
  password: ${SSH_PASSWORD}  # Optional; prefer keys
  strict_host_key: true  # Default: true for security
  known_host_file: ~/.ssh/known_hosts  # Default: ~/.ssh/known_hosts
  shell: "/bin/bash -e"  # Optional: string or array syntax for shell + args (DAG-level only)
  timeout: 60s  # Connection timeout (default: 30s)

steps:
  # All SSH steps inherit DAG-level configuration
  - command: curl -f http://localhost:8080/health
  - command: systemctl restart myapp
```

## Step-Level Configuration

```yaml
steps:
  - type: ssh
    with:
      user: ubuntu
      ip: 192.168.1.100
      key: /home/user/.ssh/id_rsa
      shell: "/bin/bash -o pipefail"  # Step-level `with.shell` accepts string form
    command: echo "Hello from remote server"
```

## Configuration

### DAG-Level Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `user` | Yes | - | SSH username |
| `host` | Yes | - | Hostname or IP address |
| `port` | No | `22` | SSH port |
| `key` | No | Auto-detect | Private key path (see below) |
| `password` | No | - | Password (not recommended) |
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
| `port` | No | `22` | SSH port |
| `key` | No | Auto-detect | Private key path (see below) |
| `password` | No | - | Password (not recommended) |
| `strict_host_key` | No | `true` | Enable host key verification |
| `known_host_file` | No | `~/.ssh/known_hosts` | Known hosts file path |
| `shell` | No | - | Shell for remote command execution (string form only; e.g., `"/bin/bash -e"`) |
| `timeout` | No | `30s` | Connection timeout |
| `bastion` | No | - | Bastion/jump host configuration |

Note: Password authentication is supported at both DAG and step level, but key-based authentication is strongly recommended.

### Shell Configuration

When `shell` is specified, commands are wrapped and executed through the shell on the remote server:

```yaml
ssh:
  user: deploy
  host: app.example.com
  shell: ["/bin/bash", "-e"]  # Commands wrapped as: /bin/bash -e -c 'command' (DAG-level example)

steps:
  - command: echo $HOME && ls -la  # Shell features like pipes, variables work
```

Without `shell`, commands are executed directly without shell interpretation. Use `shell` when you need:
- Shell variable expansion (`$HOME`, `$PATH`)
- Command chaining (`&&`, `||`, `;`)
- Pipes (`|`) and redirections (`>`, `<`)
- Glob patterns (`*.txt`)

**Shell Priority:**
1. Step-level SSH `with.shell` (string only)
2. DAG-level SSH config `shell` (string or array)
3. Step-level `shell` field on the step (string or array, acts as fallback for UX)

**Specifying Shell Arguments**

- DAG-level `ssh.shell` or the step-level `shell` field accept either string or array syntax, which is parsed into the executable plus argument list.
- Step-level SSH `with.shell` currently accepts **string form only** because the configuration map is decoded into a string. Use quoted strings such as `"/bin/bash -eo pipefail"` there.

### Variable Expansion Behavior

Dagu expands only **DAG-scoped variables** (env, params, secrets, step outputs) before sending commands to the remote host. OS-only variables (e.g., `$HOME`, `$USER`, `$PATH`) are **not** expanded locally — they pass through unchanged, letting the remote shell resolve them. This applies regardless of whether `shell` is configured.

```yaml
ssh:
  user: deploy
  host: app.example.com

env:
  - DEPLOY_BRANCH: main

steps:
  - command: |
      cd $HOME/app              # $HOME NOT expanded — remote shell resolves it
      git checkout ${DEPLOY_BRANCH}  # Expanded by Dagu — defined in DAG env
```

This allows you to write shell scripts that use remote variables without Dagu replacing them:

```yaml
steps:
  - type: ssh
    with:
      user: deploy
      host: app.example.com
    command: |
      for FILE in *.log; do
        echo "Processing ${FILE}"  # ${FILE} preserved for remote shell
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
  - type: ssh
    with:
      user: deploy
      host: app.example.com
    command: echo "Local home was ${LOCAL_HOME}, remote home is $HOME"
```

The same rule applies to SSH **`with` fields** (`user`, `host`, `key`, `password`, etc.). A reference like `key: $HOME/.ssh/deploy_key` will not expand `$HOME` because it is not DAG-scoped. Import it first:

```yaml
env:
  - HOME_DIR: ${HOME}

ssh:
  user: deploy
  host: app.example.com
  key: ${HOME_DIR}/.ssh/deploy_key  # Expanded — HOME_DIR is DAG-scoped
```

The `shell` field controls whether POSIX shell expansion features (default values, parameter substitution like `${VAR:-default}`) are available — it does not affect whether OS variables are expanded.

### SSH Key Auto-Detection

If no key is specified, Dagu automatically tries these default SSH keys in order:
1. `~/.ssh/id_rsa`
2. `~/.ssh/id_ecdsa`
3. `~/.ssh/id_ed25519`
4. `~/.ssh/id_dsa`

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
  - command: hostname
```

Step-level bastion:

```yaml
steps:
  - type: ssh
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
| `key` | No | Auto-detect | Bastion private key path |
| `password` | No | - | Bastion password |

## Multiple Commands

Multiple commands share the same step configuration:

```yaml
steps:
  - id: remote_checks
    type: ssh
    with:
      user: deploy
      host: production.example.com
      key: ~/.ssh/deploy_key
    command:
      - systemctl status nginx
      - systemctl status myapp
      - df -h /var/log
    preconditions:
      - condition: "${ENV}"
        expected: "production"
```

Instead of duplicating the SSH executor `with` block, `preconditions`, `retry_policy`, `env`, etc. across multiple steps, combine commands into one step.

**Important:** Each command runs in a **new SSH session**, so:
- Working directory resets to the user's home directory for each command
- Environment variables set in one command don't persist to the next
- Use absolute paths or combine commands with `&&` if you need shared context

## Security Best Practices

1. **Host Key Verification**: Always enabled by default (`strict_host_key: true`)
   - Prevents man-in-the-middle attacks
   - Uses `~/.ssh/known_hosts` by default
   - Only disable for testing environments

2. **Key-Based Authentication**: Strongly recommended
   - Prefer keys over passwords at all times
   - Use dedicated deployment keys with limited permissions
   - Rotate keys regularly

3. **Known Hosts Management**:
   ```bash
   # Add host to known_hosts before running DAGs
   ssh-keyscan -H production.example.com >> ~/.ssh/known_hosts
   ```

## See Also

- [SFTP](/step-types/sftp) - File transfer via SFTP
- [Docker](/step-types/docker) - Container execution
- [Shell](/step-types/shell) - Local commands
