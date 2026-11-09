# Windows へのインストール {#install-on-windows}

Dagu には、署名付きのグラフィカルインストーラ、PowerShell スクリプト、CMD ランチャーが用意されています。いずれも、セットアップ時にダウンロードするバージョン固定の [WinSW](https://github.com/winsw/winsw) ラッパーを使用して、Dagu を Windows サービスとしてセットアップできます。

## インストーラ (推奨) {#installer-recommended}

最新のインストーラをダウンロードして実行します。

[dagu-windows-amd64-setup.exe](https://github.com/dagucloud/dagu/releases/latest/download/dagu-windows-amd64-setup.exe)

インストーラには Descarty株式会社の署名が付いています。ウィザードでは次の 2 点を指定します。

- **How should Dagu run?** *As a Windows service* (推奨) を選択すると、Windows の起動時に Dagu が開始され、ブラウザで Web UI を常に利用できます。*Command-line tool only* を選択すると、`dagu.exe` がインストールされ、起動は利用者が行います。同じページにあるチェックボックス (既定でオン) で、Dagu をシステムの `PATH` に追加します。
- **Network ports** (サービスのみ)。Web UI のポートの既定値は 8080、コーディネーターのポートの既定値は 50055 です。他のプログラムがすでに使用しているポートは、ウィザードが受け付けません。

最後のページでは、ウィザードから Web UI を開くことができます。初回アクセス時に、Web UI で管理者アカウントを作成します。サービスのデータとログは `C:\ProgramData\Dagu` の下に保存されます。スタートメニューには *Open Dagu* ショートカットが追加されます。

### サイレントインストール {#silent-install}

```powershell
.\dagu-windows-amd64-setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /TASKS=service,path /PORT=8080 /COORDINATORPORT=50055
```

コマンドラインツールのみをインストールするには、`/TASKS=manual,path` を使用します。`PATH` を変更しない場合は、`path` を外してください。アンインストールは **設定 > アプリ** (**Settings > Apps**) から行います。サイレントでアンインストールするには、`& "C:\Program Files\Dagu\unins000.exe" /VERYSILENT` を実行します。アンインストールすると、サービスと `PATH` のエントリは削除されますが、`C:\ProgramData\Dagu` は保持されます。

## PowerShell {#powershell}

```powershell
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

### バージョンまたはインストール先を指定する {#install-a-specific-version-or-location}

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)

# Specific version
& $daguInstaller -Version vX.Y.Z

# Custom directory
& $daguInstaller `
  -Version latest `
  -InstallDir "C:\tools\dagu"
```

### Windows サービスとしてインストールする {#install-as-a-windows-service}

インストーラは権限の昇格を自動的に求めます。非対話でセットアップする場合は、管理者として PowerShell を起動し、次のコマンドを実行します。

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)
& $daguInstaller `
  -Version latest `
  -Service yes `
  -InstallDir "C:\Program Files\Dagu" `
  -AdminUsername admin `
  -AdminPassword "change-me-now"
```

### よく使うパラメータ {#common-parameters}

| パラメータ | 用途 |
|---|---|
| `-Version vX.Y.Z` | 特定のリリースをインストールする |
| `-InstallDir <path>` | 任意のインストール先を指定する |
| `-Service yes` | Windows サービスを登録する (権限の昇格が必要) |
| `-AdminUsername <u> -AdminPassword <p>` | 最初の管理者を作成する |
| `-DryRun -NoPrompt` | CI プレビューモード |

## CMD ランチャー {#cmd-launcher}

PowerShell をインラインで実行しにくい環境では、次のコマンドを使用します。

```cmd
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd && del installer.cmd
```

フラグを指定する場合:

```cmd
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Version vX.Y.Z && del installer.cmd

curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Version latest -InstallDir "C:\tools\dagu" && del installer.cmd
```

## Scoop {#scoop}

```powershell
scoop bucket add dagu https://github.com/dagucloud/scoop-bucket
scoop install dagu
```

Scoop は、サービスなしで `dagu.exe` をインストールします。アップグレードするには、`scoop update dagu` を実行します。

## バイナリの手動配置 {#manual-binary}

[GitHub Releases](https://github.com/dagucloud/dagu/releases) から Windows 用のアーカイブをダウンロードして `dagu.exe` を展開し、そのフォルダを `PATH` に追加します。

## 確認 {#verify}

```powershell
dagu version
Get-Service dagu    # if installed as a Windows service
```

次へ: [クイックスタート](/ja/getting-started/quickstart)
