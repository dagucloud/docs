<script setup>
// Plays back a recorded run of a tutorial lesson DAG: the graph, each step's
// status over time, and the logs and outputs the step produced. Recordings
// come from `pnpm record:tutorial`.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RunStatusIcon from './RunStatusIcon.vue'

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

const NODE_WIDTH = 264
// Narrow screens shrink nodes down to this width before scaling the graph.
const MIN_NODE_WIDTH = 168
// Below this width a node drops its action icon.
const COMPACT_NODE_WIDTH = 216
const NODE_HEIGHT = 56
const COLUMN_GAP = 28
const ROW_GAP = 44
const PADDING = 16

// Playback stretches short gaps between status changes and shortens long
// ones, so every change stays visible: each gap plays for BEAT_MS plus
// BEAT_SCALE ms per square root of its recorded milliseconds.
const LEAD_IN_MS = 500
const BEAT_MS = 650
const BEAT_SCALE = 38
// Changes to different steps this close together play as one beat.
const SAME_BEAT_MS = 30

const SETTLED = new Set(['succeeded', 'failed', 'partially_succeeded', 'skipped', 'aborted', 'rejected'])
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
const HANDLER_LABELS = {
  onInit: 'on init',
  onSuccess: 'on success',
  onFailure: 'on failure',
  onAbort: 'on abort',
  onWait: 'on wait',
  onExit: 'on exit',
}
// Lucide icon paths (ISC license), keyed by action.
const ICONS = {
  run: ['M4 17l6-6-6-6', 'M12 19h8'],
  'http.request': [
    'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20',
    'M12 2a14.5 14.5 0 0 0 0 20a14.5 14.5 0 0 0 0-20',
    'M2 12h20',
  ],
  'js.run': [
    'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1',
    'M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1',
  ],
  'template.render': [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
  'dag.run': [
    'M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M7 11v4a2 2 0 0 0 2 2h4',
    'M15 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z',
  ],
  'router.route': ['M16 3h5v5', 'M8 3H3v5', 'M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3', 'm15 9 6-6'],
  'human.task': ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8'],
  handler: [
    'M10.268 21a2 2 0 0 0 3.464 0',
    'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  ],
  action: [
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    'm3.3 7 8.7 5 8.7-5',
    'M12 22V12',
  ],
}
const PLAY_ICON = 'M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7z'
const PAUSE_ICON = 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z'
const REPLAY_ICON = 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'

// Steps flow top to bottom. A step's row is the length of the longest
// dependency path above it. A router's edges replace the dependency edges
// it implies.
function graphLayout(steps, nodeWidth) {
  const routedFrom = new Map()
  for (const step of steps) {
    for (const target of step.routesTo) routedFrom.set(target, step.id)
  }
  const parents = new Map(steps.map((step) => [step.id, [...new Set([...step.depends, ...(routedFrom.has(step.id) ? [routedFrom.get(step.id)] : [])])]]))
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
  const width = PADDING * 2 + widest * nodeWidth + (widest - 1) * COLUMN_GAP
  const nodes = rows.flatMap((row, rowIndex) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * COLUMN_GAP
    const left = (width - rowWidth) / 2
    return row.map((step, column) => ({
      ...step,
      x: left + column * (nodeWidth + COLUMN_GAP),
      y: PADDING + rowIndex * (NODE_HEIGHT + ROW_GAP),
    }))
  })

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edge = (from, to) => {
    const a = byId.get(from)
    const b = byId.get(to)
    const x1 = a.x + nodeWidth / 2
    const y1 = a.y + NODE_HEIGHT
    const x2 = b.x + nodeWidth / 2
    const y2 = b.y
    const bend = ROW_GAP * 0.55
    return {
      key: `${from}-${to}`,
      from,
      to,
      routed: routedFrom.get(to) === from,
      x1,
      y1,
      x2,
      y2,
      d: `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`,
    }
  }
  const edges = nodes.flatMap((node) => parents.get(node.id).map((parent) => edge(parent, node.id)))
  return {
    nodes,
    edges,
    columns: widest,
    nodeWidth,
    width,
    height: PADDING * 2 + rows.length * NODE_HEIGHT + (rows.length - 1) * ROW_GAP,
  }
}

// Maps playback time to recorded time with one knot per beat.
function playbackKnots(events, duration) {
  const recorded = [0]
  let beat = new Set()
  for (const event of events) {
    if (event.status === 'not_started') continue
    if (event.t - recorded.at(-1) <= SAME_BEAT_MS && !beat.has(event.target)) {
      beat.add(event.target)
      continue
    }
    recorded.push(event.t)
    beat = new Set([event.target])
  }
  if (recorded.at(-1) < duration) recorded.push(duration)
  const shown = [LEAD_IN_MS]
  for (let i = 1; i < recorded.length; i++) {
    shown.push(shown[i - 1] + BEAT_MS + BEAT_SCALE * Math.sqrt(recorded[i] - recorded[i - 1]))
  }
  return { recorded, shown }
}

// First start, last finish, and whether the step paused for a person.
function stepSpans(events) {
  const spans = {}
  for (const event of events) {
    const span = (spans[event.target] ??= { start: null, end: null, waited: false })
    if (event.status === 'running' && span.start === null) span.start = event.t
    if (event.status === 'waiting') span.waited = true
    if (SETTLED.has(event.status)) span.end = event.t
  }
  return spans
}

const duration = recording.durationMs
const knots = playbackKnots(recording.events, duration)
const total = knots.shown.at(-1)
const spans = stepSpans(recording.events)
const stepById = new Map(recording.steps.map((step) => [step.id, step]))

const nodeWidth = ref(NODE_WIDTH)
const layout = computed(() => graphLayout(recording.steps, nodeWidth.value))
const position = ref(total)
const playing = ref(false)
const pinned = ref('')
const scale = ref(1)
const root = ref(null)
const stage = ref(null)
const logBody = ref(null)
let frame = 0
let lastTick = 0
let visibility
let resize

// Recorded time at the playback position; -1 during the lead-in.
const now = computed(() => {
  const p = position.value
  if (p < LEAD_IN_MS) return -1
  if (p >= total) return duration
  const { recorded, shown } = knots
  let i = 0
  while (shown[i + 1] <= p) i++
  return recorded[i] + ((p - shown[i]) / (shown[i + 1] - shown[i])) * (recorded[i + 1] - recorded[i])
})

function statusAt(target, at) {
  let status = 'not_started'
  for (const event of recording.events) {
    if (event.t > at) break
    if (event.target === target) status = event.status
  }
  return status
}

const nodeStatus = computed(() =>
  Object.fromEntries(
    [...recording.steps.map((step) => step.id), ...recording.handlers].map((id) => [
      id,
      statusAt(id, now.value),
    ]),
  ),
)

// The run's own status is polled, so it can trail its first step by a moment.
const runStatus = computed(() => {
  if (now.value < 0) return 'not_started'
  const status = statusAt('$run', now.value)
  return status === 'not_started' ? 'running' : status
})

const edgeState = computed(() =>
  Object.fromEntries(
    layout.value.edges.map((edge) => {
      const child = nodeStatus.value[edge.to]
      const parent = nodeStatus.value[edge.from]
      const faded = child === 'skipped' || parent === 'skipped'
      return [
        edge.key,
        { lit: !faded && child !== 'not_started', faded, status: parent },
      ]
    }),
  ),
)

// Until a step is picked, the log follows the step that changed most
// recently; a finished run shows its failed step, or else its last step.
const selected = computed(() => {
  if (pinned.value) return pinned.value
  if (position.value >= total) {
    const failed = recording.steps.find((step) => recording.results[step.id]?.status === 'failed')
    return (failed ?? recording.steps.at(-1)).id
  }
  const latest = recording.events.findLast(
    (event) => event.t <= now.value && event.target !== '$run' && event.status !== 'not_started',
  )
  return latest?.target ?? recording.steps[0].id
})

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function elapsed(id) {
  const span = spans[id]
  const status = nodeStatus.value[id]
  if (!span || span.start === null || status === 'not_started' || status === 'skipped') return ''
  const end = SETTLED.has(status) ? span.end : now.value
  return formatDuration(Math.max(0, end - span.start))
}

// Lines appear over the step's running time. A retried step's stderr comes
// from an earlier attempt, so it goes first.
function visibleLines(id, status, result) {
  if (status === 'not_started') return []
  const streams = [
    ['stdout', result.stdout],
    ['stderr', result.stderr],
  ]
  if (result.retries > 0) streams.reverse()
  const lines = streams.flatMap(([stream, text]) =>
    text ? text.split('\n').map((line, index) => ({ key: `${id}:${stream}:${index}`, stream, text: line })) : [],
  )
  if (SETTLED.has(status)) return lines
  const span = spans[id]
  const end = span?.end ?? duration
  const progress = (now.value - (span?.start ?? 0)) / Math.max(1, end - (span?.start ?? 0))
  return lines.slice(0, Math.floor(lines.length * Math.min(1, Math.max(0, progress))))
}

function iconFor(id) {
  if (HANDLER_LABELS[id]) return ICONS.handler
  return ICONS[stepById.get(id)?.action] ?? ICONS.action
}

function noteFor(step, status, span) {
  if (!step) return ''
  const person = step.approval ? 'approval' : step.action === 'human.task' ? 'input' : ''
  if (!person) return ''
  if (status === 'waiting') return `Waiting for ${person}`
  if (status === 'succeeded' && span?.waited) return person === 'approval' ? 'Approved' : 'Input submitted'
  return ''
}

const detail = computed(() => {
  const id = selected.value
  const result = recording.results[id] ?? {}
  const step = stepById.get(id)
  const status = nodeStatus.value[id]
  const done = SETTLED.has(status)
  return {
    id,
    label: HANDLER_LABELS[id] ?? id,
    action: step?.action ?? 'run',
    status,
    elapsed: elapsed(id),
    lines: visibleLines(id, status, result),
    note: noteFor(step, status, spans[id]),
    outputs: done ? Object.entries(result.outputs ?? {}) : [],
    subRuns: done ? (result.subRuns ?? []) : [],
  }
})

function badges(step) {
  const result = recording.results[step.id] ?? {}
  const finished = ['succeeded', 'failed', 'partially_succeeded'].includes(nodeStatus.value[step.id])
  return [
    step.approval && 'approval',
    finished && result.retries > 0 && `retried ${result.retries}×`,
    finished && result.executions > 1 && `ran ${result.executions}×`,
    finished && result.subRuns?.length > 1 && `${result.subRuns.length} child runs`,
  ].filter(Boolean)
}

const finished = computed(() => position.value >= total)
const progress = computed(() => `${(position.value / total) * 100}%`)
const clock = computed(() => `${(Math.max(0, now.value) / 1000).toFixed(1)}s / ${(duration / 1000).toFixed(1)}s`)

function tick(time) {
  if (!playing.value) return
  position.value = Math.min(total, position.value + (time - lastTick))
  lastTick = time
  if (position.value >= total) {
    playing.value = false
    return
  }
  frame = requestAnimationFrame(tick)
}

function play() {
  if (position.value >= total) {
    position.value = 0
    pinned.value = ''
  }
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
  position.value = Number(event.target.value)
}

// Keep the newest line in view while the selected step prints.
watch(
  () => detail.value.lines.length,
  async () => {
    if (!playing.value) return
    await nextTick()
    if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight
  },
)

onMounted(() => {
  // Fits the graph to the column: narrower nodes first, then a smaller scale.
  resize = new ResizeObserver(([entry]) => {
    const available = entry.contentRect.width
    const { columns } = layout.value
    const fitted = Math.floor((available - PADDING * 2 - (columns - 1) * COLUMN_GAP) / columns)
    nodeWidth.value = Math.max(MIN_NODE_WIDTH, Math.min(NODE_WIDTH, fitted))
    scale.value = Math.min(1, available / graphLayout(recording.steps, nodeWidth.value).width)
  })
  resize.observe(stage.value)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // Starts from the beginning and plays once, the first time the replay
  // scrolls into view.
  position.value = 0
  visibility = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      visibility.disconnect()
      play()
    },
    { threshold: 0.5 },
  )
  visibility.observe(root.value)
})

