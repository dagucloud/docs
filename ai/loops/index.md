---
title: Agent Loops
description: Run coding agents in open, closed, inner, and outer loops. What each term means, which Dagu fields build each loop, and how to choose between them.
---

# Agent Loops

A coding agent that runs once produces a draft. What makes the result trustworthy is the loop around the agent: what checks the work, what goes back to the agent when the check fails, and who decides the work is done.

In Dagu that loop is part of the workflow, not part of the prompt. [`harness.run`](/step-types/harness/) runs the agent. A check that the agent cannot edit decides whether it runs again. A [`human.task`](/writing-workflows/human-tasks) brings in a person where the decision needs judgment. The run is durable throughout: it survives restarts, waits for people without holding a process, and records every attempt.

<picture>
  <source media="(max-width: 640px)" srcset="/loops/loops-nested-portrait.svg" width="480" height="670">
  <img src="/loops/loops-nested.svg" width="720" height="420" alt="A coding agent runs its own tool loop inside a harness.run step. Around it, an inner loop sends the agent's changes to a check, such as tests, and sends failures back until the check passes. Around that, an outer loop sends work that passed to a person in a human.task step, who completes it or pushes it back with feedback. Completed work moves on." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

## Four Terms, Two Questions

The four terms answer two different questions about a loop.

**Does the result go back to the agent?**

- **Open loop.** The agent runs and its result is used as it is. Nothing the result reveals reaches the agent again. A nightly digest, a draft that a person edits, and a triage report are open loops.
- **Closed loop.** A check measures each result, and a failure goes back to the agent, with what the check found, for another attempt. The loop ends when the check passes or a limit is reached.

Repetition is not feedback. An agent that runs every night, or reruns after a crash, is still in an open loop if nothing looks at what it produced and tells it. [Closed Loops](./closed-loop) covers what a closed loop needs, and the loops that only look closed.

**Where does the loop sit, and what closes it?**

- **Inner loop.** The fastest loop around one piece of work. The agent changes something, a command checks it, and failures go straight back. Each turn takes seconds to minutes, and no person is involved.
- **Outer loop.** A loop that contains inner loops and crosses a boundary such as a person's review, a schedule, a pull request, or production. Each turn takes hours to days.

Inner and outer are relative: every loop is inner to the loop around it. The innermost loop runs inside the agent itself, as Claude Code or Codex calls tools until it decides to stop. Dagu does not see inside that loop. It starts the agent, and it owns every loop above it.

The two questions are independent, but useful workflows tend to land in the same place: a closed inner loop that a command closes, nested in a closed outer loop that a person closes.

| Loop | Closed by | Built with | Turn time | Guide |
|---|---|---|---|---|
| Agent loop | The agent's own judgment | The agent CLI inside `harness.run` | Seconds | [Harness](/step-types/harness/) |
| Open loop | Nothing reaches the agent | `harness.run`, artifacts, an optional gate | One run | [Open Loops](./open-loop) |
| Closed loop | A check outside the agent | A signal, a route back, and a limit | Minutes to days | [Closed Loops](./closed-loop) |
| Inner loop | A command | `repeat_policy` on `harness.run` or `dag.run` | Minutes | [Inner Loops](./inner-loop) |
| Outer loop | A person | `human.task` with `push_back` | Hours | [Outer Loops](./outer-loop) |
| Background loop | The loops inside it; a schedule or an event starts it | `schedule`, webhooks, `watch`, `parallel` | Days | [Background Loops](./background-loop) |

## Gates and Loops

A check that can only stop bad work is a gate. A check that sends work back is a loop.

- A step that runs the tests after the agent and fails the run is a gate. Put it inside a `repeat_policy` and it becomes a loop.
- A `human.task` without `with.push_back` is a gate: the person completes it, or stops the run. With `push_back`, it closes a loop: the person's feedback reruns the agent.

Gates are still useful. An open loop with a gate is the right shape when a person reads the result anyway and fixing it by hand is cheaper than explaining the fix.

## Who Decides the Work Is Done

In a bare agent loop, the agent decides. It stops when the work looks done to it. The Claude Code documentation puts the consequence plainly: without a check that comes back pass or fail, "that makes you the test suite."

A Dagu loop moves that decision out of the agent:

