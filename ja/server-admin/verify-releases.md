# リリースの検証 {#verify-releases}

インストールの前に、ダウンロードした Dagu がプロジェクトによってビルドされたファイルであることを確認してください。

## リリースアーカイブ {#release-archives}

すべてのリリースで `checksums.txt` を公開しています。各アーカイブには、ビルド来歴の構成証明(build provenance attestation)もあります。これは、プロジェクトの GitHub Actions リリースワークフローがそのアーカイブをビルドしたことを証明するものです。

```bash
VERSION=2.26.0
ARCHIVE="dagu_${VERSION}_linux_amd64.tar.gz"

gh release download "v${VERSION}" --repo dagucloud/dagu \
  --pattern "$ARCHIVE" --pattern checksums.txt

sha256sum --check --ignore-missing checksums.txt
gh attestation verify "$ARCHIVE" --repo dagucloud/dagu
```

`dagu upgrade` は、SHA-256 チェックサムを自身で検証します。

## Windows インストーラー {#windows-installer}

`dagu-windows-amd64-setup.exe` には Descarty株式会社が署名しています。PowerShell で署名を確認します。

```powershell
Get-AuthenticodeSignature .\dagu-windows-amd64-setup.exe | Format-List Status, SignerCertificate
```

`Status` が `Valid` である必要があります。

## コンテナイメージ {#container-images}

コンテナイメージには署名がなく、構成証明もありません。実行するイメージを確実にするには、ダイジェストでイメージを固定します。

```bash
docker buildx imagetools inspect ghcr.io/dagucloud/dagu:2.26.0
```

```yaml
image: ghcr.io/dagucloud/dagu@sha256:<digest>
```

プロジェクトでは、イメージに関連する変更があったとき、および毎週、Trivy でイメージをスキャンしています。

## npm パッケージ {#npm-packages}

npm パッケージは来歴情報(provenance)付きで公開しています。次のコマンドで確認します。

```bash
npm audit signatures
```

## ソフトウェア部品表 {#software-bill-of-materials}

リリースに SBOM は含まれません。SBOM を作成するには、デプロイするバイナリまたはイメージに対して Syft や Trivy などのスキャナーを実行してください。