onBeforeUnmount(() => {
  visibility?.disconnect()
  resize?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <figure ref="root" class="run-replay" :aria-label="`Recorded run of ${run}`">
    <header class="rr-head">
      <button
        type="button"
        class="rr-play"
        :aria-label="playing ? 'Pause replay' : finished ? 'Replay' : 'Play replay'"
        @click="playing ? pause() : play()"
      >
        <svg v-if="playing" viewBox="0 0 24 24" class="rr-fill"><path :d="PAUSE_ICON" /></svg>
        <svg v-else-if="finished" viewBox="0 0 24 24" class="rr-stroke"><path :d="REPLAY_ICON" /></svg>
        <svg v-else viewBox="0 0 24 24" class="rr-fill"><path :d="PLAY_ICON" /></svg>
      </button>
      <span class="rr-name">{{ recording.dag }}</span>
      <span class="rr-chip" :data-status="runStatus" aria-live="polite">
        <span class="rr-chip-dot" />{{ STATUS_LABELS[runStatus] }}
      </span>
      <span class="rr-clock">{{ clock }}</span>
    </header>

    <div class="rr-track" :style="{ '--progress': progress }">
      <span class="rr-track-thumb" />
      <input
        type="range"
        min="0"
        :max="total"
        step="1"
        :value="position"
        aria-label="Replay position"
        @input="scrub"
      />
    </div>

    <div ref="stage" class="rr-stage">
      <div class="rr-fit" :style="{ height: `${layout.height * scale}px` }">
        <div
          class="rr-canvas"
          :style="{ width: `${layout.width}px`, height: `${layout.height}px`, transform: `translateX(-50%) scale(${scale})` }"
        >
          <svg class="rr-edges" :width="layout.width" :height="layout.height" aria-hidden="true">
            <g v-for="edge in layout.edges" :key="edge.key">
              <path
                class="rr-edge"
                :class="{ routed: edge.routed, faded: edgeState[edge.key].faded }"
                :d="edge.d"
              />
              <path
                class="rr-edge-lit"
                :class="{ on: edgeState[edge.key].lit }"
                :data-status="edgeState[edge.key].status"
                :d="edge.d"
                pathLength="1"
              />
            </g>
          </svg>

          <button
            v-for="node in layout.nodes"
            :key="node.id"
            type="button"
            class="rr-node"
            :class="{ selected: node.id === pinned, compact: layout.nodeWidth < COMPACT_NODE_WIDTH }"
            :data-status="nodeStatus[node.id]"
            :style="{ left: `${node.x}px`, top: `${node.y}px`, width: `${layout.nodeWidth}px`, height: `${NODE_HEIGHT}px` }"
            :title="node.id"
            :aria-label="`${node.id}, ${STATUS_LABELS[nodeStatus[node.id]]}`"
            :aria-pressed="node.id === selected"
            @click="pinned = node.id"
          >
            <span class="rr-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconFor(node.id)" :key="d" :d="d" /></svg>
            </span>
            <span class="rr-text">
              <span class="rr-id">{{ node.id }}</span>
              <span class="rr-action">{{ node.action }}<span v-if="elapsed(node.id)" class="rr-time-inline"> · {{ elapsed(node.id) }}</span></span>
            </span>
            <span class="rr-side">
              <RunStatusIcon :status="nodeStatus[node.id]" />
              <span class="rr-time">{{ elapsed(node.id) }}</span>
            </span>
            <span v-if="badges(node).length" class="rr-badges">
              <span v-for="badge in badges(node)" :key="badge" class="rr-badge">{{ badge }}</span>
            </span>
          </button>

          <svg class="rr-ports" :width="layout.width" :height="layout.height" aria-hidden="true">
            <g v-for="edge in layout.edges" :key="edge.key" :class="{ on: edgeState[edge.key].lit }" :data-status="edgeState[edge.key].status">
              <circle :cx="edge.x1" :cy="edge.y1" r="2.6" />
              <circle :cx="edge.x2" :cy="edge.y2" r="2.6" />
            </g>
          </svg>
        </div>
      </div>

      <div class="rr-stage-foot">
        <div v-if="recording.handlers.length" class="rr-handlers">
          <span class="rr-handlers-label">Handlers</span>
          <button
            v-for="handler in recording.handlers"
            :key="handler"
            type="button"
            class="rr-handler"
            :class="{ selected: handler === pinned }"
            :data-status="nodeStatus[handler]"
            :aria-pressed="handler === selected"
            @click="pinned = handler"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in ICONS.handler" :key="d" :d="d" /></svg>
            {{ HANDLER_LABELS[handler] }}
            <RunStatusIcon :status="nodeStatus[handler]" />
          </button>
        </div>
        <span class="rr-hint">Select a step to see its log</span>
      </div>
    </div>

    <section class="rr-console" aria-live="off">
      <div class="rr-console-head">
        <RunStatusIcon :status="detail.status" />
        <b>{{ detail.label }}</b>
        <span class="rr-console-action">{{ detail.action }}</span>
        <span class="rr-console-meta" :data-status="detail.status">
          {{ STATUS_LABELS[detail.status] }}<template v-if="detail.elapsed"> · {{ detail.elapsed }}</template>
        </span>
      </div>
      <div ref="logBody" class="rr-console-body">
        <TransitionGroup name="rr-line" tag="div" class="rr-lines">
          <div v-for="line in detail.lines" :key="line.key" class="rr-line" :class="line.stream">{{ line.text || ' ' }}</div>
        </TransitionGroup>
        <span v-if="detail.status === 'running'" class="rr-cursor" aria-hidden="true" />
        <p v-if="detail.note" class="rr-note" :data-status="detail.status">
          <RunStatusIcon :status="detail.status === 'waiting' ? 'waiting' : 'succeeded'" />
          {{ detail.note }}
        </p>
        <div v-if="detail.outputs.length" class="rr-section">
          <span class="rr-section-label">Outputs</span>
          <dl class="rr-outputs">
            <template v-for="[name, value] in detail.outputs" :key="name">
              <dt>{{ name }}</dt>
              <dd>{{ value }}</dd>
            </template>
          </dl>
        </div>
        <div v-if="detail.subRuns.length" class="rr-section">
          <span class="rr-section-label">Child runs</span>
          <ul class="rr-subruns">
            <li v-for="sub in detail.subRuns" :key="sub.params">
              <RunStatusIcon :status="detail.status" />
              {{ sub.dag }} <span>{{ sub.params }}</span>
            </li>
          </ul>
        </div>
        <p
          v-if="!detail.lines.length && !detail.note && !detail.outputs.length && !detail.subRuns.length && detail.status !== 'running'"
          class="rr-empty"
        >
          {{ detail.status === 'not_started' ? 'Not started yet' : 'No output' }}
        </p>
      </div>
    </section>
  </figure>
</template>

<style scoped>
.run-replay {
  --rr-success: #178a44;
  --rr-error: #c8382f;
  --rr-running: #5d4fe0;
  --rr-neutral: #8a8a93;
  --rr-warning: #a1640c;
  --rr-aborted: #9333ea;
  --rr-glyph: #fff;
  --rr-stage: #f3f1ea;
  --rr-dot: #d8d3c5;
  --rr-node: #fffefb;
  --rr-line: #dcd7ca;
  --rr-edge: #bfb9aa;
  --rr-shadow: 0 1px 2px rgb(20 22 27 / 6%), 0 6px 14px -8px rgb(20 22 27 / 18%);
  margin: 1.25rem 0 1.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.dark .run-replay {
  --rr-success: #22c55e;
  --rr-error: #ef5350;
  --rr-running: #a89ff8;
  --rr-neutral: #7d808b;
  --rr-warning: #d9a03c;
  --rr-aborted: #c084fc;
  --rr-glyph: #0b0d12;
  --rr-stage: #0c0e13;
  --rr-dot: #1d2029;
  --rr-node: #14171f;
  --rr-line: #262a35;
  --rr-edge: #383d4a;
  --rr-shadow: 0 1px 0 rgb(255 255 255 / 3%) inset, 0 8px 18px -10px rgb(0 0 0 / 70%);
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

/* Header */

.rr-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem 0.55rem 0.6rem;
}

.rr-play {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}

.rr-play:hover {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent);
  transform: scale(1.05);
}

.rr-play:active {
  transform: scale(0.95);
}

.rr-play svg {
  width: 14px;
  height: 14px;
}

.rr-play .rr-fill {
  fill: currentColor;
}

.rr-play .rr-stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rr-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--vp-c-text-1);
  font: 600 0.78rem/1 var(--vp-font-family-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rr-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
  padding: 0.22rem 0.6rem 0.22rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--rr-status) 13%, transparent);
  color: var(--rr-status);
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.rr-chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.rr-chip[data-status='running'] .rr-chip-dot,
.rr-chip[data-status='waiting'] .rr-chip-dot,
.rr-chip[data-status='queued'] .rr-chip-dot {
  animation: rr-ping 1.4s ease-out infinite;
}

