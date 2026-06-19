import type { App as VueApp } from 'vue'
import type { Router } from 'vue-router'
import { createApp } from 'vue'
import App from './App.vue'
import { createDashboardRouter } from './router'
import './styles.css'

export type UserModule = (ctx: { app: VueApp, router: Router }) => void

const app = createApp(App)
const router = createDashboardRouter()

Object.values(import.meta.glob<{ install: UserModule }>(['./modules/*.ts', '!./modules/*.test.ts', '!./modules/*.unit.test.ts'], { eager: true }))
  .forEach(module => module.install?.({ app, router }))

app.use(router)

router.isReady().then(() => {
  app.mount('#app')
})
