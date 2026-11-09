---
description: Dagu をインストールし、CLI、Web UI、Docker、npm、Homebrew を使用して、最初の YAML ワークフローを 5 分未満で実行します。
---

# クイックスタート {#quickstart}

何もない状態から、5 分未満でワークフローを実行できます。

## 1. インストール {#_1-install}

::: code-group

```bash [macOS/Linux]
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

```powershell [Windows]
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

```bash [Docker]
docker pull ghcr.io/dagucloud/dagu:latest
```

```bash [npm]
npm install -g --ignore-scripts=false @dagucloud/dagu
```

```bash [Homebrew]
brew install dagu
```

:::

スクリプトインストーラは、ガイド付きのウィザードで PATH の設定、バックグラウンドサービスのセットアップ、最初の管理者アカウントの作成を行います。Windows の[グラフィカルインストーラ](/ja/getting-started/installation/windows#installer-recommended)は、PATH とサービスのセットアップを行います。Homebrew、npm、Docker でインストールされるのは、バイナリまたはコンテナのみです。

すべてのオプション (特定のバージョン、任意のディレクトリ、サービスのスコープ、アンインストール、CI/非対話) については、[インストールガイド](/ja/getting-started/installation/)を参照してください。

インストールを確認します。

::: code-group

```bash [Installed binary]
dagu version
```

```bash [Docker]
docker run --rm ghcr.io/dagucloud/dagu:latest dagu version
```

:::

## 2. 最初のワークフローの作成 {#_2-write-your-first-workflow}

DAG は YAML ファイルです。空のフォルダに、次の内容を `hello.yaml` として保存します。

```yaml
steps:
  - id: hello
    run: echo "Hello from Dagu!"
  - id: step_2
    run: echo "Running step 2"
    depends: hello
```

## 3. 実行 {#_3-run-it}

::: code-group

```bash [Installed binary]
dagu start hello.yaml
```

```bash [Docker]
mkdir -p ~/.dagu/dags
cp hello.yaml ~/.dagu/dags/
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagucloud/dagu:latest \
  dagu start hello
```

:::

出力:

```
Succeeded - 2026-04-24T15:23:07+09:00

dag: hello (0s)
├─log: .../logs/hello/.../dag-run....log
│
├─hello (0s) [succeeded]
│ ├─echo "Hello from Dagu!"
│ │
│ └─stdout: .../hello....out
│     Hello from Dagu!
│
└─step_2 (0s) [succeeded]
  ├─echo "Running step 2"
  │
  └─stdout: .../step_2....out
      Running step 2

Result: Succeeded
```

タイムスタンプ、所要時間、ログのパスは実行ごとに異なります。

その他の便利なコマンドです。

::: code-group

```bash [Installed binary]
dagu validate hello.yaml   # Check syntax without running
dagu dry hello.yaml        # Show execution plan
dagu status hello          # Last run status
dagu history hello         # Recent runs
```

```bash [Docker]
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu validate hello
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu dry hello
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu status hello
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu history hello
```

:::

## 4. Web UI を開く {#_4-open-the-web-ui}

::: code-group

```bash [Installed binary]
dagu start-all --dags .
```

```bash [Docker]
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  -p 8080:8080 \
  ghcr.io/dagucloud/dagu:latest \
  dagu start-all
```

:::

<http://localhost:8080> にアクセスします。初回起動時は、スクリプトインストーラですでに作成済みの場合を除き、管理者アカウントを作成します。**Workflows** からワークフローを開くと、ステップの状態がリアルタイムに反映されるグラフ、実行履歴、ステップごとのログを確認できます。ワークフローは、視覚的に編集することも、YAML として編集することもできます。
`--dags .` フラグは、現在のフォルダにあるすべての YAML ファイルをワークフローとして読み込みます。そのため、`hello.yaml` を空のフォルダに置いています。

インストーラでバックグラウンドサービスをセットアップした場合、Dagu はすでに起動しています。既定のアドレスは <http://localhost:8080> です。2 つ目のサーバーを起動せず、UI からワークフローを追加するか、`hello.yaml` をサービスの DAG ディレクトリにコピーしてください。DAG ディレクトリは、スクリプトインストーラが表示したディレクトリ、または Windows のグラフィカルインストーラの場合は `C:\ProgramData\Dagu\dags` です。

DAG ディレクトリが空の状態で初めて起動すると、Dagu は 6 つのサンプルワークフロー (`example-01-basic-sequential.yaml` から `example-06-retry-on-failure.yaml` まで) を作成します。`example-06-retry-on-failure` は最初の試行が失敗し、リトライで成功します。これにより、不安定な依存先からステップが回復する様子を確認できます。インストールしたバイナリでの既定の DAG ディレクトリは `~/.config/dagu/dags/` です。スクリプトインストーラでサービスをセットアップした後など、`~/.dagu` が存在する場合は `~/.dagu/dags/` です。上記の Docker コマンドは、`~/.dagu/dags/` を `/var/lib/dagu/dags/` にマウントします。サンプルを無効にするには、`DAGU_SKIP_EXAMPLES=true` を設定するか、`config.yaml` に `skip_examples: true` を設定します。

## 基本要素 {#core-pieces}

### 依存関係 {#dependencies}

```yaml
steps:
  - id: extract
    run: ./extract.sh

  - id: transform_a
    run: ./transform_a.sh
    depends: extract

  - id: transform_b
    run: ./transform_b.sh
    depends: extract

  - id: load
    run: ./load.sh
    depends: [transform_a, transform_b]
```

### パラメータ {#parameters}

```yaml
params:
  - SOURCE: /data
  - DEST: /backup

steps:
  - run: tar -czf ${params.DEST}/backup.tar.gz ${params.SOURCE}
```

```bash
dagu start backup.yaml -- SOURCE=/important DEST=/backups
```

### リトライとエラー処理 {#retries-and-error-handling}

```yaml
steps:
  - id: download
    run: curl -f https://example.com/data.zip -o data.zip
    retry_policy:
      limit: 3
      interval_sec: 30

  - id: process
    run: ./process.sh data.zip
    continue_on:
      failure: true
    depends: download

handler_on:
  failure:
    run: echo "run failed" | mail -s "alert" admin@example.com
  exit:
    run: rm -f data.zip
    depends: download
```

### コンテナ {#containers}

::: warning Docker でのインストール
Dagu 自体を Docker で実行している場合、[ホストの Docker ソケットをマウント](/ja/getting-started/installation/docker#run-container-steps-when-dagu-runs-in-docker)するまで、前述の Docker コマンドではコンテナステップを作成できません。
:::

すべてのステップを同じコンテナで実行します。

```yaml
container:
  image: python:3.11
  volumes:
    - ./data:/data
steps:
  - id: write_file
    run: python -c "open('/data/out.txt','w').write('hi')"
  - id: read_file
    run: python -c "print(open('/data/out.txt').read())"
    depends: write_file
```

または、1 つのステップのみを専用のコンテナで実行します。

```yaml
steps:
  - name: build
    container:
      image: node:20-alpine
    run: npm run build
```

### スケジュール実行 {#scheduling}

```yaml
schedule: "0 2 * * *"      # 2 AM daily
overlap_policy: skip        # drop new runs while one is active
timeout_sec: 3600
steps:
  - run: ./nightly.sh
```

### 作業ディレクトリ {#working-directory}

DAG は、既定では YAML ファイルのあるディレクトリで実行されます。`working_dir` で上書きできます。

```yaml
working_dir: /app/project
dotenv: .env                 # resolved from working_dir
steps:
  - run: ls -la
```

## 次のステップ {#next-steps}

- [主要な概念](/getting-started/concepts): ステップ、依存関係、実行モデル
- [デプロイモデル](/overview/deployment-models): シングルサーバー、一時ワーカー、分散ワーカー
- [ワークフローの作成](/writing-workflows/): YAML で指定できるすべての項目
- [ステップタイプ](/step-types/shell): 組み込みのエグゼキュータ (docker、ssh、http、wait、sql、s3、sub-DAG など)
- [サンプル](/writing-workflows/examples): そのまま応用できるパターン
- [CLI リファレンス](/getting-started/cli): すべてのコマンドとフラグ
- [MCP クイックスタート](/mcp/quickstart): 外部の AI ツールを稼働中の Dagu サーバーに接続する
- [MCP サーバー](/mcp/): MCP 対応クライアントを稼働中の Dagu サーバーに接続する
- [監視](/overview/console-monitoring): ワークフローの失敗時やサーバーからの報告が途絶えたときにメールを受け取る
