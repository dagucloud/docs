<script setup>
// Status mark for the run replay: a ring before a step starts, a spinner
// while it runs, and a filled badge once it settles.
defineProps({
  status: { type: String, required: true },
})

const GLYPHS = {
  succeeded: 'M4.8 8.4 7 10.6l4.2-4.8',
  partially_succeeded: 'M4.8 8.4 7 10.6l4.2-4.8',
  failed: 'M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8',
  rejected: 'M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8',
  aborted: 'M6 6h4v4H6z',
  skipped: 'M5 8h6',
  waiting: 'M6.6 5.6v4.8M9.4 5.6v4.8',
  queued: 'M8 5v3.2l2 1.3',
}
</script>

<template>
  <svg :key="status" class="status-icon" :data-status="status" viewBox="0 0 16 16" aria-hidden="true">
    <template v-if="status === 'running' || status === 'retrying'">
      <circle class="track" cx="8" cy="8" r="6.2" />
      <path class="arc" d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" />
    </template>
    <circle v-else-if="status === 'not_started'" class="ring" cx="8" cy="8" r="6.2" />
    <template v-else>
      <circle class="disc" cx="8" cy="8" :r="status === 'skipped' ? 6.4 : 8" />
      <path class="glyph" :d="GLYPHS[status]" />
    </template>
  </svg>
</template>

<style scoped>
.status-icon {
  flex: none;
  width: 16px;
  height: 16px;
  overflow: visible;
  color: var(--rr-neutral);
}

.status-icon[data-status='succeeded'] { color: var(--rr-success); }
.status-icon[data-status='failed'],
.status-icon[data-status='rejected'] { color: var(--rr-error); }
.status-icon[data-status='running'],
.status-icon[data-status='retrying'] { color: var(--rr-running); }
.status-icon[data-status='waiting'],
.status-icon[data-status='queued'],
.status-icon[data-status='partially_succeeded'] { color: var(--rr-warning); }
.status-icon[data-status='aborted'] { color: var(--rr-aborted); }

.ring,
.track,
.arc,
.glyph {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ring {
  stroke: currentColor;
  stroke-width: 1.5;
  opacity: 0.55;
}

.track {
  stroke: currentColor;
  stroke-width: 2;
  opacity: 0.2;
}

.arc {
  stroke: currentColor;
  stroke-width: 2;
  transform-origin: 8px 8px;
  animation: spin 0.9s linear infinite;
}

.disc {
  fill: currentColor;
}

.status-icon[data-status='skipped'] .disc {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-dasharray: 2.4 2.1;
}

.glyph {
  stroke: var(--rr-glyph, #fff);
  stroke-width: 1.8;
}

.status-icon[data-status='skipped'] .glyph {
  stroke: currentColor;
}

.status-icon[data-status='aborted'] .glyph {
  fill: var(--rr-glyph, #fff);
  stroke-width: 0;
}

.status-icon:not([data-status='not_started']):not([data-status='running']):not([data-status='retrying']) {
  animation: pop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .status-icon,
  .arc {
    animation: none !important;
  }
}
</style>
