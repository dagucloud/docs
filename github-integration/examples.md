# GitHub Integration Examples

This page shows practical cases where Dagu is a better fit than plain GitHub-hosted CI:

- integration tests against private services
- deployment from an internal server with cluster access
- preview environment creation from a PR comment
- long-running soak tests handed off from GitHub Actions
- hardware or GPU validation on your own machines

## Pull Request Integration Tests in a Private Network

Use this when a pull request should run tests against resources that GitHub-hosted runners cannot reach, such as:

- a staging database inside your VPC
- an internal API
- a private Kubernetes cluster
- hardware or services available only inside your own network

### Binding

- `trigger_type`: `auto`
- `event_name`: `pull_request`
- `action`: `*`
- `branch_pattern`: `main`
- `check_name`: `Integration Tests`

This means:

- run for pull request activity against `main`, including open and synchronize events
- show a GitHub check named `Integration Tests`

### Workflow

```yaml
env:
  - name: DATABASE_URL
    value: postgres://staging.internal/app_test

steps:
  - id: migrate
    command: |
      ./scripts/migrate-test-db.sh "${DATABASE_URL}"

  - id: integration-test
    command: |
      ./scripts/run-integration-tests.sh
```

### Runtime Data

In this workflow, the most useful variables are usually:

- `GITHUB_EVENT_NAME`
- `GITHUB_EVENT_ACTION`
- `GITHUB_REPOSITORY`
- `GITHUB_PR_NUMBER`
- `GITHUB_SHA`
- `GITHUB_REF`

Why this is a good Dagu use case:

- the workflow runs on your own server
- the server can already reach private network resources
- GitHub still provides the trigger and check UI

## Preview Environment from a PR Comment

Use this when preview environments should be created only on demand, and only from infrastructure inside your own network.

### Binding

- `trigger_type`: `comment_command`
- `command_alias`: `preview`
- `check_name`: `Preview Deploy`

Trigger it from a PR comment:

```text
@dagucloud preview
```

### Workflow

```yaml
env:
  - name: PR_NUMBER
    value: ${GITHUB_PR_NUMBER}
  - name: IMAGE_TAG
    value: pr-${GITHUB_PR_NUMBER}-${GITHUB_SHA}

steps:
  - id: build-image
    command: |
      ./scripts/build-preview-image.sh "${IMAGE_TAG}"

  - id: deploy-preview
    command: |
      ./scripts/deploy-preview-env.sh "${PR_NUMBER}" "${IMAGE_TAG}"
```

### Runtime Data

In this workflow, the most useful variables are usually:

- `GITHUB_PR_NUMBER`
- `GITHUB_SHA`
- `GITHUB_REPOSITORY`
- `GITHUB_COMMAND`

Why this is a good Dagu use case:

- preview environments are expensive, so they should not run on every PR event
- the deployment can stay inside your private cluster and registry
- GitHub users can trigger it directly from the PR thread

## Long-Running Soak Test from GitHub Actions

Use this when GitHub Actions should decide when to start a test, but the actual test should run for a long time on your own infrastructure.

This is useful for:

- multi-hour load tests
- large regression suites
- tests that need internal services or private test data

### Binding

- `trigger_type`: `manual_dispatch`
- `event_name`: `repository_dispatch`
- `dispatch_event_type`: `soak_test`
- `check_name`: `Soak Test`

This means:

- GitHub sends an explicit `repository_dispatch` event
- Dagu runs the matching workflow on your licensed server
- GitHub shows a check named `Soak Test`

### GitHub Actions Handoff

After a normal build or unit test workflow succeeds, GitHub Actions can hand off to Dagu:

```yaml
- name: Start soak test in Dagu
  run: |
    gh api "repos/${GITHUB_REPOSITORY}/dispatches" \
      -f event_type=soak_test \
      -f client_payload[ref]="${GITHUB_REF}" \
      -f client_payload[sha]="${GITHUB_SHA}" \
      -f client_payload[suite]="full"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Workflow

```yaml
steps:
  - id: prepare
    command: |
      ./scripts/checkout-target.sh "${GITHUB_SHA}"

  - id: soak-test
    command: |
      ./scripts/run-soak-test.sh full
```

### Runtime Data

In this workflow, the most useful variables are usually:

- `GITHUB_EVENT_NAME`
- `GITHUB_EVENT_ACTION`
- `GITHUB_DISPATCH_EVENT_TYPE`
- `GITHUB_SHA`
- `GITHUB_REF`

Why this is a good Dagu use case:

- the short GitHub workflow stays simple
- the heavy test runs on your own machines for as long as needed
- private network access and large test environments stay outside GitHub-hosted runners

## Deploy to an Internal Cluster on Release

Use this when a GitHub release should trigger deployment from a server that already has the right network access, credentials, and tooling.

### Binding

- `trigger_type`: `auto`
- `event_name`: `release`
- `action`: `published`
- `tag_pattern`: `v*`
- `check_name`: `Production Deploy`

This means:

- run when a GitHub release is published
- only match release tags like `v1.2.3`
- show a GitHub check named `Production Deploy`

### Workflow

```yaml
env:
  - name: IMAGE_TAG
    value: ${GITHUB_RELEASE_TAG}
  - name: KUBECONFIG
    value: /etc/dagu/kubeconfig-prod

steps:
  - id: deploy
    command: |
      helm upgrade --install api ./deploy/chart \
        --namespace production \
        --set image.tag="${IMAGE_TAG}"
```

### Runtime Data

In this workflow, the most useful variables are usually:

- `GITHUB_EVENT_NAME`
- `GITHUB_EVENT_ACTION`
- `GITHUB_REPOSITORY`
- `GITHUB_RELEASE_TAG`
- `GITHUB_SHA`
- `GITHUB_REF`

Why this is a good Dagu use case:

- the Dagu server already has access to the target cluster
- you do not need to copy production credentials into GitHub Actions
- the release still starts from a normal GitHub event

## GPU or Hardware Validation on Push

Use this when a repository change must run on machines that you own, such as:

- a GPU server
- a device lab
- a licensed internal simulator
- a build host with large local caches or special toolchains

### Binding

- `trigger_type`: `auto`
- `event_name`: `push`
- `action`: `*`
- `branch_pattern`: `main`
- `check_name`: `Hardware Validation`

This means:

- run when code is pushed to `main`
- show a GitHub check named `Hardware Validation`

### Workflow

```yaml
steps:
  - id: prepare
    command: |
      ./scripts/setup-gpu-runner.sh

  - id: validate
    command: |
      ./scripts/run-hardware-validation.sh
```

### Runtime Data

In this workflow, the most useful variables are usually:

- `GITHUB_EVENT_NAME`
- `GITHUB_REPOSITORY`
- `GITHUB_SHA`
- `GITHUB_REF`

Why this is a good Dagu use case:

- the job must run on your own hardware
- the environment can keep large local assets, drivers, and caches
- GitHub still gets a normal check result

## Related Pages

- [GitHub Integration](/github-integration/)
- [Setup](/github-integration/setup)
