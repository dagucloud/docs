import DefaultTheme from 'vitepress/theme'
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
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

function starCtaLocation(anchor, route) {
  if (anchor.closest('.VPNav')) return 'navigation'
  if (route.path.includes('/getting-started/quickstart')) return 'quickstart'
  return 'content'
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register custom components here if needed
  },
  setup() {
    const route = useRoute()
    const trackGitHubStarClick = (event) => {
      if (!(event.target instanceof Element)) return

      const anchor = event.target.closest('a')
      if (!anchor || !anchor.textContent?.includes('Star Dagu')) return

      window.posthog?.capture?.('github_star_cta_clicked', {
        surface: 'docs',
        location: starCtaLocation(anchor, route),
      })
    }

    onMounted(() => {
      selectOSTab()
      document.addEventListener('click', trackGitHubStarClick)
    })

    onUnmounted(() => {
      document.removeEventListener('click', trackGitHubStarClick)
    })

    // Re-run when navigating to a new page
    watch(() => route.path, () => {
      nextTick(() => {
        selectOSTab()
      })
    })
  }
}
