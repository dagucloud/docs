# Docker Images

Dagu publishes multiple container images to GitHub Container Registry at `ghcr.io/dagucloud/dagu`. All images are multi-arch (`linux/amd64`, `linux/arm64`, `linux/arm/v7`) and ship with the same defaults: listen on `8080`, run `dagu start-all`, and honor `PUID`/`PGID`/`DAGU_*` environment variables.

## Image overview

| Tag(s) | Base | Package Manager | What's inside | Use when |
| --- | --- | --- | --- | --- |
| `latest`, `<version>` | Ubuntu 24.04 | `apt` | Core runtime + `sudo`, `tzdata`, `jq` | General deployments; closest to production defaults |
| `alpine`, `<version>-alpine` | Alpine 3.22 | `apk` | Musl-based image with `bash`, `sudo`, `jq`, `tzdata` | Minimal footprint, Alpine-only environments |
| `dev`, `<version>-dev` | Ubuntu 24.04 | `apt` | Adds build tools (`git`, `curl/wget`, `zip/unzip`, `build-essential`, `python3/pip`, `openjdk-17`, `nodejs/npm`, `jq`, `tzdata`) | Local development or workflows that need compilers/SDKs baked in |

> Prefer pinning to a specific version tag (`ghcr.io/dagucloud/dagu:<version>`) for reproducible deployments.

## Entrypoint and Process Reaping

Official images start with [Tini](https://github.com/krallin/tini) as PID 1:

```text
/usr/local/bin/tini -g -- /entrypoint.sh dagu start-all
```

Keep that entrypoint unless there is a specific reason to replace it. Tini reaps orphaned child processes and forwards stop signals to Dagu. Without an init process, a workflow step that starts a background subprocess can leave a zombie process in the container.

`/entrypoint.sh` prepares `DAGU_HOME`, applies `PUID`/`PGID`, runs optional init scripts, and then starts the requested Dagu command.

When changing how the container starts:

- Docker Compose: use `command: ["dagu", "..."]`; do not use `entrypoint: []` or `entrypoint: ["dagu", ...]`.
- Kubernetes: use `args: ["dagu", "..."]`; do not use `command:` unless the replacement command keeps an init process.
- Docker socket/root mode: if `/entrypoint.sh` must be bypassed, keep Tini with `entrypoint: ["/usr/local/bin/tini", "-g", "--"]`.

## Examples

Standard image:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu ghcr.io/dagucloud/dagu:latest
```

Alpine image:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu ghcr.io/dagucloud/dagu:alpine
```

Dev image with extra tooling:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu ghcr.io/dagucloud/dagu:dev
```

For Docker-in-Docker workflows, mount the host socket and run as root:
```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu -v /var/run/docker.sock:/var/run/docker.sock --user 0:0 ghcr.io/dagucloud/dagu:latest
```

This setup should be treated as privileged host access. A workflow that can reach the Docker socket can usually control the host through containers, mounts, or image execution. Use it only when Docker executor support is required and the instance is otherwise tightly controlled.

## Custom Images

If your workflows require additional tools (Python, Perl, Ruby, etc.) not included in the standard images, build a custom image based on Dagu:

```dockerfile
FROM ghcr.io/dagucloud/dagu:latest

# Install additional packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    perl \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages if needed
RUN pip3 install --break-system-packages requests pandas
```

Build and run:
```bash
docker build -t my-dagu .
docker run -d -p 8080:8080 -v dagu-data:/var/lib/dagu my-dagu
```

## Build Arguments

All Dockerfiles accept the following build arguments to customize the container user and data directory:

| Argument | Default | Description |
| --- | --- | --- |
| `USER` | `dagu` | Username for the in-container user |
| `USER_UID` | `1000` | UID for the in-container user |
| `USER_GID` | `$USER_UID` | GID for the in-container user |
| `DAGU_HOME` | `/var/lib/dagu` | Data directory where Dagu stores its state |

Match the container UID/GID to your host user so that bind-mounted files have the correct ownership:

```bash
docker build \
  --build-arg USER_UID="$(id -u)" \
  --build-arg USER_GID="$(id -g)" \
  -t my-dagu .
```
