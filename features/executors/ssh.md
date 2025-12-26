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

Note: Password authentication is supported at both DAG and step level, but key-based authentication is strongly recommended.

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
