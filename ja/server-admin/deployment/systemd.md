# Linux の systemd サービス {#linux-systemd-service}

## Dagu のインストール {#install-dagu}

```bash
# Install to /usr/local/bin (system-wide) without the installer's own service
curl -L https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- --install-dir /usr/local/bin --service no

# Create user and directories
sudo useradd -r -s /bin/false dagu
sudo mkdir -p /var/lib/dagu
sudo chown -R dagu:dagu /var/lib/dagu
```

## サービスの作成 {#create-service}

`/etc/systemd/system/dagu.service` を作成します。

```ini
[Unit]
Description=Dagu Workflow Engine
After=network.target

[Service]
Type=simple
User=dagu
Group=dagu
WorkingDirectory=/var/lib/dagu
ExecStart=/usr/local/bin/dagu start-all
Restart=always
RestartSec=10

Environment="DAGU_HOST=0.0.0.0"
Environment="DAGU_PORT=8525"
Environment="DAGU_HOME=/var/lib/dagu"

[Install]
WantedBy=multi-user.target
```

## サービスの起動 {#start-service}

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start
sudo systemctl enable dagu

# Start service
sudo systemctl start dagu

# Check status
sudo systemctl status dagu

# View logs
sudo journalctl -u dagu -f
```

## アクセス {#access}

ブラウザで http://your-server:8525 を開きます。
