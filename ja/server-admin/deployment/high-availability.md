# スケジューラの高可用性 {#scheduler-high-availability}

2 台目のホストでスタンバイのスケジューラを実行します。アクティブなスケジューラに障害が発生すると、運用担当者の操作なしで、スタンバイがスケジュールとキューを引き継ぎます。

::: warning バージョン
このページは 2.26.0 より後のリリースについて説明しています。2.26.0 以前では、次のとおりです。

- `scheduler.lock_stale_threshold` を超えて処理が停滞したスケジューラは、スタンバイが引き継いだ後にもう一度ディスパッチすることがあります。そのため、1 つのスロットが 2 回実行される場合があります。
- ロックを失ったスケジューラは、ステータス 0 で終了します。
- 引き継ぎの間に実行されなかったスロットは、リプレイされません。
- `/health` はロールを返しません。
- スケジューラを停止すると、そのスケジューラがキューから開始した実行も停止します。
:::

## 仕組み {#how-it-works}

```text
        Host A                                  Host B
 +----------------------+               +----------------------+
 | dagu scheduler       |               | dagu scheduler       |
 |   ACTIVE             |               |   STANDBY            |
 | dagu server          |               | dagu server          |
 +----------+-----------+               +-----------+----------+
            |  renews the lock    watches the lock  |
            +------------------+   +----------------+
                               v   v
               Shared storage, same path on both hosts
               DAGU_HOME:  dags/  data/  logs/  config.yaml
```

データディレクトリを共有するスケジューラは、1 つのロックを取り合います。ロックを保持するインスタンスが**アクティブ**です。実行をスケジュールし、キューを消費するのはアクティブなインスタンスだけです。それ以外のインスタンスはすべて**スタンバイ**です。スタンバイは待機しながら、ロックの保持者がロックを更新していることを監視します。

`dagu server` はこの仕組みの対象外です。`dagu server` は両方のホストで同時に稼働します。どちらも同じファイルを読み取るため、どちらのホストでも UI と API を提供できます。前段に置くロードバランサーは、お客様にてご用意ください。

実行は、それを開始したスケジューラのホスト上で動作します。スタンバイは、アクティブになるまでスケジュールされた処理を開始しません。

## 障害時の動作 {#what-happens-on-failure}

| イベント | デフォルト設定での結果 |
| --- | --- |
| アクティブなスケジューラが正常に停止した場合 | ロックを解放します。スタンバイは、5 秒に起動処理の時間を加えた時間以内にアクティブになります。 |
| アクティブなスケジューラまたはそのホストがダウンした場合 | スタンバイは、40 秒に起動処理の時間を加えた時間以内にアクティブになります。 |
| アクティブなスケジューラの処理が停滞した場合、またはストレージを失った場合 | ロックの更新がないまま 23 秒経過すると、ディスパッチを停止して異常終了します。スタンバイは上の行と同様に引き継ぎます。再起動の仕組みが、異常終了したインスタンスをスタンバイとして再起動します。 |
| スタンバイに障害が発生した場合 | スケジュールされた処理に影響はありません。保護を回復するには、スタンバイを再起動してください。 |
| ホストが再起動し、クラッシュ時に残されたロックを検出した場合 | 30 秒後にアクティブになります。先に、ロックが更新されないことを確認する必要があるためです。 |

40 秒は `scheduler.lock_stale_threshold + 2 × scheduler.lock_retry_interval` です。23 秒は、失効しきい値から更新間隔を引いた値です。更新間隔は、7 秒としきい値の 4 分の 1 のうち、小さいほうです。

## 保証する内容 {#what-is-guaranteed}

