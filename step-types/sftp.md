# SFTP

Transfer files between local and remote servers via SFTP.

## DAG-Level Configuration

```yaml
ssh:
  user: deploy
  host: server.example.com
  key: ~/.ssh/deploy_key

steps:
  - id: upload_config
    action: sftp.upload
    with:
      source: /local/config.yaml
      destination: /remote/config.yaml

  - id: download_logs
    action: sftp.download
    with:
      source: /var/log/app.log
      destination: /local/app.log
```

## Step-Level Configuration

```yaml
steps:
  - id: upload_file
    action: sftp.upload
    with:
      user: deploy
      host: server.example.com
      key: ~/.ssh/deploy_key
      source: /local/file.txt
      destination: /remote/file.txt
```

## Configuration

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `user` | Yes | - | SSH username |
| `host` | Yes | - | SSH hostname |
| `ip` | No | - | Alias for `host` |
| `port` | No | `22` | SSH port |
| `key` | No | Auto-detect | Private key path |
| `password` | No | - | SSH password |
| `strict_host_key` | No | `true` | Enable host key verification |
| `known_host_file` | No | `~/.ssh/known_hosts` | Known hosts file path |
| `timeout` | No | `30s` | Connection timeout |
| `direction` | No | `upload` | `upload` or `download` |
| `source` | Yes | - | Source path (local for upload, remote for download) |
| `destination` | Yes | - | Destination path (remote for upload, local for download) |
| `bastion` | No | - | Bastion host configuration (same as SSH) |

The SSH `timeout` field limits connection establishment. DAG-level and step-level `timeout_sec` cover connection setup and the complete transfer. When execution is canceled or reaches either deadline, Dagu closes the SSH transport so blocked uploads and downloads can finish promptly.

## Directory Transfer

Directories are transferred recursively:

```yaml
steps:
  - id: upload_dir
    action: sftp.upload
    with:
      source: /local/project/
      destination: /remote/project/

  - id: download_dir
    action: sftp.download
    with:
      source: /remote/backup/
      destination: /local/backup/
```

## Atomic Uploads

Uploads write to a temporary file (`.dagu-tmp-{random}`) and then rename it to the final destination. This prevents incomplete files if an upload fails.

## See Also

- [SSH](/step-types/ssh) - Remote command execution
- [S3](/step-types/s3) - S3 file operations
