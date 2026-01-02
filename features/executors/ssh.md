# SSH Executor

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
  strictHostKey: true  # Default: true for security
  knownHostFile: ~/.ssh/known_hosts  # Default: ~/.ssh/known_hosts
  shell: "/bin/bash -e"  # Optional: string or array syntax for shell + args (DAG-level only)

steps:
  # All SSH steps inherit DAG-level configuration
  - command: curl -f http://localhost:8080/health
  - command: systemctl restart myapp
```

## Step-Level Configuration

```yaml
steps:
  - executor:
      type: ssh
      config:
        user: ubuntu
        ip: 192.168.1.100
        key: /home/user/.ssh/id_rsa
        shell: "/bin/bash -o pipefail"  # Step-level executor config accepts string form
    command: echo "Hello from remote server"
```

## Configuration

### DAG-Level Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `user` | Yes | - | SSH username |
| `host` | Yes | - | Hostname or IP address |
| `port` | No | "22" | SSH port |
| `key` | No | Auto-detect | Private key path (see below) |
| `password` | No | - | Password (not recommended) |
| `strictHostKey` | No | `true` | Enable host key verification |
| `knownHostFile` | No | `~/.ssh/known_hosts` | Known hosts file path |
| `shell` | No | - | Shell for remote command execution (string or array, e.g., `"/bin/bash -e"` or `["/bin/bash","-e"]`) |

### Step-Level Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `user` | Yes | - | SSH username |
| `host` | Yes | - | Hostname or IP address |
| `port` | No | "22" | SSH port |
| `key` | No | Auto-detect | Private key path (see below) |
| `password` | No | - | Password (not recommended) |
| `strictHostKey` | No | `true` | Enable host key verification |
| `knownHostFile` | No | `~/.ssh/known_hosts` | Known hosts file path |
| `shell` | No | - | Shell for remote command execution (string form only; e.g., `"/bin/bash -e"`) |

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
1. Step-level SSH executor config `shell` (string only)
2. DAG-level SSH config `shell` (string or array)
3. Step-level `shell` field on the step (string or array, acts as fallback for UX)

**Specifying Shell Arguments**

- DAG-level `ssh.shell` or the step-level `shell` field accept either string or array syntax, which is parsed into the executable plus argument list.
- Step-level SSH executor configs (`executor.config.shell`) currently accept **string form only** because the configuration map is decoded into a string. Use quoted strings such as `"/bin/bash -eo pipefail"` there.

### SSH Key Auto-Detection

If no key is specified, Dagu automatically tries these default SSH keys in order:
1. `~/.ssh/id_rsa`
2. `~/.ssh/id_ecdsa`
3. `~/.ssh/id_ed25519`
4. `~/.ssh/id_dsa`

## Multiple Commands

Multiple commands share the same step configuration:

```yaml
steps:
  - name: remote-checks
    executor:
      type: ssh
      config:
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

Instead of duplicating the SSH executor config, `preconditions`, `retryPolicy`, `env`, etc. across multiple steps, combine commands into one step.

**Important:** Each command runs in a **new SSH session**, so:
- Working directory resets to the user's home directory for each command
- Environment variables set in one command don't persist to the next
- Use absolute paths or combine commands with `&&` if you need shared context

## Security Best Practices

1. **Host Key Verification**: Always enabled by default (`strictHostKey: true`)
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

- [Docker Executor](/features/executors/docker) - Container execution
- [Shell Executor](/features/executors/shell) - Local commands
