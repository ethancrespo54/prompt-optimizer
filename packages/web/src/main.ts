/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createApp, watch } from 'vue'
import { installI18nOnly, installPinia, i18n, router } from '@prompt-optimizer/ui'
import '@prompt-optimizer/ui/dist/style.css'
import App from './App.vue'

const app = createApp(App)
// Only install the i18n plugin; the language initialization happens in App.vue after the services are ready
installI18nOnly(app)
installPinia(app)

// Step 1: install the router plugin
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
void router.isReady().then(() => {
  app.mount('#app')
})

// Only load Analytics in the Vercel environment
// Only try to load it when the environment variable VITE_VERCEL_DEPLOYMENT is true
if (import.meta.env.VITE_VERCEL_DEPLOYMENT === 'true') {
  // Load Vercel Analytics fully at runtime
  const loadAnalytics = () => {
    const script = document.createElement('script')
    script.src = '/_vercel/insights/script.js'
    script.defer = true
    script.onload = () => console.log('Vercel Analytics loaded')
    script.onerror = () => console.log('Vercel Analytics failed to load')
    document.head.appendChild(script)
  }
  
  // Delay execution to make sure the DOM is fully loaded
  window.addEventListener('DOMContentLoaded', loadAnalytics)
}else{
    console.log('Vercel Analytics not loaded')
}
