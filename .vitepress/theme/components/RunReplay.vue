<script setup>
// Plays back a recorded run of a tutorial lesson DAG: the graph, each step's
// status over time, and the logs and outputs the step produced. Recordings
// come from `pnpm record:tutorial`.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  // Lesson DAG name, such as tutorial-01-first-workflow.
  run: { type: String, required: true },
})

const recordings = import.meta.glob('../../../tutorial/runs/*.json', {
  eager: true,
  import: 'default',
})
const recording = Object.entries(recordings).find(([path]) =>
  path.endsWith(`/${props.run}.json`),
)?.[1]
if (!recording) {
  throw new Error(`RunReplay: no recording named ${props.run}`)
}

const NODE_WIDTH = 168
const NODE_HEIGHT = 50
const COLUMN_GAP = 16
const ROW_GAP = 30
const PADDING = 6
const SPEEDS = [1, 2]
// Runs shorter than this play in slow motion so each step is visible.
const MIN_PLAYBACK_MS = 2000
const HANDLER_LABELS = {
  onInit: 'on init',
  onSuccess: 'on success',
  onFailure: 'on failure',
  onAbort: 'on abort',
  onWait: 'on wait',
  onExit: 'on exit',
}
const STATUS_LABELS = {
  not_started: 'Not started',
  running: 'Running',
  retrying: 'Retrying',
  waiting: 'Waiting',
  queued: 'Queued',
  succeeded: 'Succeeded',
  partially_succeeded: 'Partially succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
  aborted: 'Aborted',
  rejected: 'Rejected',
}

// Steps flow top to bottom. A step's row is the length of the longest
// dependency path above it, counting router edges too.
function graphLayout(steps) {
  const parents = new Map(steps.map((step) => [step.id, [...step.depends]]))
  for (const step of steps) {
    for (const target of step.routesTo) parents.get(target)?.push(step.id)
  }
  const level = new Map()
  const levelOf = (id) => {
    if (!level.has(id)) {
      level.set(id, 0)
      const ups = parents.get(id) ?? []
      level.set(id, ups.length ? Math.max(...ups.map(levelOf)) + 1 : 0)
    }
    return level.get(id)
  }
  steps.forEach((step) => levelOf(step.id))

  const rows = []
  for (const step of steps) (rows[level.get(step.id)] ??= []).push(step)
  const widest = Math.max(...rows.map((row) => row.length))
  const width = PADDING * 2 + widest * NODE_WIDTH + (widest - 1) * COLUMN_GAP
  const nodes = rows.flatMap((row, rowIndex) => {
    const rowWidth = row.length * NODE_WIDTH + (row.length - 1) * COLUMN_GAP
    const left = (width - rowWidth) / 2
    return row.map((step, column) => ({
      ...step,
      x: left + column * (NODE_WIDTH + COLUMN_GAP),
      y: PADDING + rowIndex * (NODE_HEIGHT + ROW_GAP),
    }))
  })

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edge = (from, to, routed) => {
    const a = byId.get(from)
    const b = byId.get(to)
    const x1 = a.x + NODE_WIDTH / 2
    const y1 = a.y + NODE_HEIGHT
    const x2 = b.x + NODE_WIDTH / 2
    const y2 = b.y
    const bend = ROW_GAP / 2
    return {
      key: `${from}-${to}`,
      routed,
      d: `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`,
    }
  }
  const edges = nodes.flatMap((node) => [
    ...node.depends.map((parent) => edge(parent, node.id, false)),
    ...node.routesTo.map((target) => edge(node.id, target, true)),
  ])
  return {
    nodes,
    edges,
    width,
    height: PADDING * 2 + rows.length * NODE_HEIGHT + (rows.length - 1) * ROW_GAP,
  }
}

const layout = graphLayout(recording.steps)

const duration = recording.durationMs
const slowMotion = Math.min(1, duration / MIN_PLAYBACK_MS)
const time = ref(duration)
const playing = ref(false)
const speed = ref(1)
const pinned = ref('')
const root = ref(null)
let frame = 0
let lastTick = 0
let observer

