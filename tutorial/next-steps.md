# Next Steps

You now know the core of Dagu: steps and dependencies, the Web UI, parameters and outputs, actions, control flow, retries, sub-DAGs, schedules, approvals, and alerts.

Pick what fits your work next:

<div class="basic-next-grid">
  <a href="/writing-workflows/examples/"><b>Examples</b><span>Copy-ready workflows for common jobs.</span></a>
  <a href="/step-types/harness/"><b>Coding agents</b><span>Run Claude Code, Codex, and other agents as steps.</span></a>
  <a href="/writing-workflows/agent"><b>Agent DAGs</b><span>Let a model choose the next step at run time.</span></a>
  <a href="/writing-workflows/queues"><b>Queues</b><span>Limit how many runs of a workflow go at once.</span></a>
  <a href="/writing-workflows/secrets"><b>Secrets</b><span>Pass passwords and tokens without writing them into YAML.</span></a>
  <a href="/web-ui/notifications"><b>Notifications</b><span>Get a message when a run fails or waits.</span></a>
  <a href="/server-admin/distributed/"><b>Workers</b><span>Run steps on other machines.</span></a>
  <a href="/mcp/"><b>MCP</b><span>Let AI tools read and run your workflows.</span></a>
</div>

Clean up the tutorial folder when you are done. Stop `dagu start-all` with `Ctrl+C`, and delete `tutorial-08-scheduling.yaml` first if Dagu keeps running as a service.
