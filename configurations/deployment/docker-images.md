# Docker Images

Dagu publishes multiple container images to GitHub Container Registry at `ghcr.io/dagu-org/dagu`. All images are multi-arch (`linux/amd64`, `linux/arm64`, `linux/arm/v7`) and ship with the same defaults: listen on `8080`, run `dagu start-all`, and honor `PUID`/`PGID`/`DAGU_*` environment variables.

## Image overview

| Tag(s) | Base | What’s inside | Use when |
| --- | --- | --- | --- |
| `latest`, `<version>` | Ubuntu 24.04 | Core runtime + `sudo`, `tzdata`, `jq` | General deployments; closest to production defaults |
| `alpine`, `<version>-alpine` | Alpine 3.22 | Musl-based image with `bash`, `sudo`, `jq`, `tzdata` | Minimal footprint, Alpine-only environments |
| `dev`, `<version>-dev` | Ubuntu 24.04 | Adds build tools (`git`, `curl/wget`, `zip/unzip`, `build-essential`, `python3/pip`, `openjdk-17`, `nodejs/npm`, `jq`, `tzdata`) | Local development or workflows that need compilers/SDKs baked in |

> Prefer pinning to a specific version tag (`ghcr.io/dagu-org/dagu:<version>`) for reproducible deployments.

## Examples

Standard image:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu ghcr.io/dagu-org/dagu:latest
```

Alpine image:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu ghcr.io/dagu-org/dagu:alpine
```

Dev image with extra tooling:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu ghcr.io/dagu-org/dagu:dev
```

For Docker-in-Docker workflows, mount the host socket and run as root:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu -v /var/run/docker.sock:/var/run/docker.sock --user 0:0 ghcr.io/dagu-org/dagu:latest
```
