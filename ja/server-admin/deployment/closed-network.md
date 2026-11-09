# 閉域網 {#closed-networks}

Dagu は、インターネットに接続せずにワークフローをスケジュールし、実行できます。外部のデータベース、ブローカー、ライセンスサーバーは必要ありません。ただし、オプション機能の一部には接続が必要です。このページでは、それらの機能を示します。

## インストール {#install}

インターネットに接続できるマシンで、お使いのプラットフォーム向けのアーカイブと `checksums.txt` を https://github.com/dagucloud/dagu/releases からダウンロードし、[検証](/ja/server-admin/verify-releases)します。次に、アーカイブを閉域網内に移動し、バイナリをインストールします。

```bash
tar -xzf dagu_2.26.0_linux_amd64.tar.gz dagu
sudo install -m 0755 dagu /usr/local/bin/dagu
dagu version
```

コンテナの場合は、イメージをお使いのレジストリにコピーするか、直接読み込みます。

```bash
docker pull ghcr.io/dagucloud/dagu:2.26.0
docker save -o dagu-2.26.0.tar ghcr.io/dagucloud/dagu:2.26.0

# inside the closed network
docker load -i dagu-2.26.0.tar
```

Kubernetes の場合は、`helm pull dagu/dagu` でチャートをダウンロードし、イメージをお使いのレジストリにプッシュして、`image.repository` と `image.tag` を設定します。[イメージとプライベートレジストリ](/server-admin/deployment/kubernetes#images-and-private-registries)を参照してください。

## 設定 {#configure}

更新の確認を無効にします。無効にしない場合、更新の確認は GitHub への接続を試みます。

```yaml
check_updates: false
```

## ライセンス {#license}

Dagu Console に接続できないサーバーでは、オフラインライセンスを使用します。

1. インターネットに接続できるマシンから、コンソールの **Instances** ページにある **Add offline server** でオフラインライセンスを作成します。
2. `DAGU_LICENSE` または `DAGU_LICENSE_FILE` でインストールするか、`data/license/license.jwt` として保存します。

オフラインサーバーは、ライセンスが取り消されるまでライセンス枠を 1 つ使用します。有料機能は、ライセンスの有効期限が切れてから 14 日間は引き続き動作します。その前にライセンスを置き換えてください。

データディレクトリを共有するアクティブ/スタンバイのペアに必要なライセンスは 1 つです。

## 社内に置く Control Plane {#private-control-plane}

閉域網の中で集中監視とアラートが必要な組織向けに、Control Plane を自社ネットワーク内に構築できます。Enterprise 契約のもとで、ご依頼に応じて提供します。範囲と時期は案件ごとに取り決めます。`company@descarty.com` にお問い合わせください。

各サーバーは Dagu Cloud の代わりに社内の Control Plane へ報告します。Control Plane はサーバーとは別に動くため、サーバーからの報告が途絶えたときにもアラートを出せます。

## 接続が必要な機能 {#what-needs-a-connection}

| 機能 | 接続先 | 接続できない場合 |
| --- | --- | --- |
| [Dagu Console での監視](/overview/console-monitoring)(失敗したワークフロー、期限超過、報告が途絶えたサーバーのアラートを含む) | `console.dagu.sh` | [社内に置く Control Plane](#private-control-plane) を使うか、[こちら](#alerts-without-dagu-console)を参照してください。 |
| [公開 Webhook URL](/server-admin/authentication/public-webhook-urls) | `console.dagu.sh`、`relay.dagu.sh` | ネットワーク内からローカルの Webhook エンドポイントを使用してください。 |
| [Dagu Cloud からのリモートアクセス](/overview/cloud-remote-access) | `console.dagu.sh`、`relay.dagu.sh` | MCP クライアントをサーバーに直接接続してください。 |
| `dagu upgrade` | GitHub | [バイナリを手動で置き換えてください](/ja/server-admin/upgrades)。 |
| DAG の [`tools`](/writing-workflows/tools) | GitHub(aqua レジストリとダウンロード用) | コマンドをホストまたはイメージにインストールし、DAG から `tools` を削除してください。 |
| [Dagu Actions](/dagu-actions/) | GitHub | 組み込みのステップタイプと独自のコマンドを使用してください。 |
| AI ステップ | モデルプロバイダー | ネットワーク内のモデルエンドポイントを指定してください。 |

## Dagu Console を使用しないアラート {#alerts-without-dagu-console}

期限、開始遅延、サーバー停止のアラートは Dagu Console が発行します。[社内に置く Control Plane](#private-control-plane) を使わない場合は、必要なアラートをローカルで動作する機能を使って構築してください。

- **失敗したワークフロー:** [`handler_on.failure`](/writing-workflows/lifecycle-handlers) ステップ、または社内メールサーバー経由の[メール](/writing-workflows/email-notifications)。
- **スケジューラの正常性:** `dagu_scheduler_instances` などの [Prometheus メトリクス](/server-admin/prometheus-metrics)、およびスケジューラの `GET /health`。
- **開始されなかったジョブ:** `dagu history` または [API](/web-ui/api) を使って、DAG の最後の実行と実行予定時刻を比較する別の確認処理。
