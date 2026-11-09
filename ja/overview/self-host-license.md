# ライセンスの比較 {#license-comparison}

このページでは、セルフホスト向けの Community、Team、Pro の各プランを比較します。価格は記載していません。最新の商用条件については、[料金ページ](https://dagu.sh/pricing)を参照してください。

## 一覧 {#at-a-glance}

| 機能 | Community | Team | Pro |
| --- | --- | --- | --- |
| コアのワークフローオーケストレーション | ✓ | ✓ | ✓ |
| Web UI | ✓ | ✓ | ✓ |
| ワーカー | ✓ | ✓ | ✓ |
| Docker run アクション | ✓ | ✓ | ✓ |
| API キー | △ 最大 2 個 | ✓ | ✓ |
| OIDC/SSO | - | ✓ | ✓ |
| ユーザー管理 | - | ✓ | ✓ |
| 監査ログ | - | ✓ | ✓ |
| 通知ルーティング | ✓ | ✓ | ✓ |
| インシデントルーティング | - | ✓ | ✓ |
| Dagu Console での監視 | △ 1 サーバー、無料 | ✓ | ✓ |
| [Dagu Console ワークスペースの人数](/overview/console-members) | △ オーナーのみ | 最大 10 人 | 最大 10 人 |
| Dagu Cloud 経由の公開 Webhook URL | △ サーバーごとに 1 個、無料の監視を利用 | ✓ | ✓ |
| Dagu Cloud からのリモートアクセス (MCP) | - | ✓ | ✓ |

## 補足 {#notes}

- **ワーカー:** サーバーの外部でジョブを実行します。セルフホストのワーカーに個別のライセンスは不要です。
- **サーバーライセンス:** Team にはセルフホストのサーバーライセンスが 3 個、Pro には 15 個含まれます。
- **API キー:** Community のセルフホストでは、API キーを最大 2 個まで使用できます。
- **OIDC/SSO:** 外部の ID プロバイダでログインします。
- **ユーザー管理:** ユーザーの作成、更新、無効化、削除を行います。
- **監査ログ:** 管理操作およびセキュリティに関わるアクティビティを確認します。
- **通知ルーティング:** ワークフローのイベントをチームのチャンネルに送信します。
- **インシデントルーティング:** 失敗したワークフローについて、プロバイダのインシデントを起票および解決します。
- **Dagu Console での監視:** 接続したサーバーの稼働状態、実行、傾向を 1 か所で確認できます。ワークフローの失敗時やサーバーからの報告が途絶えたときには、メールを受け取れます。Community サーバーは、ワークスペースごとに 1 台まで、低い上限で無料で監視できます。この場合もサーバーは Community のままです。詳細は[無料と有料](/overview/console-monitoring#free-and-paid)を参照してください。
- **Dagu Cloud 経由の公開 Webhook URL:** DAG の Webhook にインターネット上のアドレスを割り当てます。これにより、パブリックアドレスを持たないサーバー上の DAG を、GitHub、Stripe、Slack から起動できます。接続済みのサーバーでは最大 1,000 個、無料の監視を利用するサーバーでは 1 個です。詳細は[公開 Webhook URL](/server-admin/authentication/public-webhook-urls)を参照してください。
- **Dagu Cloud からのリモートアクセス (MCP):** Dagu Cloud に接続した MCP クライアントが、サーバーの MCP ツールを使用できるようにします。接続はサーバーが開始し、サーバーの管理者が選択したロールが上限です。Team プランまたは Pro プラン、もしくはトライアルが必要です。詳細は [Dagu Cloud からのリモートアクセス](/overview/cloud-remote-access)を参照してください。

## サーバーの接続 {#connect-a-server}

[Dagu Console](https://console.dagu.sh) の Team または Pro のワークスペースには、一定数のサーバースロットがあります。プランのないワークスペースには、Dagu v2.19.2 以降の[無料の監視](/overview/console-monitoring#free-and-paid)用に 1 つのスロットがあります。ワークスペースのライセンスを使用する Dagu サーバーは、それぞれ 1 スロットを消費します。コンソールの **Instances** ページには、すべてのサーバーが名前、最終チェックイン、Dagu のバージョンとともに表示されます。ワーカーはスロットを消費しません。

サーバーの[監視](/overview/console-monitoring)、[公開 Webhook URL](/server-admin/authentication/public-webhook-urls)、[リモートアクセス](/overview/cloud-remote-access)が有効でない限り、接続によって共有されるのはライセンスのチェックインのみです。詳細は [Dagu Cloud: セキュリティとデータの流れ](/ja/overview/security)を参照してください。監視を有効にすると、コンソールに各サーバーの稼働状態と実行が表示され、ワークフローの失敗時やサーバーからの報告が途絶えたときにメールが届きます。Community サーバーでは、**Monitor this server for free** カードを使うと、接続の一環として監視が有効になります。

### Web UI から接続する {#from-the-web-ui}

1. 管理者として **Plan & features** を開きます。**Monitor this server for free** カードで、サーバーが報告する内容を選択し、**Connect for free** を選択します。有料機能の 14 日間のトライアルを同じ手順で開始するには、**Also try paid features free for 14 days** も選択します。
2. 新しいタブで Dagu Console が開きます。サインインまたはサインアップし、Dagu と同じコードが表示されていることを確認します。ワークスペースを選択し、サーバーを承認します。Dagu は承認を最大 1 時間待ちます。
3. Dagu は数秒以内にライセンスを読み込みます。**Overview** には、サーバーの名前、ワークスペース、最終チェックイン、Dagu Console のサーバーへのリンクが表示されます。

キーを指定せずに `dagu license activate` を実行すると、シェルから同じ操作を行えます。サーバーの Web UI にブラウザから到達できない場合に便利です。Dagu v2.22 以降では、`--report` でサーバーが報告する内容を設定できます。詳細は[コマンドラインから](/overview/console-monitoring#from-the-command-line)を参照してください。

無料の監視を利用しているサーバーでは、**Plan & features** の **Start free trial** でトライアルを開始します。選択すると、Dagu Console のそのサーバーのページが開きます。

### サーバーキーで接続する {#with-a-server-key}

コンテナ、サーバー群、その他の自動化された環境では、コンソールの **Instances** ページで**サーバーキー**を生成し、各サーバーに渡します。

```bash
export DAGU_LICENSE_KEY=DAGU-XXXX-XXXX-XXXX-XXXX
```

キーを指定して起動したサーバーは、ワークスペースのスロットを使い切るまで、それぞれ 1 スロットを消費します。新しいキーを生成しても、接続済みのサーバーは切断されません。新しいサーバーと、データディレクトリを失ったサーバーには、新しいキーが必要です。

### サーバーの名前 {#name-servers}

Dagu Console には、各サーバーが報告する名前が表示されます。報告される名前は `license.server_name` で、設定されていない場合はホスト名です。Docker と Kubernetes では、ホスト名がランダムなコンテナ ID であることがよくあります。

サーバーの名前を変更するには、Dagu Console のサーバーの **Settings** タブで名前を変更するか、Dagu の **Plan & features** ページで **Server** の横にある **Rename** を選択します。どちらの方法でも同じ名前が設定されます。以降は Dagu Console と Dagu にその名前が表示され、その横に報告された名前が表示されます。名前をクリアすると、再び報告された名前が表示されます。

サーバーが報告する名前を設定するには (デプロイメントのすべてのレプリカに設定する場合など)、次のように指定します。

```yaml
license:
  server_name: prod-eu-1
```

または `DAGU_LICENSE_SERVER_NAME=prod-eu-1` を設定します。サーバーはチェックインのたびにこの名前を送信するため、変更は 1 時間以内にコンソールに反映されます。Dagu Console または Dagu で設定した名前がある場合は、その名前が代わりに表示されます。

### サーバーの ID の維持 {#keep-the-server-s-identity}

Dagu は、サーバーの ID とライセンスをデータディレクトリ (`paths.data_dir`) の `license` フォルダに保存します。コンテナでは、このディレクトリを永続化してください。永続化しない場合、再起動のたびに新しいサーバーとして登録され、別のスロットを消費します。スロットを使い切ると、コンソールにはすべてのサーバーが使用中であると表示されます。

### チェックインと切断 {#check-ins-and-disconnecting}

接続済みのサーバーは、1 時間ごとに Dagu Console にチェックインします。監視が有効な間は、トライアルの開始時など、Dagu Console がサーバーを別のライセンスに移したときにも、すぐにチェックインします。**Plan & features** は、Dagu Console から戻ったときにもチェックインします。**Check now** を選択すると、すぐにチェックインします。

- **Plan & features** の **Disconnect**、または `dagu license deactivate` を使用すると、スロットはすぐに解放されます。
- コンソールの **Instances** ページの **Disconnect** を使用すると、スロットが解放され、サーバーは次回のチェックイン時にライセンスの使用を停止します。設定にサーバーキーが残っているサーバーは、再起動時に再び接続します。これを防ぐには、新しいキーを生成してください。
- スロットが自動的に解放されることはありません。恒久的に撤去したサーバーは、コンソールで切断するまでスロットを消費し続けます。

### 閉域網のサーバー {#air-gapped-servers}

Dagu Console に到達できないサーバーでは、オフラインライセンスを使用します。コンソールの **Instances** ページの **Add offline server** でライセンスを作成し、`DAGU_LICENSE` または `DAGU_LICENSE_FILE` でインストールします。オフラインサーバーは、ライセンスが取り消されるまでスロットを消費します。

## 関連ページ {#related-pages}

- [監視](/overview/console-monitoring)
- [公開 Webhook URL](/server-admin/authentication/public-webhook-urls)
- [Dagu Cloud からのリモートアクセス](/overview/cloud-remote-access)
- [Dagu Console アカウント](/overview/console-account)
- [Dagu Console メンバー](/overview/console-members)
- [組み込み認証](/server-admin/authentication/builtin)
- [OIDC 認証](/server-admin/authentication/oidc)
- [監査ログ](/server-admin/server#audit-logging)
- [通知](/web-ui/notifications)
- [インシデントルーティング](/web-ui/incidents)
- [料金](https://dagu.sh/pricing)