// Until a step is picked, the log follows the step that changed most
// recently; a finished run shows its failed step, or else its last step.
const selected = computed(() => {
  if (pinned.value) return pinned.value
  if (time.value >= duration) {
    const failed = recording.steps.find((step) => recording.results[step.id]?.status === 'failed')
    return (failed ?? recording.steps.at(-1)).id
  }
  const latest = recording.events.findLast(
    (event) => event.t <= time.value && event.target !== '$run' && event.status !== 'not_started',
  )
  return latest?.target ?? recording.steps[0].id
})

function statusAt(target, at) {
  let status = 'not_started'
  for (const event of recording.events) {
    if (event.t > at) break
    if (event.target === target) status = event.status
  }
  return status
}

// When a step is selected mid-run, its log fills in over its running time.
function visibleLines(target, text) {
  const lines = text ? text.split('\n') : []
  const status = statusAt(target, time.value)
  if (status === 'not_started') return []
  if (status !== 'running') return lines
  const events = recording.events.filter((event) => event.target === target)
  const start = events.find((event) => event.status === 'running')?.t ?? 0
  const end = events.find((event) => event.t > start && event.status !== 'running')?.t ?? duration
  const progress = (time.value - start) / Math.max(1, end - start)
  return lines.slice(0, Math.floor(lines.length * Math.min(1, progress)))
}

// The run's own status is polled, so it can trail its first step by a moment.
const runStatus = computed(() => {
  const status = statusAt('$run', time.value)
  return status === 'not_started' && time.value > 0 ? 'running' : status
})
const nodeStatus = computed(() =>
  Object.fromEntries(
    [...recording.steps.map((step) => step.id), ...recording.handlers].map((id) => [
      id,
      statusAt(id, time.value),
    ]),
  ),
)

const detail = computed(() => {
  const id = selected.value
  const result = recording.results[id] ?? {}
  const step = recording.steps.find((candidate) => candidate.id === id)
  const status = nodeStatus.value[id]
  const done = !['not_started', 'running', 'retrying', 'waiting', 'queued'].includes(status)
  return {
    id,
    label: HANDLER_LABELS[id] ?? id,
    action: step?.action ?? 'run',
    status,
    stdout: visibleLines(id, result.stdout),
    stderr: visibleLines(id, result.stderr),
    outputs: done ? Object.entries(result.outputs ?? {}) : [],
    subRuns: done ? result.subRuns ?? [] : [],
  }
})

