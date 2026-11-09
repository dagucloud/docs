---
description: コンピュータの起動時に開始する Windows サービスとして Dagu を実行します。サービスからアクセスできる範囲とできない範囲も説明します。
---

# Windows サービス {#windows-service}

Windows のインストーラは、Dagu を Windows サービスとして登録できます。このサービスはコンピュータの起動時に開始し、障害が発生すると再起動します。サービスの実体は、`dagu start-all` をラップするバージョン固定の [WinSW](https://github.com/winsw/winsw) ラッパーです。

## サービスのインストール {#install-the-service}

[グラフィカルインストーラ](/ja/getting-started/installation/windows#installer-recommended)を実行して *As a Windows service* を選択します。または、管理者として PowerShell を起動し、次のコマンドを実行します。

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)
& $daguInstaller -Service yes -AdminUsername admin -AdminPassword "change-me-now"
```

`-AdminUsername` と `-AdminPassword` を指定しない場合は、http://127.0.0.1:8080/setup で最初の管理者アカウントを作成します。別のポートで提供するには、`-Port <port>` を追加します。その他のインストーラのパラメータについては、[Windows へのインストール](/ja/getting-started/installation/windows)を参照してください。

## 各ファイルの場所 {#where-things-are}

| パス | 内容 |
| --- | --- |
| `C:\Program Files\Dagu\dagu.exe` | Dagu バイナリ |
| `C:\Program Files\Dagu\dagu-service.xml` | サービス定義。`DAGU_HOME`、`DAGU_HOST`、`DAGU_PORT` を設定します |
| `C:\ProgramData\Dagu\` | `DAGU_HOME`: `dags\` 内のワークフロー、`config.yaml`、実行データ |
| `C:\ProgramData\Dagu\logs\` | 実行ログとサービスラッパーのログ |

環境変数は `config.yaml` より優先されます。そのため、アドレスまたはポートは `dagu-service.xml` で変更し、サービスを再起動してください。

## サービスの管理 {#manage-the-service}

管理者として PowerShell で次のコマンドを実行します。

```powershell
Get-Service Dagu        # Check status
Restart-Service Dagu    # Apply changes to config.yaml or dagu-service.xml
Stop-Service Dagu
Start-Service Dagu
```

## サービスからアクセスできる範囲 {#what-the-service-can-reach}

サービスは、サインインしているユーザーではなく、セッション 0 の LocalSystem アカウントとして実行されます。

- コマンドから見えるのは、マシンの `PATH` と LocalSystem のプロファイルです。自分のユーザーにのみインストールしたツールは使用できません。コーディングエージェント CLI のログインなど、それらのツールが保持するサインイン情報も使用できません。ツールはすべてのユーザー向けにインストールするか、絶対パスで呼び出してください。認証情報は[シークレット](/writing-workflows/secrets)として渡してください。
- セッション 0 にはデスクトップがないため、[computer ステップ](/step-types/computer#setting-up-a-desktop-host)は失敗します。computer ステップを使用する場合は、代わりにユーザーのサインイン済みセッションで Dagu を実行してください。たとえば、タスクスケジューラで **ユーザーがログオンしているときのみ実行する** (**Run only when user is logged on**) を指定して実行します。

## アンインストール {#uninstall}

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)
& $daguInstaller -Uninstall
```

この操作では、バイナリ、サービス、`PATH` のエントリが削除され、`C:\ProgramData\Dagu` は保持されます。このディレクトリも削除するには、`-PurgeData` を追加します。グラフィカルインストーラを使用した場合は、代わりに **設定 > アプリ** (**Settings > Apps**) から Dagu をアンインストールしてください。詳細は[アンインストール](/getting-started/installation/uninstall)を参照してください。

## アクセス {#access}

ブラウザで http://127.0.0.1:8080 を開きます。
