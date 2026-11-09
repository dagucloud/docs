---
description: セルフホストの Dagu サーバーが Dagu Cloud に送信する内容、Dagu Cloud が保持する内容と期間、リモート呼び出しの検証方法、Dagu Cloud の稼働環境を説明します。
---

# Dagu Cloud: セキュリティとデータの流れ {#dagu-cloud-security-and-data-flow}

ワークフローは、お使いのサーバーとそのワーカーでのみ実行されます。Dagu にテレメトリは含まれていません。サーバーが Dagu Cloud と通信するのは、[Dagu Console](https://console.dagu.sh) に接続した後だけです。また、以下の各機能は、サーバーの管理者が有効にするまで無効のままです。接続してはならないサーバーでは、[オフラインライセンス](/ja/overview/self-host-license#air-gapped-servers)を使用します。

- **外部からの接続はありません**。すべての接続は、お使いのサーバーからアウトバウンドの HTTPS で開始します。インバウンドのポート、パブリックアドレス、トンネルは必要ありません。
- **上限を決めるのはお使いのサーバーです**。Dagu Cloud が機能を有効にしたり、許可の範囲を引き上げたりすることはできません。
- **完全なログはお使いの環境に残ります**。Dagu Cloud が完全なログ、出力、パラメータ、シークレットの値を保存することはありません。失敗したステップのエラーメッセージを監視で保存するのは、エラーメッセージを対象とするレベルの場合のみです。

## 接続 {#connections}

以下の各接続は、Dagu サーバーがアウトバウンドの HTTPS で開始します。

### ライセンスのチェックイン {#license-check-in}

Dagu Console に接続したサーバーが対象です。`dagu server` または `dagu start-all` が `console.dagu.sh` にチェックインします。

- **送信内容**: ライセンス ID とサーバー ID、サーバーの名前、Dagu のバージョン、ハートビートシークレット。
- **保持内容**: サーバーのレコード。シークレットはハッシュとしてのみ保持します。切断されたサーバーは非アクティブとして記録します。

### 監視 {#monitoring}

レベルを選択するまで無効です。ライセンスを保持するプロセスが `console.dagu.sh` に報告します。詳細は[監視](/overview/console-monitoring)を参照してください。

- **送信内容**: 稼働状態、および選択したレベルに応じて、実行ステータスと失敗したステップのエラーメッセージ。詳細は[送信される内容](/overview/console-monitoring#what-is-sent)を参照してください。
- **保持内容**: 実行は 30 日間、日次の集計は 13 か月間、解決済みのアラートは 90 日間です。30 日間報告がないサーバーは、報告済みの内容とともに削除します。
- アラートのメールとチャットメッセージには、ワークフロー、サーバー、実行 ID、失敗したステップが含まれます。エラーメッセージのレベルでは、最初のエラーの末尾も含まれます。メールの送信元は `no-reply@dagu.sh` です。

### 公開 Webhook URL {#public-webhook-urls}

Webhook に公開 URL を設定するまで無効です。スケジューラロックを保持するスケジューラが、`relay.dagu.sh` への WebSocket を維持します。詳細は[公開 Webhook URL](/server-admin/authentication/public-webhook-urls)を参照してください。

- **送信内容**: サーバーの名前とバージョン、サーバーが提供する URL、各配信の結果。
- **保持内容**: 各リクエストの本文とヘッダ (認証情報を除く) を、サーバーが受け取るまで、最長 7 日間保持します。各 URL のトークンは SHA-256 としてのみ保持します。

### リモートアクセス {#remote-access}

管理者が有効にするまで無効です。`dagu server` または `dagu start-all` の各プロセスが、`relay.dagu.sh` への WebSocket を維持します。詳細は [Dagu Cloud からのリモートアクセス](/overview/cloud-remote-access)を参照してください。

- **送信内容**: MCP クライアントが行う呼び出しへの応答 (サーバーのレベルの範囲内)。Dagu Cloud は、応答を保存せずに転送します。
- **保持内容**: なし。Dagu Cloud は呼び出しのログを保持しません。各サーバーは、受信した呼び出しを自身の監査ログに記録します。

### アップグレードの確認とトレース {#upgrade-check-and-tracing}

- `dagu upgrade` は、実行したときにのみ GitHub でリリースを確認します。
- トレースは、[OpenTelemetry コレクタ](/server-admin/opentelemetry)を自身で設定した場合にのみ、そのコレクタにのみ送信されます。

## ファイアウォール {#firewall}

使用する機能について、アウトバウンドの HTTPS (ポート 443) を許可してください。ワーカーには何も必要ありません。

| 機能 | 接続元 | ホスト |
| --- | --- | --- |
| ライセンスのチェックイン、監視 | `dagu server` または `dagu start-all` | `console.dagu.sh` |
| 公開 Webhook URL | スケジューラロックを保持するスケジューラ | `console.dagu.sh`、`relay.dagu.sh` |
| リモートアクセス | Web UI を提供する各プロセス | `console.dagu.sh`、`relay.dagu.sh` |

`hooks.dagu.sh` は、Webhook の送信元が POST する宛先です。お使いのサーバーがこのホストに接続することはありません。

## リモート呼び出しの検証方法 {#how-a-remote-call-is-checked}

<picture>
  <source media="(max-width: 640px)" srcset="/mcp/mcp-call-portrait.svg" width="480" height="690">
  <img src="/mcp/mcp-call.svg" width="720" height="520" alt="1: MCP クライアントがトークンとともにツール呼び出しを送信します。2: Dagu Console が 4 つの上限を確認します。3: 1 つのリクエストと 1 つのサーバーに限定して呼び出しに署名します。署名の有効期間は最長 1 分です。4: リレーがサーバーの WebSocket を通じて呼び出しを転送します。5 から 7: サーバーが署名を検証し、自身のレベルを適用してツールを実行し、監査ログに書き込みます。8: 応答が返ります。Dagu Cloud は応答を保存しません。" style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

- **Dagu Cloud が各呼び出しに署名します**。まず接続に許可された操作 (後述) を確認し、次に Ed25519 鍵で呼び出しに署名します。署名には、ユーザー、そのロール、MCP クライアントが記載されます。署名の有効期間は 1 分で、受け入れられるのは 1 回のみです。署名の対象はリクエストの内容そのものです。
- **リレーは呼び出しを転送します**。リレーは署名鍵を保持していません。そのため、サーバーが受け入れる呼び出しを作成することはできません。途中で変更された呼び出しは、サーバーの検証で失敗します。
- **判断するのはお使いのサーバーです**。サーバーは Dagu Cloud の公開鍵で署名を検証します。期限切れの呼び出し、再利用された呼び出し、別のサーバーまたはリクエスト向けの呼び出しは拒否します。呼び出しは、`cloud:` とユーザー ID を実行者として、署名されたロールとサーバー自身のレベルのうち低い方で実行します。`manager` や `admin` として実行することはありません。
- **呼び出しが到達できるのは MCP ツールのみです**。ターミナル、ユーザー、API キー、ライセンス、リモートアクセスの設定には到達できません。各呼び出しはサーバーの[監査ログ](/mcp/auditability#calls-from-dagu-cloud)に記録されます。

## MCP クライアントに許可される操作 {#what-an-mcp-client-may-do}

Dagu Cloud に接続した MCP クライアントは、サーバーが報告した内容を読み取ります。リモートアクセスが有効なサーバーについては、サーバー自体を呼び出します。呼び出しには、次の 4 つの上限のうち最も低いものが適用されます。

- **接続**: クライアントの接続時に選択したワークスペース、サーバー、アクセス権 (読み取り、操作、編集)。
- **ワークスペースの MCP ポリシー**: ワークスペースのオーナーが Dagu Console で設定します。
- **ワークスペースのサーバーに対するメンバーのロール**: ワークスペースのオーナーが設定します。
- **サーバーのリモートアクセスの[レベル](/overview/cloud-remote-access#levels)**: サーバーの管理者が設定します。サーバー自体への呼び出しに適用されます。

人の判断を待っているステップを決定するには、さらに、接続、MCP ポリシー、サーバーのそれぞれで承認が許可されている必要があります。オーナーは、ワークスペースへのすべての接続を確認でき、どの接続でも終了できます。メンバーは自分の接続を終了できます。ワークスペースから退出すると、そのメンバーのワークスペースへのアクセスは終了します。詳細は [MCP](/mcp/#security)を参照してください。

## Dagu Cloud に委ねる信頼の範囲 {#what-you-trust-dagu-cloud-with}

- **転送中の応答**。リレーは Cloudflare 上で動作し、TLS を終端します。そのため、リモート呼び出しへの応答は、メモリ上でリレーを通過します。応答には、許可したレベルによってはログが含まれます。これは、Cloudflare Tunnel などのホスト型トンネルに求められるものと同じ信頼です。Dagu Cloud は応答を保存しません。
- **呼び出しへの署名**。Dagu Cloud を掌握した者は、リモートアクセスが有効なサーバーに対して、各サーバーのレベルの範囲で呼び出しを行うことができます。最終的な判断は各サーバーが行います。リモートアクセスは、サーバーの管理者が有効にするまで無効です。管理者は、最高レベルと承認を許可するかどうかを設定します。リモートアクセスを無効にすると、接続は直ちに閉じられます。すべての呼び出しは、サーバー自身の監査ログに記録されます。
- **監視と Webhook**。Dagu Console がサーバーに接続したり、ワークフローを実行したりすることはありません。公開 Webhook URL が起動するのは、その URL の DAG のみです。[送信元を選択](/server-admin/authentication/public-webhook-urls#choose-the-sender)すると、その送信元の有効な署名を持つリクエストに対してのみ起動します。

## AI プロバイダ {#ai-providers}

MCP クライアントが Dagu Cloud を通じて実行またはそのログを読み取ると、応答はクライアントと、Anthropic や OpenAI などのそのプロバイダに、プロバイダの規約に基づいて渡ります。viewer を含むすべてのレベルでログを読み取れます。この点を踏まえて、各サーバーのレベルとワークスペースの MCP ポリシーを選択してください。

## Dagu Cloud の稼働環境 {#where-dagu-cloud-runs}

- **Dagu Console とそのデータベース**: Google Cloud、`us-central1` (米国)。保存時に暗号化されます。各ワークスペースのデータは、データベースの行レベルセキュリティによって分離されます。
- **リレーと待機中の Webhook リクエスト**: Cloudflare Workers および Durable Objects。
- **サインイン**: Auth0。**メール**: Resend。**決済**: Stripe。

個人データの取り扱いについては、[プライバシーポリシー](https://dagu.sh/privacy)を参照してください。

## 脆弱性の報告 {#reporting-a-vulnerability}

`Security report: Dagu` などの件名で `company@descarty.com` にメールを送信するか、`dagucloud/dagu` の GitHub のプライベート脆弱性報告を使用してください。公開の Issue は作成しないでください。詳細は[セキュリティポリシー](https://github.com/dagucloud/dagu/security/policy)を参照してください。

## 関連ページ {#related-pages}

- [監視](/overview/console-monitoring)
- [公開 Webhook URL](/server-admin/authentication/public-webhook-urls)
- [Dagu Cloud からのリモートアクセス](/overview/cloud-remote-access)
- [アーキテクチャ](/overview/architecture)
- [セルフホストプランの比較](/ja/overview/self-host-license)
