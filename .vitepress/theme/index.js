import DefaultTheme from 'vitepress/theme'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import './style.css'

// Detect user's OS and select appropriate tab in code groups
function selectOSTab() {
  const isWindows = navigator.platform.indexOf('Win') > -1 ||
                    navigator.userAgent.indexOf('Windows') > -1

  if (!isWindows) return

  // Find all code group tab containers
  document.querySelectorAll('.vp-code-group').forEach(group => {
    const labels = group.querySelectorAll('.tabs label')

    labels.forEach(label => {
      if (label.textContent.trim().toLowerCase() === 'windows') {
        // Click the label to properly trigger VitePress tab switching
        label.click()
      }
    })
  })
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register custom components here if needed
  },
  setup() {
    const route = useRoute()
    onMounted(() => {
      selectOSTab()
    })

    // Re-run when navigating to a new page
    watch(() => route.path, () => {
      nextTick(() => {
        selectOSTab()
      })
    })
  }
}