# バックアップとリストア {#backup-and-restore}

Dagu はすべての状態をファイルに保存します。そのため、バックアップとはそれらのファイルのコピーです。データベースのダンプは必要ありません。

## バックアップの対象 {#what-to-back-up}

以下のパスは `DAGU_HOME` からの相対パスです。`DAGU_HOME` を設定していない場合、設定と DAG は `~/.config/dagu` に、`data/` と `logs/` は `~/.local/share/dagu` にあります。使用中のパスは `dagu config` で確認できます。

| パス | 内容 | バックアップ |
| --- | --- | --- |
| `config.yaml`、`base.yaml`、`calendars/` | 設定、DAG の共通デフォルト、ビジネスカレンダー | 必須 |
| `dags/` | DAG 定義と Wiki | 必須(すべて Git で管理している場合を除く) |
| `data/auth/` | 暗号鍵とサインイントークンのシークレット | 必須。シークレットとして扱ってください。 |
| `data/secrets/` | 暗号化されたシークレット | 必須 |
| `data/users/`、`data/apikeys/`、`data/webhooks/`、`data/workspaces/` | ユーザー、API キー、Webhook、ワークスペース | 必須 |
| `data/license/` | サーバー ID とライセンス | 必須。これがないと、サーバーは新規として登録され、ライセンス枠をもう 1 つ使用します。 |
| `data/scheduler/` | スケジュールの状態(`locks/` を除く) | キャッチアップに必須 |
| `data/` のその他のファイル | 実行履歴、キュー、アーティファクト、通知設定 | 推奨 |
| `logs/` | 実行ログ | 保持ポリシーの要件に応じて |
| `logs/admin/audit/` | 監査ログ | 保持ポリシーの要件に応じて |

次のパスはバックアップから除外してください。これらは、リストア後には存在しないプロセスに関する情報です。

- `data/proc/`
- `data/service-registry/`
- `data/scheduler/locks/`
- `data/cache/`

::: danger 暗号鍵を保管してください
シークレットなど Dagu が暗号化する値は、`data/auth/encryption_key` の鍵、または `DAGU_ENCRYPTION_KEY` が設定されている場合はその鍵でのみ読み取れます。鍵が存在しない場合、Dagu は新しい鍵を生成し、古い値は読み取れなくなります。バックアップは、保護対象のシークレットと同等に慎重に保管してください。
:::

## バックアップの手順 {#back-up}

整合性のあるコピーを取得するには、先に Dagu を停止します。この例では `DAGU_HOME=/srv/dagu` としています。

```bash
sudo systemctl stop dagu-scheduler dagu-server

sudo tar -C /srv -czf /backup/dagu-$(date +%F).tar.gz \
  --exclude='dagu/data/proc' \
  --exclude='dagu/data/service-registry' \
  --exclude='dagu/data/scheduler/locks' \
  --exclude='dagu/data/cache' \
  dagu

sudo systemctl start dagu-scheduler dagu-server
```

停止せずにバックアップするには、LVM、ZFS、または NFS ファイラーを使用して、ボリュームのアトミックなスナップショットを取得してください。稼働中のシステムからファイルをコピーすると、あるファイルは変更前、関連するファイルは変更後の状態でコピーされることがあります。

アクティブ/スタンバイのペアでは、両方のホストで Dagu を停止してください。停止しないと、コピー中にもう一方のホストが書き込みを続けます。

## リストアの手順 {#restore}

1. すべてのホストで Dagu を停止します。
2. ファイルを同じ絶対パスにリストアします。データディレクトリは各スロットの実行 ID の一部です。そのため、パスが異なると、スロットに新しい ID が割り当てられます。

   ```bash
   sudo tar -C /srv -xzf /backup/dagu-2026-11-09.tar.gz
   sudo chown -R dagu:dagu /srv/dagu
   ```

3. `catchup_window` を設定している DAG を確認します。スケジューラが起動すると、これらの DAG は、バックアップ以降に実行されなかったスロットを、各 DAG のウィンドウの範囲でリプレイします。先に `dagu server` を起動し、実行してはならない DAG を[一時停止](/web-ui/api#suspend-resume-dag-scheduling)してください。
4. スケジューラを起動します。
5. 結果を確認します。

   ```bash
   dagu history --limit 5
   curl -s http://localhost:8090/health # dagu scheduler only, not start-all
   ```

   暗号鍵がリストアされたことを確認するため、シークレットを使用する DAG を開いて実行してください。

バックアップの取得時に進行中だった実行のステータスは、実行中になっています。Dagu はそのプロセスが存在しないことを検出し、[失敗としてマーク](/writing-workflows/scheduling#zombie-detection)します。

## バックアップのテスト {#test-your-backups}

妥当性を説明できる周期で別のホストにリストアし、シークレットを使用するワークフローを 1 つ実行してください。リストアを試していないバックアップは、仮定にすぎません。
