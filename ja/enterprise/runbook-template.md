---
title: 運用手順書テンプレート
description: Dagu の運用手順書の下書きです。起動と停止、状態確認、ジョブの再実行、障害対応、バックアップ、バージョンアップの手順を含みます。
---

# 運用手順書テンプレート

運用手順書の下書きです。〈 〉の部分を環境に合わせて書き換えてください。アクティブ/スタンバイ構成を前提にしています。単一ノードの場合は、`dagu-scheduler` と `dagu-server` を 1 つのサービスに読み替えてください。

## 1. システム概要

| 項目 | 内容 |
| --- | --- |
| Dagu のバージョン | 〈2.x.x〉 |
| ホスト | 〈host-a〉、〈host-b〉 |
| データディレクトリ (`DAGU_HOME`) | 〈/srv/dagu〉 |
| Web UI の URL | 〈https://dagu.example.internal〉 |
| サービス | `dagu-scheduler`、`dagu-server` |
| OS ユーザー | 〈dagu〉 |
| 連絡先 | 〈一次受け〉、〈二次受け〉、〈ストレージ担当〉 |

## 2. 起動と停止

各ホストで実行します。

```bash
# 起動
sudo systemctl start dagu-scheduler dagu-server

# 停止
sudo systemctl stop dagu-scheduler dagu-server

# 状態確認
systemctl status dagu-scheduler dagu-server
```

スケジューラを停止しても、`KillMode=process` を設定していれば、実行中のジョブは止まりません。

## 3. 日常の確認

| 確認項目 | 方法 | 正常な状態 |
| --- | --- | --- |
| アクティブのスケジューラ | `curl -s http://〈host〉:8090/health` を全ホストで実行 | `role` が `active` のホストが 1 台だけ |
| スタンバイのスケジューラ | 同上 | `role` が `standby` のホストがある |
| 直近の失敗 | `dagu history --status failed --last 24h` | 想定外の失敗がない |
| ディスク | `df -h 〈/srv/dagu〉`、`df -i 〈/srv/dagu〉` | 使用率が 〈80〉% 未満 |
| 監査ログ | Web UI の **Settings > Audit Logs** | 想定外の操作がない |

## 4. ジョブの操作

```bash
# 実行中のジョブの一覧 (このホスト)
dagu ps

# 実行履歴
dagu history 〈DAG 名〉 --last 7d

# 実行の詳細
dagu status --run-id=〈実行 ID〉 〈DAG 名〉

# 失敗した実行を再実行 (同じ実行 ID)
dagu retry --run-id=〈実行 ID〉 〈DAG 名〉

# 実行中のジョブを停止
dagu stop --run-id=〈実行 ID〉 〈DAG 名〉

# 手動で実行
dagu start 〈DAG ファイル〉
```

スケジュールの一時停止は、Web UI で対象の DAG を suspend します。

再実行の判断基準:

| ジョブ | 再実行の可否 | 再実行の前に確認すること |
| --- | --- | --- |
| 〈ジョブ名〉 | 〈可 / 否〉 | 〈途中まで処理したデータの扱い〉 |

## 5. 障害対応

### 5.1 ジョブが失敗した

1. Web UI または `dagu status` で、失敗したステップとログを確認します。
2. 原因を取り除きます。
3. 第 4 章の判断基準に従い、再実行します。

### 5.2 スケジューラがフェイルオーバーした

検知: 監視の通報、またはログの `Took over the scheduler lock from a failed instance`

1. 新しいアクティブのホストを `/health` で確認します。
2. 障害が起きたホストの状態を確認します。

   ```bash
   journalctl -u dagu-scheduler -n 200
   ```

3. 障害が起きたホストで実行中だったジョブは、数分以内に失敗扱いになります。`dagu history --status failed --last 1h` で確認し、第 4 章の判断基準に従って再実行します。
4. 引き継ぎの間に予定されていたスロットは、既定で 2 分前まで再実行されます。それより前のスロットは手動で実行します。
5. 障害が起きたホストを復旧させ、スタンバイに戻ったことを `/health` で確認します。

### 5.3 共有ストレージの障害

症状: ログの `Failed to renew scheduler lock, will retry`、`Scheduler lock lost, self-fencing`

1. ストレージ担当へ連絡します。
2. 復旧を待ちます。復旧すると、スケジューラは再起動の仕組みにより自動で動き出します。
3. アクティブが 1 台であることを `/health` で確認します。
4. 停止中に予定されていたジョブを確認し、必要なものを手動で実行します。

ログの意味は[トラブルシューティング](/ja/server-admin/troubleshooting#scheduler-lock-messages)を参照してください。

## 6. バックアップ

| 項目 | 内容 |
| --- | --- |
| 方式 | 〈ボリュームのスナップショット / 停止してコピー〉 |
| 頻度 | 〈毎日 AM 3:00〉 |
| 保管先 | 〈別拠点のストレージ〉 |
| 保管世代 | 〈7〉 |

手順と復旧は[バックアップと復旧](/ja/server-admin/backup-restore)を参照してください。バックアップには暗号鍵 (`data/auth/encryption_key`) が含まれるため、シークレットと同じ水準で保管します。

## 7. バージョンアップ

1. リリースノートを確認します。
2. 検証環境で確認します。
3. バックアップを取得します。
4. [アップグレード](/ja/server-admin/upgrades#active-and-standby-pair)の手順に従い、スタンバイから順に更新します。

## 8. ライセンス

| 項目 | 内容 |
| --- | --- |
| 種別 | 〈オンライン / オフライン〉 |
| 有効期限 | 〈yyyy-mm-dd〉 |
| 更新の担当 | 〈担当者〉 |

有効期限が切れても、有料機能は 14 日間は動作します。それまでに更新してください。

## 9. 変更履歴

| 日付 | 版 | 内容 | 作成者 |
| --- | --- | --- | --- |
| 〈yyyy-mm-dd〉 | 1.0 | 初版 | 〈氏名〉 |
