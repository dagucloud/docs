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

function capture(event, properties) {
  window.posthog?.capture?.(event, {
    surface: 'docs',
    ...properties,
  })
}

function selectedCodeGroupTab(group) {
  const selected = group.querySelector('.tabs input:checked')
  if (!selected) return undefined

  return [...group.querySelectorAll('.tabs label')]
    .find(label => label.htmlFor === selected.id)
    ?.textContent
    ?.trim()
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

      capture('github_star_cta_clicked', {
        location: starCtaLocation(anchor, route),
      })
    }

    const trackOverviewInstallClick = (event) => {
      if (!event.isTrusted || route.path !== '/' || !(event.target instanceof Element)) return

      const tab = event.target.closest('.vp-code-group .tabs label')
      const platform = tab?.textContent?.trim()
      if (platform === 'Windows' || platform === 'macOS/Linux') {
        capture('overview_install_platform_selected', {
          page: 'overview',
          platform,
        })
        return
      }

      const copyButton = event.target.closest('.vp-code-group button.copy')
      const group = copyButton?.closest('.vp-code-group')
      const selectedPlatform = group && selectedCodeGroupTab(group)
      if (selectedPlatform !== 'Windows' && selectedPlatform !== 'macOS/Linux') return

      capture('overview_install_command_copied', {
        page: 'overview',
        platform: selectedPlatform,
      })
    }

    const trackBasicExampleClick = (event) => {
      if (!event.isTrusted || route.path !== '/writing-workflows/examples/basic' || !(event.target instanceof Element)) return

      const recipe = event.target.closest('[data-basic-recipe]')
      if (!recipe) return

      if (event.target.closest('button.copy')) {
        capture('basic_example_yaml_copied', {
          page: 'basic_examples',
          recipe: recipe.dataset.basicRecipe,
        })
        return
      }

      if (event.target.closest('[data-basic-learn-more]')) {
        capture('basic_example_learn_more_clicked', {
          page: 'basic_examples',
          recipe: recipe.dataset.basicRecipe,
        })
      }
    }

    onMounted(() => {
      selectOSTab()
      document.addEventListener('click', trackGitHubStarClick)
      document.addEventListener('click', trackOverviewInstallClick)
      document.addEventListener('click', trackBasicExampleClick)
    })

    onUnmounted(() => {
      document.removeEventListener('click', trackGitHubStarClick)
      document.removeEventListener('click', trackOverviewInstallClick)
      document.removeEventListener('click', trackBasicExampleClick)
    })

    // Re-run when navigating to a new page
    watch(() => route.path, () => {
      nextTick(() => {
        selectOSTab()
      })
    })
  }
}