.rr-clock {
  flex: none;
  color: var(--vp-c-text-3);
  font: 0.72rem/1 var(--vp-font-family-mono);
  font-variant-numeric: tabular-nums;
}

/* Progress track */

.rr-track {
  position: relative;
  height: 3px;
  background: var(--vp-c-divider);
}

.rr-track::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--progress);
  background: var(--vp-c-brand-1);
  content: '';
}

.rr-track-thumb {
  position: absolute;
  top: 50%;
  left: var(--progress);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-brand-1) 25%, transparent);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s ease;
  pointer-events: none;
}

.rr-track:hover .rr-track-thumb,
.rr-track:focus-within .rr-track-thumb {
  transform: translate(-50%, -50%) scale(1);
}

.rr-track input {
  position: absolute;
  inset: -7px 0;
  width: 100%;
  height: 17px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

/* Graph */

.rr-stage {
  padding: 1rem 0.75rem 0.6rem;
  background-color: var(--rr-stage);
  background-image: radial-gradient(var(--rr-dot) 1px, transparent 1.3px);
  background-size: 16px 16px;
  background-position: 8px 8px;
}

.rr-fit {
  position: relative;
}

.rr-canvas {
  position: absolute;
  top: 0;
  left: 50%;
  transform-origin: top center;
}

.rr-edges,
.rr-ports {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.rr-ports {
  z-index: 2;
}

.rr-edge,
.rr-edge-lit {
  fill: none;
  stroke-width: 1.6;
}

.rr-edge {
  stroke: var(--rr-edge);
  transition: opacity 0.3s ease;
}

.rr-edge.routed {
  stroke-dasharray: 4 4;
}

.rr-edge.faded {
  opacity: 0.35;
}

.rr-edge-lit {
  stroke: var(--rr-status);
  stroke-width: 2;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  transition: stroke-dashoffset 0.55s cubic-bezier(0.3, 0.7, 0.4, 1), opacity 0.15s ease;
}

.rr-edge-lit.on {
  stroke-dashoffset: 0;
  opacity: 1;
}

.rr-ports circle {
  fill: var(--rr-node);
  stroke: var(--rr-edge);
  stroke-width: 1.4;
  transition: stroke 0.3s ease, fill 0.3s ease;
}

.rr-ports .on circle {
  fill: var(--rr-status);
  stroke: var(--rr-status);
}

.rr-node {
  position: absolute;
  z-index: 1;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.7rem 0 0.6rem;
  border: 1px solid var(--rr-border, var(--rr-line));
  border-radius: 11px;
  background: var(--rr-node);
  box-shadow: var(--rr-shadow);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.3s ease,
    background-color 0.3s ease,
    box-shadow 0.3s ease,
    opacity 0.3s ease,
    transform 0.15s ease,
    outline-offset 0.15s ease;
  outline: 2px solid transparent;
  outline-offset: 5px;
}

.rr-node:hover {
  transform: translateY(-1px);
}

.rr-node.compact {
  grid-template-columns: minmax(0, 1fr) auto;
  padding-left: 0.75rem;
}

.rr-node.compact .rr-icon,
.rr-node.compact .rr-time {
  display: none;
}

.rr-node.compact .rr-side {
  align-self: start;
  min-width: 0;
  margin-top: 0.55rem;
}

.rr-node.compact .rr-id {
  font-size: 0.74rem;
}

.rr-time-inline {
  display: none;
}

.rr-node.compact .rr-time-inline {
  display: inline;
}

.rr-node:focus-visible,
.rr-node.selected {
  outline-color: var(--vp-c-brand-1);
  outline-offset: 3px;
}

.rr-node[data-status='running'],
.rr-node[data-status='retrying'] {
  --rr-border: color-mix(in srgb, var(--rr-running) 70%, var(--rr-line));
  animation: rr-breathe 1.6s ease-in-out infinite;
}

.rr-node[data-status='waiting'],
.rr-node[data-status='queued'] {
  --rr-border: color-mix(in srgb, var(--rr-warning) 70%, var(--rr-line));
  animation: rr-breathe 1.6s ease-in-out infinite;
}

.rr-node[data-status='succeeded'] {
  --rr-border: color-mix(in srgb, var(--rr-success) 45%, var(--rr-line));
}

.rr-node[data-status='failed'],
.rr-node[data-status='rejected'] {
  --rr-border: color-mix(in srgb, var(--rr-error) 70%, var(--rr-line));
  background: color-mix(in srgb, var(--rr-error) 6%, var(--rr-node));
}

.rr-node[data-status='aborted'] {
  --rr-border: color-mix(in srgb, var(--rr-aborted) 60%, var(--rr-line));
}

.rr-node[data-status='skipped'] {
  border-style: dashed;
  box-shadow: none;
  opacity: 0.55;
}

.rr-node[data-status='not_started'] .rr-text,
.rr-node[data-status='not_started'] .rr-icon {
  opacity: 0.7;
}

.rr-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--vp-c-text-1) 6%, transparent);
  color: var(--vp-c-text-2);
  transition: background-color 0.3s ease, color 0.3s ease, opacity 0.3s ease;
}

