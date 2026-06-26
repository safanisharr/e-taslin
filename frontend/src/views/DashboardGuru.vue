<template>
  <div class="layout">
    <aside class="sidebar">
      <h2>🏫 E-Sikap</h2>
      <nav>
        <router-link to="/dashboard-guru">📊 Dashboard</router-link>
        <router-link to="/data-siswa">👨‍🎓 Data Siswa</router-link>
        <router-link to="/log-pelanggaran">📋 Log Pelanggaran</router-link>
      </nav>
      <button class="logout-btn" @click="handleLogout">🚪 Logout</button>
    </aside>

    <main class="content">
      <h1>Dashboard Guru</h1>
      <p class="welcome">Selamat datang, <strong>{{ authStore.user?.username }}</strong></p>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">👨‍🎓</span>
          <div>
            <p class="stat-label">Total Siswa</p>
            <p class="stat-value">{{ stats.totalSiswa }}</p>
          </div>
        </div>
        <div class="stat-card warning">
          <span class="stat-icon">⚠️</span>
          <div>
            <p class="stat-label">Status Peringatan</p>
            <p class="stat-value">{{ stats.peringatan }}</p>
          </div>
        </div>
        <div class="stat-card danger">
          <span class="stat-icon">🚨</span>
          <div>
            <p class="stat-label">Status Skorsing</p>
            <p class="stat-value">{{ stats.skorsing }}</p>
          </div>
        </div>
        <div class="stat-card success">
          <span class="stat-icon">✅</span>
          <div>
            <p class="stat-label">Status Aman</p>
            <p class="stat-value">{{ stats.aman }}</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const stats = ref({ totalSiswa: 0, peringatan: 0, skorsing: 0, aman: 0 })

onMounted(async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/siswa`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = res.data
    stats.value.totalSiswa = data.length
    stats.value.peringatan = data.filter(s => s.status === 'Peringatan').length
    stats.value.skorsing = data.filter(s => s.status === 'Skorsing').length
    stats.value.aman = data.filter(s => s.status === 'Aman').length
  } catch (err) {
    console.error(err)
  }
})

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 240px;
  background: #1e3a5f;
  color: white;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.sidebar h2 { font-size: 1.3rem; margin-bottom: 1.5rem; text-align: center; }
.sidebar nav { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.sidebar nav a {
  color: rgba(255,255,255,0.8);
  text-decoration: none;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: background 0.2s;
}
.sidebar nav a:hover, .sidebar nav a.router-link-active {
  background: rgba(255,255,255,0.15);
  color: white;
}
.logout-btn {
  background: rgba(255,255,255,0.1);
  color: white;
  border: none;
  padding: 0.6rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}
.logout-btn:hover { background: #e53e3e; }
.content { flex: 1; padding: 2rem; }
h1 { color: #1e3a5f; margin-bottom: 0.3rem; }
.welcome { color: #666; margin-bottom: 2rem; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.2rem; }
.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-left: 4px solid #1e3a5f;
}
.stat-card.warning { border-color: #f6ad55; }
.stat-card.danger { border-color: #e53e3e; }
.stat-card.success { border-color: #38a169; }
.stat-icon { font-size: 2rem; }
.stat-label { color: #888; font-size: 0.85rem; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: #1e3a5f; }
</style>