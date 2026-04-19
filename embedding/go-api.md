# Embedded Go API

The Go package `github.com/dagucloud/dagu` exposes an experimental API for starting Dagu DAG runs from another Go application.

The API is marked experimental in the package documentation. Names, options, and behavior may change before this API is declared stable.

```go
import "github.com/dagucloud/dagu"
```

## License

Dagu is distributed under `GPL-3.0-or-later`. Applications that import or link the embedded Go API and distribute the resulting binary should evaluate GPL obligations for the combined work.

For proprietary products that need to distribute Dagu as part of a non-GPL application, see [Licensing](/embedding/licensing).

## Local Execution

`dagu.New` creates an embedded engine backed by Dagu's file stores. `RunFile` and `RunYAML` load a DAG, start the run asynchronously, and return a `*dagu.Run`.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/dagucloud/dagu"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	engine, err := dagu.New(ctx, dagu.Options{
		HomeDir: "/var/lib/myapp/dagu",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		if err := engine.Close(context.Background()); err != nil {
			log.Printf("close Dagu engine: %v", err)
		}
	}()

	run, err := engine.RunYAML(ctx, []byte(`
name: embedded-local
params:
  - MESSAGE
steps:
  - name: hello
    command: echo "${MESSAGE}"
`), dagu.WithParams(map[string]string{
		"MESSAGE": "hello from the host app",
	}))
	if err != nil {
		log.Fatal(err)
	}

	status, err := run.Wait(ctx)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%s finished with %s\n", status.RunID, status.Status)
}
```

The same engine can load a workflow file:

```go
run, err := engine.RunFile(ctx, "/var/lib/myapp/workflows/report.yaml")
```

`Wait` blocks until the run reaches a terminal state or the context is canceled. It returns a non-nil status when the final status can be read. A non-success terminal status is returned as an error.

## Engine Options

`dagu.Options` maps to Dagu's existing config and file-backed storage paths.

| Field | Effect |
| --- | --- |
| `HomeDir` | Dagu application home used for default config and data paths. |
| `ConfigFile` | Explicit Dagu config file. |
| `DAGsDir` | Directory used to resolve named DAGs and sub-DAGs. |
| `DataDir` | File-backed state directory. |
| `LogDir` | Run log directory. |
| `ArtifactDir` | Artifact directory. |
| `BaseConfig` | Base config file applied while loading DAGs. |
| `Logger` | `*slog.Logger` used by the embedded engine. A quiet logger is used when nil. |
| `DefaultMode` | Default execution mode for runs that do not pass `WithMode`. |
| `Distributed` | Coordinator, TLS, worker selector, and status polling options for distributed mode. |

`Close` releases engine-owned resources. It does not replace `Run.Wait`, `Run.Stop`, or worker shutdown.

## Run Options

Run options apply to a single `RunFile` or `RunYAML` call.

| Option | Effect |
| --- | --- |
| `WithRunID(id)` | Sets an explicit DAG run ID. |
| `WithName(name)` | Overrides the loaded DAG name. |
| `WithParams(map[string]string)` | Sets DAG parameters from a Go map. |
| `WithParamsList([]string)` | Sets DAG parameters from `KEY=VALUE` entries. |
| `WithDefaultWorkingDir(dir)` | Sets the default working directory while loading the DAG. |
| `WithMode(mode)` | Overrides the engine default execution mode. |
| `WithWorkerSelector(map[string]string)` | Sets the distributed worker selector for one run. |
| `WithTags(tags...)` | Adds tags to one run. |
| `WithDryRun(enabled)` | Enables or disables dry-run mode. |

## Run Status And Cancellation

The run handle exposes the run reference and current state:

```go
ref := run.Ref()
status, err := run.Status(ctx)
err = run.Stop(ctx)
```

`Engine.Status(ctx, ref)` and `Engine.Stop(ctx, ref)` operate on a run reference. `Engine.Status` reads the local file-backed run status. For distributed runs, use the `Run` returned by `RunFile` or `RunYAML`; its `Status` method reads status from the coordinator.

`dagu.Status` contains the DAG name, run ID, attempt ID, status string, start and finish times, error string, log file path, archive directory, worker ID, and trigger type.

## Custom Executors

`RegisterExecutor` registers a process-local executor type that can be used in DAG YAML.

Registration mutates process-global state. Register custom executors before concurrent DAG loading or execution. `UnregisterExecutor` exists for tests and should not run concurrently with engine use.

```go
dagu.RegisterExecutor(
	"embedded_echo",
	func(_ context.Context, step dagu.Step) (dagu.Executor, error) {
		return &echoExecutor{step: step}, nil
	},
	dagu.WithExecutorCapabilities(dagu.ExecutorCapabilities{Command: true}),
)
```

The executor type name must start with a letter and may contain letters, digits, `_`, and `-`.

```go
type echoExecutor struct {
	step   dagu.Step
	stdout io.Writer
}