- An inner loop ends when a command exits 0, not when the agent says it has finished.
- An outer loop ends when a person completes the task, not when the agent stops asking.
- Every loop has a limit, and running out of attempts is an outcome the workflow handles: the run fails, or a person takes over.

## Choosing a Loop

```text
Can a command decide whether the work is right?
├─ yes → inner loop, closed by that command
│        Must a person still judge the work before it ships?
│        ├─ yes → nest it in an outer loop: human.task with push_back
│        └─ no  → ship on pass; fail or escalate when attempts run out
└─ no  → Will a person judge the result?
         ├─ yes, and send it back with feedback → outer loop
         ├─ yes, but only accept it or stop    → open loop with a gate
         └─ no                                 → open loop; keep the result as an artifact
```

When the order of steps itself depends on what the agent finds, rather than a fixed check-and-retry shape, use an [Agent DAG](/writing-workflows/agent) instead: a model chooses the next action until declared goals are met.

## Design Rules

These rules follow from published results on self-correction, verifier-driven code generation, and the ways coding agents fail. Each guide shows the fields that apply them.

1. **End the loop on a command, not on the agent's claim.** Models that review their own work without outside feedback do not reliably improve it, and often make it worse ([Huang et al.](https://arxiv.org/abs/2310.01798)). The same models improve when the feedback comes from running the code ([Chen et al.](https://arxiv.org/abs/2304.05128), [Gou et al.](https://arxiv.org/abs/2305.11738)).
2. **Keep the check out of the agent's reach.** Under pressure, agents edit tests or special-case them, and Anthropic reports that this "typically emerges after multiple failed attempts" ([Claude 3.7 Sonnet system card](https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf)). Run the check as a step the agent does not write, and fail when test files change.
3. **Send back what failed, not "try again".** Specific feedback outperforms generic feedback ([Madaan et al.](https://arxiv.org/abs/2303.17651)). Pass the failing output to the next attempt.
4. **Allow a few attempts, then escalate.** Most of the gain arrives in the first two or three rounds ([Gou et al.](https://arxiv.org/abs/2305.11738), [Li et al.](https://arxiv.org/abs/2502.14382)), and agents "succeed quickly and fail slowly" ([Yang et al.](https://arxiv.org/abs/2405.15793)). A limit of 3 to 5 is a sound default; past it, hand the work to a person instead of raising the limit.
5. **Start each attempt fresh and keep state in files.** Long sessions degrade. Each repeat of a `harness.run` step starts a new agent process, so the plan, progress notes, and check output belong in files the next attempt reads.
6. **Review with a different model.** Model judges favour output from their own model ([Zheng et al.](https://arxiv.org/abs/2306.05685), [Panickssery et al.](https://arxiv.org/abs/2404.13076)). Give the reviewer a different provider, and give it the check results.
7. **Put people at the plan and the merge, not in every turn.** A reviewed plan has more leverage than reviewed code, and passing tests does not make a change mergeable: maintainers would not merge about half of the benchmark pull requests that an automated grader passed ([METR](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/)).
8. **Give the agent a way to ask for help.** An explicit "needs a person" exit cut test cheating from 54% to 9% for one frontier model ([Zhong et al.](https://arxiv.org/abs/2510.20270)). [Outer Loops](./outer-loop#hand-over-when-the-agent-gives-up) shows the wiring.

## In This Section

- [Open Loops](./open-loop): run an agent once, keep its result reviewable, and gate what ships.
- [Closed Loops](./closed-loop): send what a check found back to the agent, with a command, a reviewer agent, or a person, and spot the loops that only look closed.
- [Inner Loops](./inner-loop): run an agent until a command passes, with the failure fed back each time.
- [Outer Loops](./outer-loop): let a person send work back with feedback, review plans, and take over when the agent runs out of attempts.
- [Background Loops](./background-loop): run loops on a schedule or an event, fan them out over many items, and review the results later.

## Further Reading

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), Anthropic: workflows, agents, and the evaluator-optimizer pattern.
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), Anthropic: progress files and one feature per session.
- [Humans and Agents in Software Engineering Loops](https://www.martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html), Kief Morris: humans in, on, and out of the loop.
- [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/), Simon Willison: success criteria and budgets.
- [Ralph](https://ghuntley.com/ralph/), Geoffrey Huntley: a fresh agent per iteration, with tests as back pressure.
- [Advanced context engineering for coding agents](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md), HumanLayer: research, plan, implement, and reviewing plans instead of code.
