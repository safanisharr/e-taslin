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
      <div class="header-row">
        <h1>📋 Log Pelanggaran</h1>
        <button class="btn-primary" @click="showModal = true">+ Input Pelanggaran</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>Pelanggaran</th>
              <th>Poin Dikurangi</th>
              <th>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, i) in logList" :key="log.id_log">
              <td>{{ i + 1 }}</td>
              <td>{{ log.nama_siswa }}</td>
              <td>{{ log.kelas }}</td>
              <td>{{ log.nama_pelanggaran }}</td>
              <td><span class="poin-minus">-{{ log.poin_dikurangi }}</span></td>
              <td>{{ formatTanggal(log.tanggal) }}</td>
            </tr>
            <tr v-if="logList.length === 0">
              <td colspan="6" style="text-align:center;color:#aaa">Belum ada log pelanggaran</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal Input Pelanggaran -->
      <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
        <div class="modal">
          <h2>Input Pelanggaran Siswa</h2>
          <div class="form-group">
            <label>Pilih Siswa</label>
            <select v-model="form.siswa_id">
              <option value="" disabled>-- Pilih Siswa --</option>
              <option v-for="s in siswaList" :key="s.id_siswa" :value="s.id_siswa">
                {{ s.nama_siswa }} ({{ s.kelas }}) — Poin: {{ s.total_poin }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Jenis Pelanggaran</label>
            <select v-model="form.nama_pelanggaran">
              <option value="" disabled>-- Pilih Pelanggaran --</option>
              <option value="Terlambat masuk sekolah">Terlambat masuk sekolah (-10)</option>
              <option value="Atribut seragam tidak lengkap">Atribut seragam tidak lengkap (-5)</option>
              <option value="Tidak mengerjakan tugas">Tidak mengerjakan tugas (-15)</option>
              <option value="Membawa HP saat pelajaran">Membawa HP saat pelajaran (-20)</option>
              <option value="Membolos">Membolos (-25)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Bobot Pengurangan Poin</label>
            <input v-model.number="form.poin_dikurangi" type="number" min="1" placeholder="Contoh: 10" />
          </div>
          <p v-if="formError" class="error">{{ formError }}</p>
          <p v-if="successMsg" class="success">{{ successMsg }}</p>
          <div class="modal-actions">
            <button class="btn-secondary" @click="tutupModal">Batal</button>
            <button class="btn-primary" @click="inputPelanggaran">Simpan</button>
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

const logList = ref([])
const siswaList = ref([])
const showModal = ref(false)
const formError = ref('')
const successMsg = ref('')

const form = ref({ siswa_id: '', nama_pelanggaran: '', poin_dikurangi: '' })
const headers = { Authorization: `Bearer ${authStore.token}` }

onMounted(async () => {
  await fetchLog()
  await fetchSiswa()
})

async function fetchLog() {
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/pelanggaran`, { headers })
  logList.value = res.data
}

async function fetchSiswa() {
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/siswa`, { headers })
  siswaList.value = res.data
}

async function inputPelanggaran() {
  formError.value = ''
  successMsg.value = ''

  if (!form.value.siswa_id || !form.value.nama_pelanggaran || !form.value.poin_dikurangi) {
    formError.value = 'Kolom wajib diisi'
    return
  }

  if (form.value.poin_dikurangi <= 0) {
    formError.value = 'Bobot poin harus lebih dari 0'
    return
  }

  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/pelanggaran`, {
      siswa_id: form.value.siswa_id,
      nama_pelanggaran: form.value.nama_pelanggaran,
      poin_dikurangi: form.value.poin_dikurangi
    }, { headers })

    successMsg.value = `Berhasil! Sisa poin: ${res.data.poin_sekarang} | Status: ${res.data.status}`
    await fetchLog()
    await fetchSiswa()
    form.value = { siswa_id: '', nama_pelanggaran: '', poin_dikurangi: '' }
  } catch (err) {
    formError.value = err.response?.data?.message || 'Gagal menyimpan pelanggaran'
  }
}

function tutupModal() {
  showModal.value = false
  formError.value = ''
  successMsg.value = ''
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
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
h1 { color: #1e3a5f; }
.table-wrapper { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
table { width: 100%; border-collapse: collapse; }
thead { background: #1e3a5f; color: white; }
th, td { padding: 0.9rem 1rem; text-align: left; font-size: 0.9rem; }
tbody tr:nth-child(even) { background: #f8f9fa; }
tbody tr:hover { background: #e8f4f8; }
.poin-minus { color: #e53e3e; font-weight: 700; }
.btn-primary { background: #1e3a5f; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-primary:hover { background: #2d6a4f; }
.btn-secondary { background: #eee; color: #333; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: white; padding: 2rem; border-radius: 12px; width: 460px; }
.modal h2 { margin-bottom: 1.5rem; color: #1e3a5f; }
.form-group { margin-bottom: 1rem; }
label { display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem; }
input, select { width: 100%; padding: 0.6rem 0.9rem; border: 1.5px solid #ddd; border-radius: 8px; font-size: 0.95rem; }
.modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
.error { color: #e53e3e; font-size: 0.85rem; }
.success { color: #276749; font-size: 0.85rem; background: #c6f6d5; padding: 0.5rem 0.8rem; border-radius: 6px; }
</style>