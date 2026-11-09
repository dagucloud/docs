# Rundeck からの移行 {#migrating-from-rundeck}

インポートツールはありません。移行では、各ジョブを YAML ファイルとして書き直します。通常、この作業は機械的に行えます。数個のジョブずつ移行し、切り替える前に Rundeck と並行して実行する計画を立ててください。

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
| Key Storage | シークレット |
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

## 移行できないもの {#what-does-not-carry-over}

- **ノードフィルターとリソースモデル。** Dagu にはフリートのインベントリがありません。ホストを直接指定するか、ワーカーラベルを使用し、ファンアウトは [`parallel`](/writing-workflows/control-flow) で表現してください。
- **ジョブ単位の ACL。** ロールはサーバー全体またはワークスペースに適用されます。そのため、1 つのジョブだけをグループに割り当てることはできません。グループを特定のジョブに限定するには、それらのジョブ専用のワークスペースを用意してください。
- **プラグイン。** Rundeck のプラグインは Dagu では動作しません。[ステップタイプ](/step-types/shell)を使用するか、コマンドから同じツールを呼び出してください。
- **クラスターモード。** Dagu は、1 つのアクティブなスケジューラと、[共有ストレージ上のスタンバイ](/ja/server-admin/deployment/high-availability)で構成します。これは Rundeck クラスターとは異なる設計です。

SSO、ロール、監査ログには[セルフホストライセンス](/ja/overview/self-host-license)が必要です。

## 手順 {#steps}

1. 実行頻度と、そのジョブに依存している関係者の観点で、ジョブを一覧にします。リスクの低いジョブから始めてください。
2. Rundeck の Web コンソールまたは API から、ジョブ定義を YAML としてエクスポートします。
3. エクスポートを DAG ファイルに変換するスクリプトを作成します。または、対応関係を把握するために、いくつかを手動で変換します。
4. CI で、すべてのファイルに対して `dagu validate` を実行します。
5. シークレットを Key Storage から移行します。
6. テスト対象に対して、または Rundeck ジョブの副作用を無効にした状態で、新しい DAG を Rundeck ジョブと並行して実行し、結果を比較します。
7. Rundeck のスケジュールを無効にし、Dagu のスケジュールを有効にします。
8. Rundeck を廃止する前に、[バックアップ](/ja/server-admin/backup-restore)と[アラート](/server-admin/prometheus-metrics)を設定します。
