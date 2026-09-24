# Docker Images

Dagu publishes multiple container images to GitHub Container Registry at `ghcr.io/dagucloud/dagu`. All images are multi-arch (`linux/amd64`, `linux/arm64`, `linux/arm/v7`) and ship with the same defaults: listen on `8080`, run `dagu start-all`, and honor `PUID`/`PGID`/`DAGU_*` environment variables.

## Image overview

| Tag(s) | Base | Package Manager | What's inside | Use when |
| --- | --- | --- | --- | --- |
| `latest`, `<version>` | Ubuntu 24.04 | `apt` | Core runtime + `ca-certificates`, `curl`, `git`, `jq`, `openssh-client`, `sudo`, `tini`, `tzdata`, `unzip` | General deployments; closest to production defaults |
| `alpine`, `<version>-alpine` | Alpine 3.22 | `apk` | Musl-based image with `bash`, `sudo`, `jq`, `tzdata` | Minimal footprint, Alpine-only environments |
| `dev`, `<version>-dev` | Ubuntu 24.04 | `apt` | Adds build tools (`git`, `curl/wget`, `zip/unzip`, `build-essential`, `python3/pip`, `openjdk-17`, `nodejs/npm`, `jq`, `tzdata`) and Chromium for [browser steps](/step-types/browser) | Local development, browser steps, or workflows that need compilers/SDKs baked in |

Only the `dev` image includes a browser: Playwright's Chromium on amd64 and arm64. The arm/v7 `dev` image has no browser. Chromium keeps its sandbox, which Docker's default seccomp profile blocks, so run the image with [`seccomp-chromium.json`](https://github.com/dagucloud/dagu/blob/main/deploy/docker/seccomp-chromium.json), Docker's default profile plus the user-namespace calls the sandbox needs:

```bash
docker run -d -p 8525:8080 -v dagu-data:/var/lib/dagu \
  --security-opt seccomp=./seccomp-chromium.json \
  ghcr.io/dagucloud/dagu:dev
```

In Compose, set `security_opt: ["seccomp=./seccomp-chromium.json"]`. Do not add `apparmor=unconfined`: on hosts that restrict unprivileged user namespaces, such as Ubuntu 24.04, it stops the sandbox from starting. Without the profile, a browser step fails at launch. To run without the sandbox instead, see [Browser requirements](/step-types/browser#requirements).

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

For container steps, use the
[socket-enabled Docker setup](/getting-started/installation/docker#run-container-steps-when-dagu-runs-in-docker).
It preserves Tini while running Dagu with access to the host daemon and explains
the resulting host-level privilege.

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
