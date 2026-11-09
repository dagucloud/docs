---
description: Docker または Docker Compose で Dagu を実行し、ワークフロー、履歴、ログ、設定をホストのボリュームに永続化します。
---

# Docker でのインストール {#install-with-docker}

Docker で Dagu を実行し、ワークフロー、履歴、ログ、設定をホストのボリュームに保持します。

::: tip 必要なアクセスの選択
以下の標準コマンドは、ホストの Docker デーモンを公開せずに、シェルステップと組み込みステップを実行します。ワークフローで `container:`、`action: docker.run`、またはコンテナ化された `harness.run` を使用する場合は、[Dagu を Docker で実行するときにコンテナステップを実行する](#run-container-steps-when-dagu-runs-in-docker)を参照してください。
:::

## 1 回限りの実行 {#one-off-run}

```bash
docker run --rm \
  -p 8080:8080 \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagucloud/dagu:latest \
  dagu start-all
```

<http://localhost:8080> にアクセスします。

## バックグラウンド実行 {#detached}

```bash
docker run -d \
  --name dagu \
  -p 8080:8080 \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagucloud/dagu:latest \
  dagu start-all
```

## Docker Compose {#docker-compose}

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - "8080:8080"
    environment:
      - DAGU_TZ=America/New_York
      - DAGU_PORT=8080        # optional, default 8080
      - PUID=1000             # optional, default 1000
      - PGID=1000             # optional, default 1000
    volumes:
      - dagu:/var/lib/dagu
volumes:
  dagu: {}
```

`docker compose up -d` で起動します。

イメージの `DAGU_HOME` の既定値は `/var/lib/dagu` で、ボリュームのマウント先と一致しています。`DAGU_HOME` を変更する場合は、永続ボリュームを同じパスにマウントし、`PUID`/`PGID` で書き込めることを確認してください。

リモート CLI コンテキストは、ポート `8080` で公開される HTTP API を使用します。コンテキストの URL には API パスを含めてください。

```bash
dagu context add docker \
  --server http://docker-host:8080/api/v1 \
  --api-key dagu_xxxxxxxxxxxxxxxxxxxx
dagu context test docker
```

コーディネーターのポート `50055` は、リモート CLI コンテキストとは関係ありません。Compose ネットワークの外にある `dagu worker` プロセスが接続する必要がある場合にのみ公開してください。

## Dagu を Docker で実行するときにコンテナステップを実行する {#run-container-steps-when-dagu-runs-in-docker}

コンテナステップには Docker 互換のデーモンが必要です。ホストのソケットを Dagu コンテナにマウントしてください。これにより、Dagu はホストのエンジンを通じて兄弟コンテナを作成できます。

### Docker Run {#docker-run}

```bash
docker run -d \
  --name dagu \
  -p 8080:8080 \
  -v dagu-data:/var/lib/dagu \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --user 0:0 \
  --entrypoint /usr/local/bin/tini \
  ghcr.io/dagucloud/dagu:latest \
  -g -- dagu start-all
```

名前付きデータボリュームを使うと、ホストのディレクトリに root 所有のファイルが作成されるのを避けられます。既存のインストールをこの構成に変更する場合は、既存のデータマウントを維持してください。

### Docker Compose {#docker-compose-1}

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - "8080:8080"
    volumes:
      - dagu-data:/var/lib/dagu
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: ["/usr/local/bin/tini", "-g", "--"]
    command: ["dagu", "start-all"]
    user: "0:0"
volumes:
  dagu-data: {}
```

どちらの例も `/entrypoint.sh` を経由しません。そのため、ソケットのグループ所有権にかかわらず、Dagu は root として実行されます。Tini は PID 1 のまま、シグナルの転送とプロセスの回収を行います。既定のランタイムは Docker です。`DAGU_CONTAINER_RUNTIME=docker` の指定は不要です。

リモートのデーモンを使用する場合は、ソケットのマウントを省略し、Dagu コンテナに `DOCKER_HOST` と必要な Docker TLS 変数を設定してください。分散構成では、コンテナステップを受け取る可能性のあるすべてのワーカーで、デーモンへのアクセスを設定してください。詳細は [Docker](/step-types/docker#docker-daemon-access)を参照してください。

::: warning セキュリティ
`/var/run/docker.sock` をマウントすると、ワークフローはホストの Docker デーモンを制御できるようになります。これには、ホストのファイルをマウントする権限や、特権コンテナを起動する権限も含まれます。認証を設定した Dagu サーバー上の、信頼できるワークフローにのみ使用してください。
:::

AI およびコーディングエージェントの CLI のサンドボックスについては、[Harness のサンドボックス実行](/step-types/harness/sandbox/)を参照してください。

## イメージタグ {#image-tags}

| タグ | 内容 |
|---|---|
| `latest` | 最新の安定版リリース |
| `<version>` | 特定のリリース (例: `2.11.1`) |
| `alpine`, `<version>-alpine` | Alpine ベースのランタイムイメージ |
| `dev`, `<version>-dev` | コンパイラ、SDK、一般的な CLI ツール、[ブラウザステップ](/step-types/browser)用の Chromium を含む開発用イメージ (amd64 と arm64。実行オプションは [Docker イメージ](/server-admin/deployment/docker-images)を参照) |

全一覧: [Docker イメージ](/server-admin/deployment/docker-images)

## 1 回限りの DAG コマンドの実行 {#running-one-off-dag-commands}

```bash
# Validate
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu validate hello

# Start
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu start hello

# History
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu history hello
```

## 確認 {#verify}

```bash
docker exec dagu dagu version
```

次へ: [クイックスタート](/ja/getting-started/quickstart)
