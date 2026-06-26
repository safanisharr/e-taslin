import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import LoginView from '../views/LoginView.vue'
import DashboardGuru from '../views/DashboardGuru.vue'
import DashboardSiswa from '../views/DashboardSiswa.vue'
import DataSiswa from '../views/DataSiswa.vue'
import LogPelanggaran from '../views/LogPelanggaran.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  {
    path: '/dashboard-guru',
    component: DashboardGuru,
    meta: { requiresAuth: true, role: 'guru' }
  },
  {
    path: '/dashboard-siswa',
    component: DashboardSiswa,
    meta: { requiresAuth: true, role: 'siswa' }
  },
  {
    path: '/data-siswa',
    component: DataSiswa,
    meta: { requiresAuth: true, role: 'guru' }
  },
  {
    path: '/log-pelanggaran',
    component: LogPelanggaran,
    meta: { requiresAuth: true, role: 'guru' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next('/login')
  }

  if (to.meta.role && to.meta.role !== authStore.role) {
    if (authStore.role === 'guru') return next('/dashboard-guru')
    if (authStore.role === 'siswa') return next('/dashboard-siswa')
    return next('/login')
  }

  next()
})

export default router