以下の内容は、[要件](#requirements)を満たしている場合に成り立ちます。

**保証**

- アクティブなスケジューラがダウンした後、スタンバイは上記の時間以内にアクティブになります。
- 定期スケジュールの各スロットの実行は、フェイルオーバーの前後を含め、最大 1 件です。各スロットには 1 つの実行 ID があり、通常の実行とそのスロットのリプレイで同じ ID を共有します。
- 実行を開始したスケジューラが停止した場合や障害が発生した場合でも、プロセスマネージャーがその実行を終了させない限り、実行は継続します。[`KillMode`](#set-up-with-systemd) を参照してください。例外は `signal_handling.enable_propagation` です。これを使用すると、停止するスケジューラは、自身が開始した実行を停止します。
- ロックを失ったスケジューラは、0 以外のステータスで終了します。

**ベストエフォート**

- 失効したロックを引き継いだスケジューラは、障害が発生したスケジューラの最後のティック以降に実行されなかった定期スケジュールのスロットを、`scheduler.failover_recovery_window` の範囲でさかのぼってリプレイします。それより古いスロットがリプレイされるのは、DAG 自身の `catchup_window` がそのスロットに届く場合だけです。キューが無効な場合、リプレイは一切行われません。
- リプレイされた実行は、DAG の `overlap_policy` に従います。引き継ぎの時点で DAG がまだ実行中と見なされている場合、リプレイを実行するかどうかはこのポリシーによって決まります。

**提供しないこと**

- 副作用が厳密に 1 回だけ発生すること(exactly-once)、およびクラッシュ後のステップの再開。障害が発生したホスト上の実行は[失敗としてマーク](/writing-workflows/scheduling#zombie-detection)され、再開されません。スケジュールされた DAG を自動的に再度実行するには、DAG レベルの [`retry_policy`](/writing-workflows/durable-execution) を設定してください。
- 共有ストレージの可用性。共有ストレージが利用できない間は、どのスケジューラもロックを保持できず、復旧するまでスケジューリングは停止します。
- サイト間のフェイルオーバー。

## 要件 {#requirements}

| 要件 | 詳細 |
| --- | --- |
| 共有ストレージ | NFSv3 または NFSv4.x。すべてのホストで `hard,actimeo=0` を指定してマウントします。Kubernetes では `ReadWriteMany` ボリュームを使用します。 |
| 同一のパス | `DAGU_HOME`、またはデータディレクトリと DAG ディレクトリを、すべてのホストで同じ絶対パスに配置します。データディレクトリは各スロットの実行 ID の一部です。 |
| 同一のバージョン | [アップグレード](/ja/server-admin/upgrades)中の短い期間を除き、すべてのホストで同じバージョンの Dagu を実行します。 |
| 同一のユーザー | すべてのホストで、Dagu のユーザーの UID と GID を同じにします。 |
| 再起動の仕組み | `Restart=always` を設定した systemd など、終了したスケジューラを再起動する仕組みが必要です。ロックを失ったスケジューラは、自身では復帰しません。 |
| 時刻同期 | NTP または chrony を使用し、ホスト間の差を 1 秒以内にします。引き継ぎのタイミングは時刻同期に依存しませんが、スケジュールの時刻と実行の生存判定は依存します。 |
| キューの有効化 | 実行されなかったスロットをリプレイするには、`queues.enabled` をデフォルトの `true` のままにします。 |

## systemd での構成 {#set-up-with-systemd}

各ホストに共有ストレージをマウントします。ここでは `/srv/dagu` にマウントします。

```text
# /etc/fstab
nfs.example.internal:/export/dagu  /srv/dagu  nfs  hard,actimeo=0,_netdev  0  0
```

各ホストに `/etc/systemd/system/dagu-scheduler.service` を作成します。

```ini
[Unit]
Description=Dagu scheduler
After=network-online.target remote-fs.target
Wants=network-online.target
RequiresMountsFor=/srv/dagu

[Service]
Type=simple
User=dagu
Group=dagu
WorkingDirectory=/srv/dagu
ExecStart=/usr/local/bin/dagu scheduler
Restart=always
RestartSec=10
KillMode=process
Environment="DAGU_HOME=/srv/dagu"

[Install]
WantedBy=multi-user.target
```

スケジューラを再起動しても実行が継続するのは、`KillMode=process` によるものです。systemd のデフォルト設定、または `KillMode=mixed` では、ユニットを停止すると、そのユニットが開始したすべての実行が終了します。コンテナも同様です。Docker コンテナや Kubernetes の Pod が停止すると、その中の実行も停止します。

`/etc/systemd/system/dagu-server.service` も同じ手順で作成し、次の行を変更します。

```ini
Description=Dagu web server
ExecStart=/usr/local/bin/dagu server
Environment="DAGU_HOME=/srv/dagu"
Environment="DAGU_HOST=0.0.0.0"
```

各ホストで両方を起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dagu-scheduler dagu-server
```

`dagu start-all` ではなく、別々のユニットを使用してください。`dagu start-all` はヘルスエンドポイントを提供しません。また、スケジューラがロックを失うと、Web サーバーも一緒に停止します。

## ペアの確認 {#check-the-pair}

各スケジューラは `scheduler.port`(デフォルトは 8090)でロールを返します。

```bash
curl -s http://host-a:8090/health
# {"status":"healthy","role":"active"}

curl -s http://host-b:8090/health
# {"status":"healthy","role":"standby"}

curl -s -o /dev/null -w '%{http_code}\n' 'http://host-b:8090/health?role=active'
# 503
```

フェイルオーバーを前提に運用する前に、お使いのストレージでリハーサルしてください。アクティブなホストで、スケジューラのプロセスだけを強制終了します。

```bash
sudo kill -9 "$(systemctl show -p MainPID --value dagu-scheduler)"
```

40 秒に起動処理の時間を加えた時間以内に、もう一方のホストの `/health?role=active` が `200` を返し、そのログに `Took over the scheduler lock from a failed instance` が出力されます。強制終了したスケジューラは systemd が再起動し、スタンバイとして復帰します。

## 監視 {#monitor}

`GET /health?role=active` は、アクティブなインスタンスでのみ `200` を返します。そのため、プローブやロードバランサーはアクティブなインスタンスを特定できます。

Web サーバーの[メトリクス](/server-admin/prometheus-metrics)には、`active` または `standby` のインスタンス数を示す `dagu_scheduler_instances{status}` が含まれます。

```yaml
groups:
  - name: dagu-scheduler
    rules:
      - alert: DaguNoActiveScheduler
        expr: dagu_scheduler_instances{status="active"} != 1
        for: 2m
      - alert: DaguNoStandbyScheduler
        expr: dagu_scheduler_instances{status="standby"} < 1
        for: 10m
```

スケジューラのログメッセージとそれぞれの対処方法は、[トラブルシューティング](/ja/server-admin/troubleshooting#scheduler-lock-messages)に記載しています。

## 設定 {#settings}

| キー | 環境変数 | デフォルト | 意味 |
| --- | --- | --- | --- |
| `scheduler.lock_stale_threshold` | `DAGU_SCHEDULER_LOCK_STALE_THRESHOLD` | `30s` | スタンバイがロックを取得するまでに、ロックが更新されない状態を許容する時間 |
| `scheduler.lock_retry_interval` | `DAGU_SCHEDULER_LOCK_RETRY_INTERVAL` | `5s` | スタンバイがロックの取得を試みる間隔 |
| `scheduler.failover_recovery_window` | `DAGU_SCHEDULER_FAILOVER_RECOVERY_WINDOW` | `2m` | 引き継ぎ時に、実行されなかったスロットをどこまでさかのぼってリプレイするか。`0s` を指定すると無効になります |
| `scheduler.port` | `DAGU_SCHEDULER_PORT` | `8090` | ヘルスエンドポイントのポート。`0` を指定すると無効になります |

失効しきい値を小さくすると、フェイルオーバーの時間は短くなります。ただし、ストレージの短時間の停滞によって、アクティブなスケジューラが終了する可能性も高くなります。

## Kubernetes {#kubernetes}

Helm チャートは、分散モードでスタンバイを実行します。[Kubernetes](/server-admin/deployment/kubernetes#standby-schedulers) を参照してください。

## ライセンス {#licensing}

データディレクトリを共有するホストは、1 つのサーバー ID を共有します。そのため、アクティブ/スタンバイのペアが使用するライセンス枠は 1 つです。

## 分散ワーカー {#distributed-workers}

このページはスケジューラを対象としています。他のマシンでステップを実行するには、[分散実行](/server-admin/distributed/)を参照してください。
