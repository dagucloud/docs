---
title: Background Loops
description: Run agent loops that nobody starts by hand. Work through a backlog overnight, open one run per issue, fan out over many items, and review the results when convenient.
---

# Background Loops

Some loops run without anyone starting them: a nightly pass over a backlog, a run for every new issue, a sweep over forty files that need the same migration. A schedule or an event starts the run, [inner loops](./inner-loop) do the work, and a person reviews the results when it suits them, such as the next morning. What ships changes what the next run finds, which [closes the loop](./closed-loop) at the slowest timescale.

<picture>
  <source media="(max-width: 640px)" srcset="/loops/loops-background-portrait.svg" width="480" height="540">
  <img src="/loops/loops-background.svg" width="720" height="256" alt="A schedule, a webhook, or a watched folder starts a run. The run gives each item its own inner loop, then a person reviews the results in a human.task step and pushes back any that need another pass. What ships changes what the next run finds." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

A background loop has nobody watching while it runs, so everything that a person would normally catch must be a field: the check, the attempt limit, the timeouts, the sandbox, and the point where the work stops and waits.

## Overnight, Reviewed in the Morning

Each weeknight, the agent takes the next item from a backlog file in its own worktree, loops until the tests pass, and commits. In the morning, a person reviews the commit and opens the pull request, or sends the work back.

```yaml
schedule: "0 2 * * 1-5"
working_dir: /srv/repos/app
timeout_sec: 14400

steps:
  - id: worktree
    action: git.worktree.add
    with:
      branch: agent/backlog-${context.run.id}
      create_branch: true
      path: ../app-agent/${context.run.id}

  - id: work
    depends: [worktree]
    working_dir: ../app-agent/${context.run.id}
    action: harness.run
    with:
      provider: claude
      model: sonnet
      permission_mode: acceptEdits
      allowed_tools: "Bash(make test)"
      add_dir: ${context.paths.artifacts_dir}
      prompt: |
        Take the first unchecked item in BACKLOG.md. Implement only that
        item, then check it off in BACKLOG.md. The work is done only when
        `make test` passes. If ${context.paths.artifacts_dir}/test.log exists,
        it holds the output of the last failed `make test`. Read it first and
        fix what it reports, even if the item does not mention it.
    timeout_sec: 1800
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: commit
    depends: [work]
    working_dir: ../app-agent/${context.run.id}
    run: |
      make test
      git add -A
      git diff --cached --quiet || git commit -m "Implement the next BACKLOG.md item"
      git show HEAD > "${DAG_RUN_ARTIFACTS_DIR}/change.diff"

  - id: review
    depends: [commit]
    action: human.task
    with:
      prompt: |
        Last night's backlog item is on ${steps.worktree.outputs.branch}.
        Complete the task to open a pull request, or request changes.
      artifacts:
        - change.diff
        - test.log
      push_back:
        rewind_to: work
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string

  - id: open_pr
    depends: [review]
    working_dir: ../app-agent/${context.run.id}
    run: git push -u origin HEAD && gh pr create --fill

  - id: cleanup
    depends: [open_pr]
    action: git.worktree.remove
    with:
      path: ${steps.worktree.outputs.path}
```

- `git.worktree.add` gives each run its own branch and directory, both named after the run ID, so the agent never touches the checkout people work in. A relative `path` resolves from the repository root, and a relative step `working_dir` from the DAG's `working_dir`, so both name the same directory.
- `repeat_policy` checks with `make test` in the worktree, because the condition runs in the step's working directory.
- The run waits at `review` overnight without holding a process. A push-back reruns `work` in the same worktree, with the feedback in the prompt, and commits again.
- `timeout_sec` at the top bounds the whole night's work; on the step it bounds each attempt.

A DAG without a `queue` runs one instance at a time, so a schedule never starts a second run while the last one is still working. A run that waits for review does not count as working.

## One Run per Issue

A backlog file suits one stream of work. For a queue of independent tasks, such as issues labelled for the agent, give each task its own root run. Each run then has its own inner loop, its own review, and its own push-backs, and one slow review does not hold up the others.

The workflow for one issue:

```yaml
# issue-to-pr.yaml
working_dir: /srv/repos/app

params:
  - name: issue
    type: string

steps:
  - id: worktree
    action: git.worktree.add
    with:
      branch: agent/issue-${params.issue}
      create_branch: true
      base: main
      path: ../app-issues/${params.issue}

  - id: brief
    depends: [worktree]
    run: gh issue view ${params.issue} > "${DAG_RUN_ARTIFACTS_DIR}/issue.md"

  - id: fix
    depends: [brief]
    working_dir: ../app-issues/${params.issue}
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Resolve the issue in ${context.paths.artifacts_dir}/issue.md.
        The work is done only when `make test` passes.
        If ${context.paths.artifacts_dir}/test.log exists, it holds the output
        of the last failed `make test`. Read it first and fix what it reports,
        even if the issue does not mention it.
    timeout_sec: 1800
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 4

  - id: commit
    depends: [fix]
    working_dir: ../app-issues/${params.issue}
    run: |
      make test
      git add -A
      git diff --cached --quiet || git commit -m "Resolve #${params.issue}"
      git diff main > "${DAG_RUN_ARTIFACTS_DIR}/change.diff"

  - id: review
    depends: [commit]
    action: human.task
    with:
      prompt: Review the fix for issue ${params.issue}.
      artifacts:
        - issue.md
        - change.diff
      push_back:
        rewind_to: fix
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string

  - id: open_pr
    depends: [review]
    working_dir: ../app-issues/${params.issue}
    run: |
      git push -u origin HEAD
      gh pr create --fill --body "Closes #${params.issue}"
```