func (e *echoExecutor) SetStdout(out io.Writer) {
	e.stdout = out
}

func (e *echoExecutor) SetStderr(io.Writer) {}

func (e *echoExecutor) Kill(os.Signal) error {
	return nil
}

func (e *echoExecutor) Run(context.Context) error {
	out := e.stdout
	if out == nil {
		out = io.Discard
	}
	_, err := fmt.Fprintf(out, "handled %s\n", e.step.Name)
	return err
}
```

YAML can then reference the registered type:

```yaml
name: embedded-custom
steps:
  - name: call-go-code
    type: embedded_echo
    command: domain operation from DAG YAML
```

A custom executor is registered only in the current Go process. In distributed mode, every worker process that may execute a DAG containing that type must register the same executor type before it starts processing tasks.

## Distributed Execution

Embedded distributed execution dispatches a loaded DAG to an existing Dagu coordinator. The public embedded API does not start a coordinator; start one with Dagu server commands such as `dagu coord` or `dagu start-all` with coordinator settings.

The embedded coordinator client requires TLS configuration unless plaintext is explicitly enabled. For a local plaintext coordinator:

```go
TLS: dagu.TLSOptions{Insecure: true}
```

For TLS connections, use `CertFile`, `KeyFile`, `ClientCAFile`, and optionally `SkipTLSVerify`.

```go
engine, err := dagu.New(ctx, dagu.Options{
	HomeDir:     "/var/lib/myapp/dagu",
	DefaultMode: dagu.ExecutionModeDistributed,
	Distributed: &dagu.DistributedOptions{
		Coordinators: []string{"127.0.0.1:50055"},
		TLS:          dagu.TLSOptions{Insecure: true},
		WorkerSelector: map[string]string{
			"pool": "embedded",
		},
		PollInterval: time.Second,
	},
})
```

`RunFile` and `RunYAML` load and validate the DAG in the caller process, then dispatch the loaded YAML definition to the coordinator. Shared-nothing workers receive the DAG definition from the coordinator and do not read the caller's DAG file path.

An embedded worker can run in the same host process:

```go
worker, err := engine.NewWorker(dagu.WorkerOptions{
	ID:            "embedded-worker-1",
	MaxActiveRuns: 4,
	Labels:        map[string]string{"pool": "embedded"},
})
if err != nil {
	return err
}

workerCtx, stopWorker := context.WithCancel(ctx)
defer stopWorker()

go func() {
	if err := worker.Start(workerCtx); err != nil && !errors.Is(err, context.Canceled) {
		log.Printf("worker stopped: %v", err)
	}
}()

if err := worker.WaitReady(ctx); err != nil {
	return err
}

run, err := engine.RunFile(ctx, "/var/lib/myapp/workflows/report.yaml")
if err != nil {
	return err
}
status, err := run.Wait(ctx)
```

`WorkerOptions.Coordinators` overrides `DistributedOptions.Coordinators` when non-empty. `WorkerOptions.TLS` overrides `DistributedOptions.TLS` when non-zero. `HealthPort` starts the worker health endpoint on that port; `0` disables it.

## Repository Examples

The Dagu repository contains runnable examples:

```sh
go run ./examples/embedded/local
go run ./examples/embedded/custom-executor
DAGU_COORDINATORS=127.0.0.1:50055 go run ./examples/embedded/distributed
```

The distributed example expects a coordinator to already be listening at the address in `DAGU_COORDINATORS`.