.rr-node[data-status='running'] .rr-icon,
.rr-node[data-status='retrying'] .rr-icon,
.rr-node[data-status='waiting'] .rr-icon {
  background: color-mix(in srgb, var(--rr-status) 14%, transparent);
  color: var(--rr-status);
}

.rr-icon svg,
.rr-handler svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rr-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  transition: opacity 0.3s ease;
}

.rr-id,
.rr-action {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rr-id {
  color: var(--vp-c-text-1);
  font: 600 0.8rem/1.2 var(--vp-font-family-mono);
}

.rr-action {
  color: var(--vp-c-text-3);
  font: 0.68rem/1.2 var(--vp-font-family-mono);
}

.rr-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
  min-width: 2.6rem;
}

.rr-time {
  min-height: 0.8rem;
  color: var(--vp-c-text-3);
  font: 0.66rem/1.2 var(--vp-font-family-mono);
  font-variant-numeric: tabular-nums;
}

.rr-badges {
  position: absolute;
  top: -9px;
  right: 10px;
  display: flex;
  gap: 4px;
}

.rr-badge {
  padding: 0 0.45rem;
  border: 1px solid var(--rr-line);
  border-radius: 999px;
  background: var(--rr-node);
  color: var(--vp-c-text-2);
  font-size: 0.64rem;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  animation: rr-rise 0.3s ease-out;
}

