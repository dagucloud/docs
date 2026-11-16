# Rundeck からの移行 {#migrating-from-rundeck}

Rundeck のジョブは、Dagu の DAG に対応します。DAG は 1 つの YAML ファイルで、Git で管理できます。このページでは、Rundeck の概念と Dagu の対応、変換したジョブの例、数個のジョブずつ移行する手順を説明します。

Rundeck のジョブ定義を移行するツールや、お使いの Rundeck の機能が必要な場合は、[リクエストしてください](https://github.com/dagucloud/dagu/issues)。

## 概念の対応 {#how-the-concepts-map}

| Rundeck | Dagu |
| --- | --- |
| ジョブ | [DAG](/writing-workflows/basics)(1 つの YAML ファイル) |
| ジョブのステップ | [ステップ](/writing-workflows/basics#steps) |
| 順次実行のワークフロー | `depends` でつないだステップ |
| ジョブオプション | [`params`](/writing-workflows/data-variables) |
| エラーハンドラ | `handler_on.failure`、またはステップの `retry_policy` と `continue_on` |
| スケジュール | [`schedule`](/writing-workflows/scheduling)(タイムゾーンは `CRON_TZ=` で指定) |
| SSH によるノードへのディスパッチ | [`ssh`](/step-types/ssh)(DAG 単位またはステップ単位) |
| ノード上のエージェント | `worker_selector` で選択した[ワーカー](/server-admin/distributed/) |
| ジョブ参照 | [`dag.run`](/writing-workflows/sub-dags) ステップ |
| Key Storage | [シークレット](/writing-workflows/secrets) |
| Webhook | [Webhook](/server-admin/authentication/webhooks) |
| プロジェクト | [ワークスペース](/web-ui/workspaces) |
| データベース内のジョブ定義 | Git で管理するファイル(`dagu validate` で検証) |

## 例 {#example}

オプション、リトライ、エラーハンドラを備えた夜間デプロイジョブの例です。

```yaml
type: graph
schedule: "CRON_TZ=Asia/Tokyo 0 2 * * *"
calendar: weekdays

params:
  - name: environment
    default: staging

ssh:
  user: deploy
  host: app01.example.internal
  key: /etc/dagu/keys/deploy

steps:
  - id: stop_app
    run: sudo systemctl stop myapp

  - id: migrate
    run: /opt/myapp/bin/migrate --env "${params.environment}"
    depends: stop_app
    retry_policy:
      limit: 3
      interval_sec: 30

  - id: start_app
    run: sudo systemctl start myapp
    depends: migrate

handler_on:
  failure:
    run: /opt/ops/page-oncall.sh
```

## 多数のノードでのジョブ実行 {#running-jobs-across-many-nodes}

- **ノードの指定。** [`ssh`](/step-types/ssh) で DAG 単位またはステップ単位にホストを指定するか、[ワーカー](/server-admin/distributed/)にラベルを付けて `worker_selector` でステップを振り分けます。1 つのコマンドを複数のホストに展開するには [`parallel`](/writing-workflows/control-flow) を使用します。
- **グループへのジョブの委任。** 対象のジョブを専用の[ワークスペース](/web-ui/workspaces)に置き、そのワークスペースでグループに `operator` ロールを付与します。operator はジョブの実行と停止ができ、定義は編集できません。ID プロバイダーのグループは、[OIDC ワークスペースアクセス](/server-admin/authentication/oidc-workspace-access)でワークスペースのロールに対応付けられます。
- **プラグイン。** 組み込みの[ステップタイプ](/step-types/shell)、公式アクションや[カスタムアクション](/dagu-actions/custom)を使用するか、コマンドから同じツールを呼び出します。
- **高可用性。** [共有ストレージ上のスタンバイスケジューラ](/ja/server-admin/deployment/high-availability)が、アクティブなスケジューラの停止時に自動で引き継ぎます。
- **監視とアラート。** [Dagu Console](/overview/dagu-cloud) で、すべてのサーバーの実行と失敗を確認でき、メール、Slack、Microsoft Teams、PagerDuty、Webhook にアラートを通知します。

SSO、ロール、監査ログは[セルフホストライセンス](/ja/overview/self-host-license)で利用できます。

## 手順 {#steps}

1. 実行頻度と、そのジョブに依存している関係者の観点で、ジョブを一覧にします。リスクの低いジョブから始めてください。
2. Rundeck の Web コンソールまたは API から、ジョブ定義を YAML としてエクスポートします。
3. スクリプトでエクスポートを DAG ファイルに変換します。[MCP で接続した AI クライアント](/ai/#write-workflows-with-an-ai-tool)に任せると、DAG を書き、保存前にサーバーで検証します。
4. CI で、すべてのファイルに対して `dagu validate` を実行します。
5. シークレットを Key Storage から移行します。
6. テスト対象に対して、または Rundeck ジョブの副作用を無効にした状態で、新しい DAG を Rundeck ジョブと並行して実行し、結果を比較します。
7. Rundeck のスケジュールを無効にし、Dagu のスケジュールを有効にします。
8. Rundeck を廃止する前に、[バックアップ](/ja/server-admin/backup-restore)と[アラート](/overview/console-monitoring-alerts)を設定します。