A dispatcher on a schedule starts one run per labelled issue, and relabels the issue so that the next pass skips it:

```yaml
# issue-dispatch.yaml
schedule: "*/30 * * * *"
working_dir: /srv/repos/app

steps:
  - id: dispatch
    run: |
      for n in $(gh issue list --label agent-ready --json number --jq '.[].number'); do
        gh issue edit "$n" --remove-label agent-ready --add-label agent-working
        dagu enqueue issue-to-pr -- issue="$n"
      done
```

`dagu enqueue` creates a root run, which is what lets each issue wait for its own review. A child started with `dag.run` or `dag.enqueue` cannot contain a human task. The dispatcher calls the `dagu` CLI on the scheduler's host, so the binary must be on that host's `PATH`.

Runs of `issue-to-pr` share its queue and start one at a time, while runs waiting for review stay open beside them. To work on several issues at once, assign the DAG to a [global queue](/server-admin/queues) with more concurrency.

To start runs as issues arrive instead of polling, trigger `issue-to-pr` through a [webhook](/server-admin/authentication/webhooks). Webhook runs are root runs too, and the request's payload is available to the steps as `WEBHOOK_PAYLOAD_FILE`.

## Many Items in One Run

When the items are parts of one change, such as forty files that move to a new API, keep them in one run. Fan out with `parallel`, give each item its own inner loop in a child workflow, and review the batch once:

```yaml
working_dir: /srv/repos/app

steps:
  - id: find
    run: |
      files=$(grep -rl 'oldclient\.' --include='*.go' . | paste -sd, -)
      echo "files=$files" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: files

  - id: migrate
    depends: [find]
    action: dag.run
    with:
      dag: migrate-file
      params:
        repo: /srv/repos/app
        file: ${ITEM}
    parallel:
      items: ${steps.find.outputs.files}
      max_concurrent: 4

  - id: tests_pass
    depends: [migrate]
    run: make test

  - id: review
    depends: [tests_pass]
    action: human.task
    with:
      prompt: Review the migration of every file to newclient.

---
name: migrate-file
working_dir: ${params.repo}
params:
  - name: repo
    type: string
  - name: file
    type: string

steps:
  - id: migrate
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Migrate ${params.file} from oldclient to newclient. Change only that file.
    repeat_policy:
      repeat: until
      condition: go vet ./... && go build ./...
      limit: 3

  - id: builds
    depends: [migrate]
    run: go build ./...
```

Each child is its own run with its own attempts, and `max_concurrent` bounds how many agents work at once. The children share one working tree, so tell each agent to touch only its own file, or give each child a worktree.

The batch review here is a gate: the person completes it or stops the run. A push-back would rerun every child, so when items need individual feedback, give each item its own root run as in [One Run per Issue](#one-run-per-issue).

## Run Unattended Safely

| Risk | Field |
|---|---|
| The agent damages the host or reads secrets | Run it in a [container sandbox](/step-types/harness/sandbox/) with explicit mounts and network rules, and pass only the [credentials](/step-types/harness/sandbox/credentials) it needs. |
| An attempt hangs | `timeout_sec` on the step. |
| A night's work runs away | `repeat_policy.limit`, `timeout_sec` at the top of the DAG, and the provider's own spend cap, such as Claude Code's `max_budget_usd`. |
| A provider hits its rate limit or goes down | `repeat_policy.interval_sec` with `backoff`, and `with.fallback` to another provider. |
| Two runs edit the same checkout | `git.worktree.add`, and the DAG's queue. |
| Nobody notices the run is waiting | A [notification rule](/web-ui/notifications) on the **Waiting** event, or `handler_on.wait`. See [Reach the Reviewer](./outer-loop#reach-the-reviewer). |

A scheduler must be running for schedules, queued runs, and resumes after a review: `dagu scheduler`, or `dagu start-all` with the web server. With [distributed workers](/server-admin/distributed/), runs go to matching workers, and a run waiting for a person releases its worker.

## See Also

- [Scheduling](/writing-workflows/scheduling): cron expressions, time zones, and catch-up.
- [Watched Folders](/writing-workflows/watched-folders): start a run when a file arrives.
- [Git](/step-types/git#linked-worktrees): linked worktrees.
- [Outer Loops](./outer-loop): push-back, plan review, and handing work to a person.
