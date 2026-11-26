# アップグレード {#upgrades}

このページでは、本番サーバーのアップグレード手順を説明します。`dagu upgrade` コマンド自体については、[セルフアップグレード](/server-admin/self-upgrade)を参照してください。

修正は最新の安定版リリース系列で提供されます。[サポートポリシー](/ja/server-admin/support-policy)を参照してください。

## アップグレードの前に {#before-you-upgrade}

1. 飛ばすすべてのバージョンについて、このページの「以前からのアップグレード」の節を確認します。対応が必要な変更がまとめられています。すべての変更はリリースノートにあります。https://github.com/dagucloud/dagu/releases
2. 設定、DAG、データディレクトリを[バックアップ](/ja/server-admin/backup-restore)します。
3. ワークフローが重要な場合は、先にステージングサーバーへ目的のバージョンをインストールします。[マルチ環境へのデプロイ](/server-admin/deployment/multi-environment)を参照してください。

## 単一サーバー {#single-server}

```bash
dagu upgrade --version v2.27.0
dagu version
```

`dagu upgrade` は、インストーラーが設定したサービスの再起動を提案します。`--yes` を指定した場合は、代わりに `sudo systemctl restart dagu` などの再起動コマンドを表示します。

`allow_web_upgrade: true` を設定すると、管理者は Web UI の更新通知で **Update now** を選んでアップグレードすることもできます。Dagu は最新の安定版をインストールし、サービスを通じて再起動します。[Web UI からのアップグレード](/server-admin/self-upgrade#upgrade-from-the-web-ui)を参照してください。

インターネットに接続できない場合は、[閉域網](/ja/server-admin/deployment/closed-network#install)の説明に従って、バイナリを手動で置き換えてください。

サービスが実行を残す設定になっていない場合、再起動すると進行中の実行は終了します。[再起動しても実行を続ける](#keep-runs-across-restarts)を参照してください。

## 再起動しても実行を続ける {#keep-runs-across-restarts}

各実行は独立したプロセスなので、それを開始した Dagu のプロセスが終了しても動き続け、自身の結果を記録できます。systemd のデフォルトの `KillMode=control-group` では、サービスの停止時に、実行を含むサービスのすべてのプロセスが終了します。`KillMode=process` にすると、終了するのは Dagu 本体だけです。

インストーラーは `KillMode=process` を設定します。古いインストーラーで設定したサービスは、インストーラーを再実行するか、次のオーバーライドを追加するまでデフォルトのままです。`dagu upgrade` はこれを検出し、サービスを再起動する前にオーバーライドの追加を提案します。

オーバーライドを手動で追加するには、サービスのオーバーライドを開きます。

```bash
sudo systemctl edit dagu
```

次の行を追加して、保存して終了します。

```ini
[Service]
KillMode=process
```

ユーザーサービスの場合は `systemctl --user edit dagu` を使います。`systemctl edit` は systemd を再読み込みするので、次の再起動からすでに実行が残ります。

macOS では、インストーラーが設定する launchd エージェントはすでに実行を残します。Windows では、サービスを再起動やアップグレードしても実行は続きます。

コンテナを停止すると、その中の実行も停止します。アップグレードの間に実行を最後まで終えるには、`signal_handling.drain_timeout` を設定します。停止する Dagu は新しい実行を開始せず、実行中のものが終わるまで最大でその時間だけ待ちます。[Graceful Shutdown](/server-admin/operations#graceful-shutdown) と、Helm の場合は [Kubernetes](/server-admin/deployment/kubernetes#upgrade) を参照してください。コンテナの外の[ワーカー](/server-admin/distributed/)で動く実行は、Dagu の再起動中も続きます。

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

## ワーカー {#workers}

各ワーカーホストのバイナリまたはイメージも更新してください。[ワーカーページ](/server-admin/distributed/workers/#web-ui-workers-page)には各ワーカーの Dagu のバージョンが表示され、サーバーより古いワーカーや新しいワーカーには印が付きます。すべてのワーカーの更新が終わったかをここで確認できます。

## 2.27.0 以前からのアップグレード {#upgrading-from-2-27-0-or-earlier}

ファイル名が `.test.yaml` または `.test.yml` で終わる DAG ファイルは、[ワークフローテスト](/writing-workflows/workflow-tests)のファイルとして扱われるようになります。DAG 一覧に表示されなくなり、スケジューラも実行せず、`dagu start` も受け付けません。アップグレードの前に、このようなファイルの名前を変更してください(例: `smoke.test.yaml` を `smoke-test.yaml` に変更)。あわせて、古い名前やパスでその DAG を開始しているもの(`dag.run` ステップの `dag` や、`dagu start` を実行するスクリプトなど)もすべて更新してください。

対象のファイルを探すには、サーバーと同じ設定と環境で `dagu config` を実行し、`DAGs directory` の行を確認します。スクリプトインストーラーで登録したサービスは、システムサービスでは `/var/lib/dagu`、ユーザーサービスでは `~/.dagu` の下にデータを置きます。確認したディレクトリを検索します。`-H` を付けると、そのディレクトリがシンボリックリンクの場合もリンク先を検索します。

```bash
dagu config | grep 'DAGs directory'
find -H /path/to/dags -name '*.test.yaml' -o -name '*.test.yml'
```

スクリプトや `dag.run` ステップからパスで開始する DAG ファイルを置いているディレクトリがほかにあれば、それぞれで同じ検索を行ってください。これらのコマンドは POSIX シェル用です。Windows では、`dagu config` が表示したディレクトリで、お使いのシェルを使って両方の名前を検索してください。

アップグレード後、`dagu scheduler`、`dagu server`、`dagu start-all` は起動時に、最初のドキュメントにトップレベルの `steps` があり `cases` がないファイルごとに、そのフルパスを含む警告をログに出力します。

```text
/path/to/dags/smoke.test.yaml reads as a DAG, with steps and no cases, but Dagu treats it as a test file and does not run it as a DAG; rename it, for example to smoke-test.yaml
```

## 2.26.0 以前からのアップグレード {#upgrading-from-2-26-0-or-earlier}

それより後のリリースでは、スケジューラの動作が 4 点変更されています。

- **cron スロットの実行 ID の形式が変更されました。** 新しいバージョンは、古いバージョンが開始した実行を認識できません。そのため、引き継ぎと同じ分に実行されたスロットが、再度実行される場合があります。スケジュールの実行予定がない分を選んで引き継いでください。
- **データディレクトリは、すべてのホストで同じパスでなければなりません。** データディレクトリが各スロットの実行 ID の一部になったためです。
- **ロックを失ったスケジューラは、0 ではなくステータス 1 で終了します。** 再起動の仕組みが必要です。
- **スケジューラを停止しても、そのスケジューラがキューから開始した実行は停止しなくなりました。** `scheduler.failover_recovery_window` が新たに追加され、デフォルトで有効(2 分)です。

Windows では、サービスが新しいバージョンで動き始めると、再起動しても実行は続きます。新しいバージョンを入れる再起動では 2.26.0 が開始した実行が終了するため、重要な実行が進行していないときにアップグレードしてください。

## Kubernetes {#kubernetes}

[Kubernetes](/server-admin/deployment/kubernetes#upgrade) を参照してください。新しいチャートのバージョンではデフォルトのイメージが変わることがあるため、先に `appVersion` を確認してください。

```bash
helm repo update
helm show chart dagu/dagu | grep -E '^(version|appVersion):'
```

## ロールバック {#roll-back}

新しいバージョンが書き込んだ状態は古いバージョンでは読み取れない場合があるため、アップグレード前に取得したバックアップをリストアしてロールバックします。次の手順を実行します。

1. すべてのホストで Dagu を停止します。
2. アップグレード前に取得したバックアップを[リストア](/ja/server-admin/backup-restore#restore)します。
3. 以前のバイナリをインストールし、Dagu を起動します。

バックアップ以降の実行は、履歴から失われます。
