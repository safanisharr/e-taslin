<template>
  <div class="layout">
    <aside class="sidebar">
      <h2>🏫 E-Sikap</h2>
      <nav>
        <router-link to="/dashboard-siswa">📊 Dashboard Saya</router-link>
      </nav>
      <button class="logout-btn" @click="handleLogout">🚪 Logout</button>
    </aside>

    <main class="content">
      <h1>Dashboard Siswa</h1>
      <p class="welcome">Selamat datang, <strong>{{ authStore.user?.username }}</strong></p>

      <div v-if="profil" class="profil-card">
        <div class="profil-info">
          <h2>{{ profil.nama_siswa }}</h2>
          <p>Kelas: <strong>{{ profil.kelas }}</strong></p>
        </div>
        <div class="poin-display">
          <p class="poin-label">Sisa Poin</p>
          <p class="poin-value" :style="{ color: poinColor }">{{ profil.total_poin }}</p>
          <span :class="['badge', badgeClass(profil.status)]">{{ profil.status }}</span>
        </div>
      </div>

      <div class="poin-bar-wrapper">
        <div class="poin-bar">
          <div class="poin-fill" :style="{ width: poinPercent + '%', background: poinColor }"></div>
        </div>
        <p class="poin-bar-label">{{ profil?.total_poin || 0 }} / 100 Poin</p>
      </div>

      <h2 class="section-title">📋 Riwayat Pelanggaran Saya</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Pelanggaran</th>
              <th>Poin Dikurangi</th>
              <th>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, i) in logList" :key="log.id_log">
              <td>{{ i + 1 }}</td>
              <td>{{ log.nama_pelanggaran }}</td>
              <td><span class="poin-minus">-{{ log.poin_dikurangi }}</span></td>
              <td>{{ formatTanggal(log.tanggal) }}</td>
            </tr>
            <tr v-if="logList.length === 0">
              <td colspan="4" style="text-align:center;color:#aaa">Belum ada pelanggaran tercatat 🎉</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const profil = ref(null)
const logList = ref([])
const headers = { Authorization: `Bearer ${authStore.token}` }

onMounted(async () => {
  const [profilRes, logRes] = await Promise.all([
    axios.get(`${import.meta.env.VITE_API_URL}/api/siswa/profil`, { headers }),
    axios.get(`${import.meta.env.VITE_API_URL}/api/pelanggaran/saya`, { headers })
  ])
  profil.value = profilRes.data
  logList.value = logRes.data
})

const poinPercent = computed(() => profil.value ? profil.value.total_poin : 100)

const poinColor = computed(() => {
  const p = profil.value?.total_poin ?? 100
  if (p === 0) return '#e53e3e'
  if (p < 50) return '#f6ad55'
  return '#38a169'
})

function badgeClass(status) {
  if (status === 'Peringatan') return 'badge-warning'
  if (status === 'Skorsing') return 'badge-danger'
  return 'badge-success'
}

function formatTanggal(ts) {
  return new Date(ts).toLocaleString('id-ID')
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 240px; background: #1e3a5f; color: white; padding: 1.5rem 1rem; display: flex; flex-direction: column; }
.sidebar h2 { font-size: 1.3rem; margin-bottom: 1.5rem; text-align: center; }
.sidebar nav { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.sidebar nav a { color: rgba(255,255,255,0.8); text-decoration: none; padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.95rem; }
.sidebar nav a:hover, .sidebar nav a.router-link-active { background: rgba(255,255,255,0.15); color: white; }
.logout-btn { background: rgba(255,255,255,0.1); color: white; border: none; padding: 0.6rem; border-radius: 8px; cursor: pointer; }
.logout-btn:hover { background: #e53e3e; }
.content { flex: 1; padding: 2rem; }
h1 { color: #1e3a5f; }
.welcome { color: #666; margin-bottom: 1.5rem; }
.profil-card {
  background: white; padding: 1.5rem 2rem; border-radius: 12px;
  display: flex; justify-content: space-between; align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1.2rem;
}
.profil-info h2 { color: #1e3a5f; }
.profil-info p { color: #666; margin-top: 0.3rem; }
.poin-display { text-align: center; }
.poin-label { color: #888; font-size: 0.85rem; }
.poin-value { font-size: 3rem; font-weight: 800; line-height: 1; }
.badge { padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
.badge-success { background: #c6f6d5; color: #276749; }
.badge-warning { background: #fefcbf; color: #744210; }
.badge-danger { background: #fed7d7; color: #9b2c2c; }
.poin-bar-wrapper { margin-bottom: 2rem; }
.poin-bar { height: 12px; background: #eee; border-radius: 99px; overflow: hidden; margin-bottom: 0.4rem; }
.poin-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease; }
.poin-bar-label { color: #888; font-size: 0.85rem; }
.section-title { color: #1e3a5f; margin-bottom: 1rem; }
.table-wrapper { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
table { width: 100%; border-collapse: collapse; }
thead { background: #1e3a5f; color: white; }
th, td { padding: 0.9rem 1rem; text-align: left; font-size: 0.9rem; }
tbody tr:nth-child(even) { background: #f8f9fa; }
.poin-minus { color: #e53e3e; font-weight: 700; }
</style>