.rr-stage-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.rr-handlers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.rr-handlers-label,
.rr-hint {
  color: var(--vp-c-text-3);
  font-size: 0.7rem;
}

.rr-hint {
  margin-left: auto;
}

.rr-handler {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.45rem 0.25rem 0.55rem;
  border: 1px solid var(--rr-border, var(--rr-line));
  border-radius: 999px;
  background: var(--rr-node);
  color: var(--vp-c-text-2);
  font: 0.7rem/1.2 var(--vp-font-family-mono);
  transition: border-color 0.3s ease, opacity 0.3s ease;
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.rr-handler svg {
  width: 13px;
  height: 13px;
}

.rr-handler[data-status='not_started'] {
  opacity: 0.6;
}

.rr-handler[data-status='running'] {
  --rr-border: color-mix(in srgb, var(--rr-running) 70%, var(--rr-line));
}

.rr-handler[data-status='succeeded'] {
  --rr-border: color-mix(in srgb, var(--rr-success) 45%, var(--rr-line));
}

.rr-handler.selected,
.rr-handler:focus-visible {
  outline-color: var(--vp-c-brand-1);
}

/* Console */

.rr-console {
  --rr-success: #22c55e;
  --rr-error: #ef5350;
  --rr-running: #a89ff8;
  --rr-neutral: #7d808b;
  --rr-warning: #d9a03c;
  --rr-aborted: #c084fc;
  --rr-glyph: #0b0d12;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--kiln-code-bg);
  color: var(--kiln-code-text);
}

.rr-console-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgb(255 255 255 / 7%);
  font: 0.75rem/1.2 var(--vp-font-family-mono);
}

