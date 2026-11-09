---
description: macOS、Linux、Windows、Docker、Kubernetes、npm、ソースビルドから、サポートされている Dagu のインストール方法を選びます。
---

# インストール {#installation}

お使いのプラットフォームのガイドを選んでください。

- [**macOS**](/getting-started/installation/macos): Homebrew、またはガイド付きのスクリプトインストーラ (LaunchAgent サービス)
- [**Linux**](/ja/getting-started/installation/linux): systemd サービスを登録できるガイド付きのスクリプトインストーラ、またはバイナリの手動配置
- [**npm**](/getting-started/installation/npm): postinstall で Dagu バイナリをダウンロードするグローバルパッケージ
- [**Windows**](/ja/getting-started/installation/windows): Windows サービスを任意で登録できるグラフィカルインストーラまたは PowerShell スクリプトインストーラ、もしくは Scoop
- [**Docker**](/ja/getting-started/installation/docker): `docker run`、Compose、ホストの Docker ソケットのマウント
- [**Kubernetes**](/getting-started/installation/kubernetes): 公式 Helm チャート
- [**ソースからビルド**](/getting-started/installation/source): Go と Node のツールチェーン

## どの方法を選ぶか {#which-one-should-i-use}

| 状況 | インストール方法 |
|---|---|
| ノート PC で Dagu をローカルに試す | **Homebrew** (macOS)、**スクリプトインストーラ** (Linux)、または**グラフィカルインストーラ** (Windows) |
| 共有サーバーで運用する | `--service yes` を指定した**スクリプトインストーラ** |
| コンテナで運用する | **Docker** |
| クラスタで運用する | **Kubernetes (Helm)** |
| CI または再現可能なセットアップ | **npm**、**バイナリの手動ダウンロード**、または **Docker** |
| Dagu 自体を開発する | **ソースからビルド** |

## スクリプトインストーラの機能 {#what-the-script-installers-do}

`installer.sh` / `installer.ps1` / `installer.cmd` の各スクリプトは、ガイド付きのウィザードを開きます。ウィザードでは次のことができます。

- `dagu` バイナリのインストール
- `PATH` への追加
- バックグラウンドサービスとしてのセットアップ (Linux では systemd、macOS では LaunchAgent、Windows では Windows サービス)
- 最初の管理者アカウントの作成と確認
- 検出した AI コーディングツールへの [Dagu AI スキル](/ai/skills)のインストール

Windows のグラフィカルインストーラは、Dagu を `PATH` に追加し、Windows サービスとしてセットアップできます。管理者アカウントの作成と AI スキルのインストールは行いません。

Homebrew、npm、Scoop、Docker、Helm、手動ダウンロードでは、ガイド付きのウィザード、サービスのセットアップ、管理者の初期作成は行われません。

## Dagu のデータの保存場所 {#where-dagu-keeps-things}

インストール後、Dagu は既定で次のパスを使用します。ワークフローのバックアップ、ストレージの移動、ログの確認を行うときに知っておくべき主な場所です。

```
~/.config/dagu/
├── dags/          # Your workflow YAML files
├── config.yaml    # Server configuration
└── base.yaml      # Shared DAG defaults

~/.local/share/dagu/
├── logs/          # Per-run execution logs
└── data/          # Run history and state
    └── suspend/   # Suspend flags
```

インストーラでセットアップしたバックグラウンドサービスは、すべてを 1 つのディレクトリに保存します。保存先は `~/.dagu`、Linux のシステムサービスでは `/var/lib/dagu`、Windows サービスでは `C:\ProgramData\Dagu` です。構成は [`DAGU_HOME` レイアウト](/server-admin/configuration#dagu-home)で、ワークフローは `dags/` に配置されます。`~/.dagu` が存在する場合は、`dagu` コマンドもこのディレクトリを使用します。

どのパスも環境変数で上書きできます。

```bash
export DAGU_HOME=/opt/dagu              # all-in-one override
export DAGU_DAGS_DIR=/workflows
export DAGU_LOG_DIR=/var/log/dagu
export DAGU_DATA_DIR=/var/lib/dagu
```

## インストールの確認 {#verifying-the-install}

```bash
dagu version
```

続いて[クイックスタート](/ja/getting-started/quickstart)を実行し、最初のワークフローを作成してください。AI コーディングツールを使用する場合は、同梱の Dagu ワークフロー作成スキルをインストールしてください。稼働中の Dagu サーバーを操作するには、[Dagu MCP サーバー](/mcp/)を接続してください。

## アンインストール {#uninstalling}

スクリプトインストーラはアンインストールにも使用できます。Windows のグラフィカルインストーラでインストールした Dagu は、**設定 > アプリ** (**Settings > Apps**) からアンインストールします。詳細は[アンインストール](/getting-started/installation/uninstall)を参照してください。
