import { createApp, watch } from 'vue'
import { installI18nOnly, installPinia, i18n, router } from '@prompt-optimizer/ui'
import App from './App.vue'

import './style.css'
import '@prompt-optimizer/ui/dist/style.css'

const app = createApp(App)
// Only install the i18n plugin; the language initialization happens in App.vue after the services are ready
installI18nOnly(app)
installPinia(app)
app.use(router)

// Sync the document title and language attribute
if (typeof document !== 'undefined') {
  const syncDocumentTitle = () => {
    document.title = i18n.global.t('common.appName')
    const currentLocale = String(i18n.global.locale.value || '')
    const htmlLang = currentLocale.startsWith('zh') ? 'zh' : 'en'
    document.documentElement.setAttribute('lang', htmlLang)
  }

  syncDocumentTitle()
  watch(i18n.global.locale, syncDocumentTitle)
}

// Wait for the router to finish its first navigation resolution (Hash URL -> route), avoiding initialization logic wrongly redirecting while briefly at "/"
// ⚠️ The Extension environment can also enter a workspace route directly through the hash (for example E2E/development debugging)
void router.isReady().then(() => {
  app.mount('#app')
})
