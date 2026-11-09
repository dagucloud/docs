# トラブルシューティング {#troubleshooting}

まず、稼働中のシステムが報告する情報を確認します。

```bash
dagu version
dagu config                         # paths in use
dagu ps                             # runs in progress on this host
dagu history --limit 20             # recent runs
dagu status --run-id <run-id> <dag> # one run in detail
journalctl -u dagu-scheduler -n 200 # service logs, on systemd
curl -s http://localhost:8090/health # dagu scheduler only, not start-all
```

各実行のログファイルは `logs/<dag name>/` の下にあります。監査ログは `logs/admin/audit/` にあります。

## スケジューラのロックに関するメッセージ {#scheduler-lock-messages}

| ログメッセージ | 意味 | 対処方法 |
| --- | --- | --- |
| `Waiting to acquire scheduler lock` | このインスタンスはスタンバイです。別のスケジューラがロックを保持しています。 | スタンバイでは想定どおりの動作です。単一サーバーの場合は、同じデータディレクトリを使用している、停止し忘れたスケジューラがないか確認してください。 |
| `Acquired scheduler lock` | このインスタンスがアクティブになりました。 | 対処は不要です。 |
| `Took over the scheduler lock from a failed instance` | 以前のアクティブなスケジューラがロックの更新を停止しました。 | そのインスタンスに障害が発生した原因を調査してください。原因はそのホストのログで確認できます。 |
| `Failed to renew scheduler lock, will retry` | ロックの更新に失敗しました。通常は、ストレージの低速化または利用不可が原因です。 | ストレージを確認してください。失効しきい値を超えて続くと、このインスタンスは停止します。 |
| `Failed to check scheduler lock, will retry` | スタンバイがロックを読み取れませんでした。 | ストレージを確認してください。スタンバイは待機を続けます。 |
| `Skipping scheduler tick: scheduler lock lease expired` | インスタンスが長時間ロックを更新できず、何もディスパッチしていません。 | まもなく停止します。ストレージとホストの停滞を確認してください。 |
| `Scheduler lock lost, self-fencing` | インスタンスがロックを保持できなくなり、異常終了します。 | 再起動の仕組みによってインスタンスが再起動されたことを確認してください。その後、ストレージとホストのログで原因を調査してください。 |

## スケジュール {#schedules}

**スケジュールが実行されなかった。**

1. スケジューラがアクティブであることを確認します。`dagu scheduler` の場合は `curl -s 'http://localhost:8090/health?role=active'` を実行します。`dagu start-all` の場合はサービスが動いていることを確認します。
2. DAG が一時停止されていないか確認します。
3. スケジュールのタイムゾーンを確認します。`CRON_TZ=` はスケジュールごとに適用されます。指定がない場合は、サーバーのタイムゾーンが適用されます。
4. `dagu calendar fires` でビジネスカレンダーを確認します。
5. その時刻にスケジューラが稼働していなかった場合、そのスロットは実行されていません。[キャッチアップ](/writing-workflows/scheduling)と [`failover_recovery_window`](/ja/server-admin/deployment/high-availability#settings) を参照してください。

**スロットが 2 回実行された。** すべてのスケジューラのホストが 2.26.0 より後のリリースであること、およびデータディレクトリがすべてのホストで同じパスであることを確認してください。[高可用性](/ja/server-admin/deployment/high-availability)を参照してください。

**両方のスケジューラが `active` を報告している。** データディレクトリを共有していません。各ホストの `dagu config` を比較し、両方のホストに共有ボリュームがマウントされていることを確認してください。

## 実行 {#runs}

**実行中と表示されているが、プロセスが存在しない。** アクティブなスケジューラが、数分後にその実行を[失敗としてマーク](/writing-workflows/scheduling#zombie-detection)します。UI で実行を開くか、`dagu status` を使用すると、より早く修復できる場合があります。

**ホストのクラッシュ後に、実行が失敗としてマークされた。** これは想定どおりの動作です。障害が発生したホスト上の実行は再開されません。自動的に再度開始するには、DAG レベルの [`retry_policy`](/writing-workflows/durable-execution) を設定してください。

**スケジューラの再起動時に実行が停止する。** プロセスマネージャーが実行を終了させています。[`KillMode`](/ja/server-admin/deployment/high-availability#set-up-with-systemd) を参照してください。

**実行がキューで待機している。** [キュー](/server-admin/queues)の `max_concurrency` を確認してください。キューに入った実行の開始には、アクティブなスケジューラが必要です。

## ストレージ {#storage}

**NFS で `stale file handle` などの I/O エラーが発生する。** マウントで `hard` を使用していること、およびストレージサーバーが正常であることを確認してください。`soft` マウントでは、短時間の障害中に Dagu へエラーが返される場合があります。

**ディスクまたは inode がいっぱいになった。** `df -h` と `df -i` で確認し、`hist_retention_days` を減らしてください。[運用](/server-admin/operations)を参照してください。

## サインインとシークレット {#sign-in-and-secrets}

**再起動または移動の後、全員がサインアウトされた。** `data/auth/token_secret` が変更されたか、永続化されていませんでした。`data` ディレクトリは永続ストレージに配置してください。

**リストアまたは移動の後、シークレットを読み取れない。** `data/auth/encryption_key` が元のものではありません。[バックアップ](/ja/server-admin/backup-restore)からリストアしてください。

**コンソールに、すべてのサーバーが使用中と表示される。** サーバーが `data/license/` を失い、新規として登録されました。[サーバーの識別情報の維持](/ja/overview/self-host-license#keep-the-server-s-identity)を参照してください。

## サポートを受ける {#getting-help}

[サポートポリシー](/ja/server-admin/support-policy)を参照してください。Dagu のバージョン、インストール方法、オペレーティングシステム、ストレージの種類、およびシークレットを除去した関連ログ行を含めていただくと、報告への対応が最も容易になります。
