# JP1/AJS3 からの移行 {#migrating-from-jp1-ajs3}

自動変換ツールはありません。Dagu の定義はプレーンな YAML であるため、移行はお客様が作成する、再実行可能なスクリプトとして行います。ユニット定義をテキストでエクスポートし、DAG ファイルを生成して、検証します。ジョブグループを 1 つずつ移行し、切り替える前に JP1/AJS3 と並行して実行してください。

JP1 は製品群です。Dagu が置き換えるのはジョブスケジューリングの部分だけです。監視、資産管理など、その他の JP1 製品には、それぞれ別の代替が必要です。

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

## 計画時の考慮事項 {#what-to-plan-for}

- **可用性。** 同時にアクティブになるスケジューラは 1 つだけです。スケジューラに障害が発生すると、[共有ストレージ上のスタンバイ](/ja/server-admin/deployment/high-availability)が引き継ぎます。ストレージはお客様にてご用意ください。障害が発生したホスト上の実行は失敗としてマークされ、再開されません。
- **サポート。** Team および Pro ライセンスにサポートは含まれません。Enterprise 契約では応答目標が追加されます。[サポートポリシー](/ja/server-admin/support-policy)を参照してください。
- **運用担当者のアクセス。** SSO、ロール、監査ログには[セルフホストライセンス](/ja/overview/self-host-license)が必要です。ロールはサーバー全体またはワークスペースに適用され、個々のジョブには適用されません。
- **期限のアラート。** 期限超過と開始遅延のアラートは Dagu Console が発行するため、[閉域網](/ja/server-admin/deployment/closed-network#alerts-without-dagu-console)では利用できません。

## 手順 {#steps}

1. 1 つのジョブグループについて、ユニット定義をテキストでエクスポートします。
2. スクリプトで対応付けます。ユニットはステップに、関連線は `depends` に、リカバリーユニットは `handler_on.failure` に対応付けます。
3. 生成したすべてのファイルに対して `dagu validate` を実行します。
4. カレンダーを再作成し、`dagu calendar fires` で次回の起動時刻を比較します。
5. テストデータを使用して、または副作用を無効にした状態で、ジョブグループを JP1/AJS3 と並行して実行し、結果を比較します。
6. JP1/AJS3 でジョブグループを停止し、Dagu でそのスケジュールを有効にします。
7. 次のジョブグループを移行する前に、[バックアップ](/ja/server-admin/backup-restore)と[アラート](/server-admin/prometheus-metrics)を設定します。