.rr-console-head b {
  font-weight: 600;
}

.rr-console-action {
  color: #7d808b;
}

.rr-console-meta {
  margin-left: auto;
  color: var(--rr-status);
  white-space: nowrap;
}

.rr-console-body {
  min-height: 7.5rem;
  max-height: 14rem;
  padding: 0.65rem 0.9rem 0.85rem;
  overflow-y: auto;
  font: 0.75rem/1.6 var(--vp-font-family-mono);
  scrollbar-color: rgb(255 255 255 / 15%) transparent;
}

.rr-line {
  white-space: pre-wrap;
  word-break: break-word;
}

.rr-line.stderr {
  color: #f08a80;
}

.rr-line-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.rr-line-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.rr-line-leave-active {
  display: none;
}

.rr-cursor {
  display: inline-block;
  width: 7px;
  height: 0.95rem;
  margin-top: 0.15rem;
  background: var(--kiln-code-text);
  vertical-align: text-bottom;
  animation: rr-blink 1s steps(1) infinite;
}

.rr-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0 0;
  color: var(--rr-status);
}

.rr-section {
  margin-top: 0.75rem;
}

.rr-section-label {
  display: block;
  margin-bottom: 0.25rem;
  color: #6d707b;
  font-size: 0.64rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rr-outputs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.15rem 0.9rem;
  margin: 0;
}

.rr-outputs dt {
  color: var(--kiln-code-amber);
}

.rr-outputs dd {
  margin: 0;
  word-break: break-word;
}

.rr-subruns {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rr-subruns li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rr-subruns .status-icon {
  width: 12px;
  height: 12px;
}

.rr-subruns span {
  color: #7d808b;
}

.rr-empty {
  margin: 0;
  color: #6d707b;
}

@keyframes rr-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--rr-status) 0%, transparent), var(--rr-shadow);
  }
  50% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--rr-status) 16%, transparent), var(--rr-shadow);
  }
}

@keyframes rr-ping {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent);
  }
  100% {
    box-shadow: 0 0 0 6px color-mix(in srgb, currentColor 0%, transparent);
  }
}

@keyframes rr-rise {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

@keyframes rr-blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .run-replay *,
  .run-replay *::before {
    animation: none !important;
    transition: none !important;
  }
}
</style>