function badges(step) {
  const result = recording.results[step.id] ?? {}
  if (!['succeeded', 'failed', 'partially_succeeded'].includes(nodeStatus.value[step.id])) {
    return step.approval ? ['approval'] : []
  }
  return [
    step.approval && 'approval',
    result.retries > 0 && `retried ${result.retries}×`,
    result.executions > 1 && `ran ${result.executions}×`,
    result.subRuns?.length > 1 && `${result.subRuns.length} child runs`,
  ].filter(Boolean)
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`
}

function tick(now) {
  if (!playing.value) return
  time.value = Math.min(duration, time.value + (now - lastTick) * speed.value * slowMotion)
  lastTick = now
  if (time.value >= duration) {
    playing.value = false
    return
  }
  frame = requestAnimationFrame(tick)
}

function play() {
  if (time.value >= duration) time.value = 0
  playing.value = true
  lastTick = performance.now()
  frame = requestAnimationFrame(tick)
}

function pause() {
  playing.value = false
  cancelAnimationFrame(frame)
}

function scrub(event) {
  pause()
  time.value = Number(event.target.value)
}

function cycleSpeed() {
  speed.value = SPEEDS[(SPEEDS.indexOf(speed.value) + 1) % SPEEDS.length]
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // Plays once, the first time the replay scrolls into view.
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      play()
    },
    { threshold: 0.6 },
  )
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <figure ref="root" class="run-replay" :aria-label="`Recorded run of ${run}`">
    <div class="rr-bar">
      <button
        type="button"
        class="rr-play"
        :aria-label="playing ? 'Pause replay' : 'Play replay'"
        @click="playing ? pause() : play()"
      >
        {{ playing ? 'Pause' : time >= duration ? 'Replay' : 'Play' }}
      </button>
      <button type="button" class="rr-speed" aria-label="Playback speed" @click="cycleSpeed">
        {{ speed }}×
      </button>
      <input
        class="rr-scrub"
        type="range"
        min="0"
        :max="duration"
        :value="time"
        aria-label="Replay position"
        @input="scrub"
      />
      <span class="rr-clock">{{ formatSeconds(time) }} / {{ formatSeconds(duration) }}</span>
      <span class="rr-run" :data-status="runStatus" aria-live="polite">
        {{ STATUS_LABELS[runStatus] }}
      </span>
    </div>

    <div class="rr-graph">
      <div class="rr-canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
        <svg :width="layout.width" :height="layout.height" aria-hidden="true">
          <path
            v-for="edge in layout.edges"
            :key="edge.key"
            :d="edge.d"
            :class="{ routed: edge.routed }"
          />
        </svg>
        <button
          v-for="node in layout.nodes"
          :key="node.id"
          type="button"
          class="rr-node"
          :class="{ selected: node.id === selected }"
          :data-status="nodeStatus[node.id]"
          :style="{ left: `${node.x}px`, top: `${node.y}px`, width: `${NODE_WIDTH}px`, height: `${NODE_HEIGHT}px` }"
          :aria-label="`${node.id}, ${STATUS_LABELS[nodeStatus[node.id]]}`"
          :aria-pressed="node.id === selected"
          @click="pinned = node.id"
        >
          <span class="rr-node-id">{{ node.id }}</span>
          <span class="rr-node-meta">
            <span>{{ node.action }}</span>
            <span v-for="badge in badges(node)" :key="badge" class="rr-badge">{{ badge }}</span>
          </span>
        </button>
      </div>
    </div>

    <div v-if="recording.handlers.length" class="rr-handlers">
      <span>Handlers</span>
      <button
        v-for="handler in recording.handlers"
        :key="handler"
        type="button"
        class="rr-handler"
        :class="{ selected: handler === selected }"
        :data-status="nodeStatus[handler]"
        :aria-pressed="handler === selected"
        @click="pinned = handler"
      >
        {{ HANDLER_LABELS[handler] }} · {{ STATUS_LABELS[nodeStatus[handler]] }}
      </button>
    </div>

    <div class="rr-log" aria-live="off">
      <div class="rr-log-head">
        <b>{{ detail.label }}</b>
        <span>{{ detail.action }}</span>
        <span :data-status="detail.status">{{ STATUS_LABELS[detail.status] }}</span>
      </div>
      <pre v-if="detail.stdout.length">{{ detail.stdout.join('\n') }}</pre>
      <pre v-if="detail.stderr.length" class="rr-stderr">{{ detail.stderr.join('\n') }}</pre>
      <dl v-if="detail.outputs.length" class="rr-outputs">
        <template v-for="[name, value] in detail.outputs" :key="name">
          <dt>{{ name }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
      <ul v-if="detail.subRuns.length" class="rr-subruns">
        <li v-for="sub in detail.subRuns" :key="sub.params">
          {{ sub.dag }} <span>{{ sub.params }}</span>
        </li>
      </ul>
      <p
        v-if="!detail.stdout.length && !detail.stderr.length && !detail.outputs.length && !detail.subRuns.length"
        class="rr-empty"
      >
        {{ detail.status === 'not_started' || detail.status === 'running' ? 'No output yet' : 'No output' }}
      </p>
    </div>
    <figcaption>
      A recorded run of this lesson's DAG. Select a step to see its log.
    </figcaption>
  </figure>
</template>

<style scoped>
.run-replay {
  --rr-success: #178a44;
  --rr-error: #c8382f;
  --rr-running: #5d4fe0;
  --rr-neutral: #80808b;
  --rr-warning: #9a5d0b;
  --rr-aborted: #9333ea;
  margin: 1rem 0 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.dark .run-replay {
  --rr-success: #22c55e;
  --rr-error: #ef5350;
  --rr-running: #a89ff8;
  --rr-neutral: #8a8d99;
  --rr-warning: #d9a03c;
  --rr-aborted: #c084fc;
}

[data-status='succeeded'] { --rr-status: var(--rr-success); }
[data-status='failed'],
[data-status='rejected'] { --rr-status: var(--rr-error); }
[data-status='running'],
[data-status='retrying'] { --rr-status: var(--rr-running); }
[data-status='waiting'],
[data-status='queued'],
[data-status='partially_succeeded'] { --rr-status: var(--rr-warning); }
[data-status='aborted'] { --rr-status: var(--rr-aborted); }
[data-status='not_started'],
[data-status='skipped'] { --rr-status: var(--rr-neutral); }

.rr-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.75rem;
}

.rr-play,
.rr-speed {
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.rr-play {
  min-width: 4.5rem;
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.rr-scrub {
  flex: 1;
  min-width: 4rem;
  accent-color: var(--vp-c-brand-1);
}

.rr-clock {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-variant-numeric: tabular-nums;
}

.rr-run {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--rr-status) 14%, transparent);
  color: var(--rr-status);
  font-weight: 650;
  white-space: nowrap;
}

.rr-graph {
  padding: 0.75rem;
  overflow-x: auto;
}

.rr-canvas {
  position: relative;
  margin: 0 auto;
}

.rr-canvas svg {
  position: absolute;
  inset: 0;
}

.rr-canvas path {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.4;
}

.rr-canvas path.routed {
  stroke-dasharray: 4 4;
}

.rr-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
  padding: 0 0.6rem 0 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-left: 4px solid var(--rr-status);
  border-radius: 8px;
  background: var(--vp-c-bg);
  text-align: left;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.rr-node[data-status='skipped'],
.rr-node[data-status='not_started'] {
  opacity: 0.65;
}

.rr-node[data-status='running'],
.rr-node[data-status='retrying'] {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--rr-running) 25%, transparent);
}

.rr-node.selected {
  border-color: var(--vp-c-brand-1);
  border-left-color: var(--rr-status);
}

.rr-node-id {
  overflow: hidden;
  color: var(--vp-c-text-1);
  font: 600 0.78rem/1.2 var(--vp-font-family-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rr-node-meta {
  display: flex;
  gap: 0.3rem;
  overflow: hidden;
  color: var(--vp-c-text-3);
  font-size: 0.66rem;
  white-space: nowrap;
}

.rr-badge {
  padding: 0 0.3rem;
  border-radius: 4px;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
}

.rr-handlers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.75rem 0.65rem;
  color: var(--vp-c-text-3);
  font-size: 0.7rem;
}

.rr-handler {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-left: 3px solid var(--rr-status);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 0.7rem;
}

.rr-handler.selected {
  border-color: var(--vp-c-brand-1);
  border-left-color: var(--rr-status);
}

.rr-log {
  min-height: 7.5rem;
  padding: 0.6rem 0.8rem 0.8rem;
  background: var(--kiln-code-bg);
  color: var(--kiln-code-text);
  font-size: 0.75rem;
}

.rr-log-head {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
  color: #8b8d96;
  font-family: var(--vp-font-family-mono);
}

.rr-log-head b {
  color: var(--kiln-code-text);
}

.rr-log-head [data-status] {
  color: var(--rr-status);
}

.rr-log pre {
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  background: none;
  font: 0.75rem/1.55 var(--vp-font-family-mono);
  white-space: pre-wrap;
  word-break: break-word;
}

.rr-log pre + pre {
  margin-top: 0.3rem;
}

.rr-log .rr-stderr {
  color: #f08a80;
}

.rr-outputs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.15rem 0.8rem;
  margin: 0.5rem 0 0;
  font-family: var(--vp-font-family-mono);
}

.rr-outputs dt {
  color: var(--kiln-code-amber);
}

.rr-outputs dd {
  margin: 0;
}

.rr-subruns {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  font-family: var(--vp-font-family-mono);
}

.rr-subruns span {
  color: #8b8d96;
}

.rr-empty {
  margin: 0;
  color: #8b8d96;
}

.run-replay figcaption {
  padding: 0.4rem 0.8rem;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
  font-size: 0.7rem;
}
</style>
