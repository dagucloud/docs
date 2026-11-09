# Linux へのインストール {#install-on-linux}

ガイド付きのスクリプトインストーラの使用を推奨します。Dagu を systemd サービスとして登録し、最初の管理者アカウントを作成できます。

## スクリプトインストーラ {#script-installer}

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

ウィザードでは次のことができます。

- `dagu` を `PATH` に追加する
- `systemd --user` ユニット (ユーザー単位) またはシステムユニット (root) を登録する
- 最初の管理者アカウントを作成して確認する

`sudo` を使用できる場合は、システムサービスが既定です。インストール先は `/usr/local/bin`、データの保存先は `/var/lib/dagu` です。ユーザーサービスのインストール先は `~/.local/bin`、データの保存先は `~/.dagu` です。サービスなしでインストールする場合は `~/.local/bin` を使用します。ユーザーサービスとサービスなしのインストールでは、sudo は不要です。

### ユーザーサービスでの非対話インストール {#non-interactive-with-user-service}

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- \
    --service yes \
    --service-scope user \
    --admin-username admin \
    --admin-password 'change-me-now'
```

### システム全体のサービス {#system-wide-service}

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- \
    --service yes \
    --service-scope system \
    --install-dir /usr/local/bin \
    --admin-username admin \
    --admin-password 'change-me-now'
```

### よく使うフラグ {#common-flags}

| フラグ | 用途 |
|---|---|
| `--version vX.Y.Z` | 特定のリリースをインストールする |
| `--install-dir /usr/local/bin` | システム全体にインストールする |
| `--install-dir ~/bin` | ユーザーの任意の場所にインストールする |
| `--service yes` | systemd ユニットを登録する |
| `--service-scope user\|system` | ユーザー単位またはシステム全体のサービス |
| `--admin-username <u> --admin-password <p>` | 最初の管理者を作成する |
| `--working-dir /volume1/tmp` | `/tmp` を上書きする (NAS で有用) |
| `--dry-run --no-prompt` | CI プレビューモード |

### サービスの PATH の取得 {#service-path-capture}

インストーラはサービスを登録するときに、現在のシェルの `PATH` のスナップショットをユニットファイルに書き込みます。その `PATH` 上の CLI ツール (`python`、`node`、`docker`、独自のバイナリなど) は、サービス配下で実行されるワークフローのステップから使用できます。後からツールを追加した場合は、インストーラを再実行するか、ユニットファイルを編集してください。

## バイナリの手動配置 {#manual-binary}

お使いのアーキテクチャ用の tarball を [GitHub Releases](https://github.com/dagucloud/dagu/releases) からダウンロードして展開し、`dagu` を `PATH` の通った場所に配置します。

```bash
tar -xzf dagu_*_linux_amd64.tar.gz
sudo install dagu /usr/local/bin/
```

## パッケージマネージャ {#package-managers}

- **Homebrew on Linux**: `brew install dagu`
- **npm**: [npm でのインストール](/getting-started/installation/npm)を参照してください。
- **Docker**: [Docker でのインストール](/ja/getting-started/installation/docker)を参照してください。

## 確認 {#verify}

```bash
dagu version
systemctl --user status dagu    # if installed as a user service
```

次へ: [クイックスタート](/ja/getting-started/quickstart)
