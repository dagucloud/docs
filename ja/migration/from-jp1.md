# JP1/AJS3 からの移行 {#migrating-from-jp1-ajs3}

JP1/AJS3 のジョブネットは、Dagu の DAG に対応します。DAG は 1 つの YAML ファイルで、Git で管理できます。このページでは、JP1/AJS3 の概念と Dagu および Dagu Cloud の対応、変換したジョブネットの例、ジョブグループ単位での移行手順を説明します。

JP1/AJS3 の定義を移行するツールが必要な場合は、[リクエストしてください](https://dagu.sh/ja/contact)。

## 概念の対応 {#how-the-concepts-map}

| JP1/AJS3 | Dagu |
| --- | --- |
| ジョブネット | [DAG](/writing-workflows/basics)(1 つの YAML ファイル) |
| ジョブ | [ステップ](/writing-workflows/basics#steps) |
| 関連線 | `depends` |
| ネストジョブネット | [`dag.run`](/writing-workflows/sub-dags) ステップ |
| リカバリージョブ | `handler_on.failure` |
| 再実行 | 同じ実行には `dagu retry`、新しい実行には `dagu restart` |
| スケジュールルール | [`schedule`](/writing-workflows/scheduling) |
| カレンダー | [ビジネスカレンダー](/writing-workflows/business-calendars) |
| ファイル待ちの起動条件 | [`wait.file`](/step-types/wait) ステップ |
| エージェントホスト | [SSH](/step-types/ssh)、または `worker_selector` で選択した[ワーカー](/server-admin/distributed/) |
| 同時実行数の制限 | 実行内では `max_active_steps`、実行をまたぐ場合は名前付きの[キュー](/server-admin/queues) |
| 操作画面 | ブラウザで使う [Web UI](/overview/web-ui) と `dagu` CLI |
| 操作権限 | サーバー単位またはワークスペース単位の[ロール](/server-admin/authentication/user-management)。SSO と監査ログに対応 |
| 開始遅延・終了遅延の監視 | Dagu Console の[期限、スケジュール未実行、長時間実行のアラート](/overview/console-monitoring-alerts) |
| 複数サーバーのジョブ監視 | [Dagu Console](/overview/console-monitoring)。すべてのサーバーの実行、失敗、マシンの状態を 1 か所で確認 |
| マネージャーホストのデータベース | データディレクトリ内のファイル |

## 例 {#example}

ファイルを待ち、3 つのジョブを順に実行し、失敗時にリカバリージョブを呼び出す夜間ジョブネットの例です。

```yaml
type: graph
schedule: "CRON_TZ=Asia/Tokyo 30 22 * * *"
calendar: weekdays

steps:
  - id: wait_for_sales_file
    action: wait.file
    with:
      path: /data/inbound/sales.csv
      poll_interval: 30s
    timeout_sec: 3600

  - id: load_sales
    run: /opt/batch/load_sales.sh
    depends: wait_for_sales_file

  - id: aggregate
    run: /opt/batch/aggregate.sh
    depends: load_sales

  - id: export_report
    run: /opt/batch/export_report.sh
    depends: aggregate

handler_on:
  failure:
    run: /opt/batch/recover_sales.sh
```

日本の祝日に対応するには、`weekdays` を[カレンダーファイル](/writing-workflows/business-calendars)に置き換えてください。

## 移行後の運用 {#operations-after-the-move}

- **監視とアラート。** [Dagu Console](/overview/dagu-cloud) で、すべてのサーバーの実行と失敗を確認できます。ジョブの失敗、期限超過、スケジュールどおりに開始しなかった実行、通常より大幅に長い実行をアラートとして、メール、Slack、Microsoft Teams、PagerDuty、Webhook に通知します。閉域網では、Enterprise 契約により Control Plane をお客様のネットワーク内に配置できます。[社内に置く Control Plane](/ja/server-admin/deployment/closed-network#private-control-plane) を参照してください。
- **可用性。** [共有ストレージ上のスタンバイスケジューラ](/ja/server-admin/deployment/high-availability)が、アクティブなスケジューラの停止時に自動で引き継ぎます。
- **運用担当者のアクセス。** `operator` ロールはジョブの実行と停止ができ、定義は編集できません。`viewer` は参照のみです。サインインは SSO でお客様の ID プロバイダーを使用し、変更は監査ログに記録されます。[プランとライセンス](/ja/overview/self-host-license)を参照してください。
- **サポート。** Enterprise 契約には、応答目標を定めたサポートが含まれます。[サポートポリシー](/ja/server-admin/support-policy)を参照し、[お問い合わせ](https://dagu.sh/ja/contact)ください。

## 手順 {#steps}

1. 1 つのジョブグループについて、ユニット定義をテキストでエクスポートします。
2. DAG ファイルに変換します。ユニットはステップに、関連線は `depends` に、リカバリーユニットは `handler_on.failure` に対応付けます。スクリプトで機械的に変換できます。[MCP で接続した AI クライアント](/ai/#write-workflows-with-an-ai-tool)に任せると、DAG を書き、保存前にサーバーで検証します。
3. 生成したすべてのファイルに対して `dagu validate` を実行します。
4. カレンダーを再作成し、`dagu calendar fires` で次回の起動時刻を比較します。
5. テストデータを使用して、または副作用を無効にした状態で、ジョブグループを JP1/AJS3 と並行して実行し、結果を比較します。
6. JP1/AJS3 でジョブグループを停止し、Dagu でそのスケジュールを有効にします。
7. 次のジョブグループを移行する前に、[バックアップ](/ja/server-admin/backup-restore)と[アラート](/overview/console-monitoring-alerts)を設定します。
