# アップグレード {#upgrades}

このページでは、本番サーバーのアップグレード手順を説明します。`dagu upgrade` コマンド自体については、[セルフアップグレード](/server-admin/self-upgrade)を参照してください。

修正が提供されるのは、最新の安定版リリース系列のみです。[サポートポリシー](/ja/server-admin/support-policy)を参照してください。

## アップグレードの前に {#before-you-upgrade}

1. 現在のバージョンから目的のバージョンまでの間にある、すべてのバージョンのリリースノートを確認します。https://github.com/dagucloud/dagu/releases
2. 設定、DAG、データディレクトリを[バックアップ](/ja/server-admin/backup-restore)します。
3. ワークフローが重要な場合は、先にステージングサーバーへ目的のバージョンをインストールします。[マルチ環境へのデプロイ](/server-admin/deployment/multi-environment)を参照してください。

## 単一サーバー {#single-server}

```bash
dagu upgrade --version v2.26.0
sudo systemctl restart dagu
dagu version
```

インターネットに接続できない場合は、[閉域網](/ja/server-admin/deployment/closed-network#install)の説明に従って、バイナリを手動で置き換えてください。

進行中の実行は、プロセスマネージャーが実行を残す設定になっている場合を除き、サービスの再起動時に終了します。重要な実行が進行していないときに再起動するか、[高可用性](/ja/server-admin/deployment/high-availability#set-up-with-systemd)の説明のとおり `KillMode=process` を設定してください。

## アクティブ/スタンバイのペア {#active-and-standby-pair}

スタンバイを先にアップグレードします。こうすると、アップグレード済みのインスタンスが 1 回だけ引き継ぎを行い、古いバージョンが新しいバージョンから引き継ぐことはありません。

1. スタンバイを特定します。

   ```bash
   curl -s http://host-a:8090/health
   curl -s http://host-b:8090/health
   ```

2. スタンバイのホストで Dagu を停止し、バイナリを置き換えて、起動します。スタンバイとして復帰します。

   ```bash
   sudo systemctl stop dagu-scheduler dagu-server
   # install the new binary at /usr/local/bin/dagu
   sudo systemctl start dagu-scheduler dagu-server
   ```

3. アクティブなホストでも同じ手順を実行します。スケジューラは停止時にロックを解放するため、アップグレード済みのスタンバイは、`scheduler.lock_retry_interval` に起動処理の時間を加えた時間以内にアクティブになります。
4. すべてのホストが新しいバージョンを報告し、アクティブなホストがちょうど 1 台であることを確認します。

   ```bash
   dagu version
   curl -s -o /dev/null -w '%{http_code}\n' 'http://host-a:8090/health?role=active'
   curl -s -o /dev/null -w '%{http_code}\n' 'http://host-b:8090/health?role=active'
   ```

## 2.26.0 以前からのアップグレード {#upgrading-from-2-26-0-or-earlier}

それより後のリリースでは、スケジューラの動作が 4 点変更されています。

- **cron スロットの実行 ID の形式が変更されました。** 新しいバージョンは、古いバージョンが開始した実行を認識できません。そのため、引き継ぎと同じ分に実行されたスロットが、再度実行される場合があります。スケジュールの実行予定がない分を選んで引き継いでください。
- **データディレクトリは、すべてのホストで同じパスでなければなりません。** データディレクトリが各スロットの実行 ID の一部になったためです。
- **ロックを失ったスケジューラは、0 ではなくステータス 1 で終了します。** 再起動の仕組みが必要です。
- **スケジューラを停止しても、そのスケジューラがキューから開始した実行は停止しなくなりました。** `scheduler.failover_recovery_window` が新たに追加され、デフォルトで有効(2 分)です。

## Kubernetes {#kubernetes}

[Kubernetes](/server-admin/deployment/kubernetes#upgrade) を参照してください。新しいチャートのバージョンではデフォルトのイメージが変わることがあるため、先に `appVersion` を確認してください。

```bash
helm repo update
helm show chart dagu/dagu | grep -E '^(version|appVersion):'
```

## ロールバック {#roll-back}

Dagu は、新しいバージョンが書き込んだ状態を古いバージョンが読み取れることを保証しません。また、ダウングレードはテストされていません。ロールバックするには、次の手順を実行します。

1. すべてのホストで Dagu を停止します。
2. アップグレード前に取得したバックアップを[リストア](/ja/server-admin/backup-restore#restore)します。
3. 以前のバイナリをインストールし、Dagu を起動します。

バックアップ以降の実行は、履歴から失われます。
