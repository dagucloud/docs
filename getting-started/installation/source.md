# Build from source

For contributors or users who want to run a specific commit.

## Prerequisites

- [Go 1.26+](https://go.dev/doc/install)
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/installation)
- `make`

## Build

```bash
git clone https://github.com/dagucloud/dagu.git
cd dagu
make build       # builds the frontend bundle + the Go binary
```

The binary is written to `.local/bin/dagu`.

## Install the binary

```bash
sudo install .local/bin/dagu /usr/local/bin/
```

Or copy to any directory on your `PATH`.

## Development targets

| Target | What it does |
|---|---|
| `make bin` | Build Go binary only (skips frontend) |
| `make ui` | Clean install and build the frontend bundle |
| `make run` | Start the frontend dev server and scheduler |
| `make run-server` | Start the backend server only |
| `make test` | Run the Go test suite with race detection |
| `make lint` | Run `golangci-lint` |
| `make fmt` | Auto-format Go code |
| `make api` | Regenerate REST API server code from `api/v1/api.yaml` |
| `make protoc` | Regenerate gRPC code from `proto/coordinator/v1/` |

## Frontend-only dev loop

```bash
cd ui
pnpm install
pnpm dev       # serves the UI on :8081, proxies API calls to :8080
```

Run `dagu start-all` in a separate terminal for the backend.

## Verify

```bash
.local/bin/dagu version
```

See [CONTRIBUTING.md](https://github.com/dagucloud/dagu/blob/main/CONTRIBUTING.md) for the full development workflow.
