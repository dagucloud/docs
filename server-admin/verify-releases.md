# Verify Releases

Check that a Dagu download is the file the project built before you install it.

## Release archives

Every release publishes `checksums.txt`. Each archive also has a build provenance attestation, which proves that the project's GitHub Actions release workflow built it.

```bash
VERSION=2.26.0
ARCHIVE="dagu_${VERSION}_linux_amd64.tar.gz"

gh release download "v${VERSION}" --repo dagucloud/dagu \
  --pattern "$ARCHIVE" --pattern checksums.txt

sha256sum --check --ignore-missing checksums.txt
gh attestation verify "$ARCHIVE" --repo dagucloud/dagu
```

`dagu upgrade` checks the SHA-256 checksum by itself.

## Windows installer

`dagu-windows-amd64-setup.exe` is signed by Descarty株式会社. Check the signature in PowerShell:

```powershell
Get-AuthenticodeSignature .\dagu-windows-amd64-setup.exe | Format-List Status, SignerCertificate
```

`Status` must be `Valid`.

## Container images

Container images are not signed and have no attestation. To be sure of what you run, pin the image by digest:

```bash
docker buildx imagetools inspect ghcr.io/dagucloud/dagu:2.26.0
```

```yaml
image: ghcr.io/dagucloud/dagu@sha256:<digest>
```

The project scans its images with Trivy on image-related changes and every week.

## npm packages

npm packages are published with provenance. Check them with:

```bash
npm audit signatures
```

## Software bill of materials

Releases do not include an SBOM. To produce one, run a scanner such as Syft or Trivy against the binary or image you deploy.
