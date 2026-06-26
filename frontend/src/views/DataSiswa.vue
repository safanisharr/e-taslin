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
        <h1>👨‍🎓 Data Siswa</h1>
        <button class="btn-primary" @click="showModal = true">+ Tambah Siswa</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>Username</th>
              <th>Total Poin</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in siswaList" :key="s.id_siswa">
              <td>{{ i + 1 }}</td>
              <td>{{ s.nama_siswa }}</td>
              <td>{{ s.kelas }}</td>
              <td>{{ s.username }}</td>
              <td><strong>{{ s.total_poin }}</strong></td>
              <td>
                <span :class="['badge', badgeClass(s.status)]">{{ s.status }}</span>
              </td>
              <td>
                <button class="btn-danger-sm" @click="hapusSiswa(s.id_siswa)">Hapus</button>
              </td>
            </tr>
            <tr v-if="siswaList.length === 0">
              <td colspan="7" style="text-align:center; color:#aaa; padding: 2rem;">
                Belum ada data siswa
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal Tambah Siswa -->
      <div class="modal-overlay" v-if="showModal" @click.self="tutupModal">
        <div class="modal">
          <h2>Tambah Siswa Baru</h2>

          <div class="form-group">
            <label>Akun Siswa</label>
            <input
              v-model="form.user_id_input"
              type="text"
              placeholder="Ketik username siswa..."
              @input="cariUser"
              @focus="cariUser"
              autocomplete="off"
            />
            <!-- Dropdown hasil pencarian -->
            <div class="dropdown" v-if="userResults.length > 0">
              <div
                v-for="u in userResults"
                :key="u.id"
                class="dropdown-item"
                @mousedown.prevent="pilihUser(u)"
              >
                {{ u.username }}
              </div>
            </div>
            <p class="hint" v-if="form.user_id">
              ✅ Akun dipilih: <strong>{{ form.user_id_input }}</strong>
            </p>
            <p class="hint-error" v-if="form.user_id_input && !form.user_id && userResults.length === 0">
              ⚠️ Username tidak ditemukan
            </p>
          </div>

          <div class="form-group">
            <label>Nama Lengkap</label>
            <input
              v-model="form.nama_siswa"
              type="text"
              placeholder="Contoh: Budi Santoso"
            />
          </div>

          <div class="form-group">
            <label>Kelas</label>
            <input
              v-model="form.kelas"
              type="text"
              placeholder="Contoh: X-IPA-1"
            />
          </div>

          <p v-if="formError" class="error">❌ {{ formError }}</p>
          <p v-if="successMsg" class="success">{{ successMsg }}</p>

          <div class="modal-actions">
            <button class="btn-secondary" @click="tutupModal">Batal</button>
            <button class="btn-primary" @click="tambahSiswa" :disabled="loadingSubmit">
              {{ loadingSubmit ? 'Menyimpan...' : 'Simpan' }}
            </button>
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

const siswaList = ref([])
const showModal = ref(false)
const formError = ref('')
const successMsg = ref('')
const userResults = ref([])
const semuaUserSiswa = ref([])
const loadingSubmit = ref(false)

const form = ref({
  user_id: null,
  user_id_input: '',
  nama_siswa: '',
  kelas: ''
})

const headers = { Authorization: `Bearer ${authStore.token}` }

onMounted(async () => {
  await fetchSiswa()
  await fetchSemuaUserSiswa()
})

async function fetchSiswa() {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/siswa`, { headers })
    siswaList.value = res.data
  } catch (err) {
    console.error('Gagal fetch siswa:', err)
  }
}

async function fetchSemuaUserSiswa() {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/users-siswa`, { headers })
    semuaUserSiswa.value = res.data
  } catch (err) {
    console.error('Gagal fetch user siswa:', err)
  }
}

function cariUser() {
  const keyword = form.value.user_id_input.trim().toLowerCase()

  // Reset pilihan jika user mengetik ulang
  form.value.user_id = null

  if (!keyword) {
    userResults.value = []
    return
  }

  userResults.value = semuaUserSiswa.value.filter(u =>
    u.username.toLowerCase().includes(keyword)
  )
}

function pilihUser(u) {
  form.value.user_id = u.id
  form.value.user_id_input = u.username
  userResults.value = []
}

async function tambahSiswa() {
  formError.value = ''
  successMsg.value = ''

  if (!form.value.user_id) {
    formError.value = 'Pilih akun siswa dari dropdown terlebih dahulu'
    return
  }
  if (!form.value.nama_siswa.trim()) {
    formError.value = 'Nama lengkap wajib diisi'
    return
  }
  if (!form.value.kelas.trim()) {
    formError.value = 'Kelas wajib diisi'
    return
  }

  loadingSubmit.value = true

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/api/siswa`, {
      user_id: form.value.user_id,
      nama_siswa: form.value.nama_siswa.trim(),
      kelas: form.value.kelas.trim()
    }, { headers })

    successMsg.value = '✅ Siswa berhasil ditambahkan!'
    form.value = { user_id: null, user_id_input: '', nama_siswa: '', kelas: '' }
    userResults.value = []
    await fetchSiswa()
    await fetchSemuaUserSiswa()

    setTimeout(() => {
      tutupModal()
    }, 1500)
  } catch (err) {
    formError.value = err.response?.data?.message || 'Gagal menambah siswa'
  } finally {
    loadingSubmit.value = false
  }
}

async function hapusSiswa(id) {
  if (!confirm('Yakin ingin menghapus siswa ini beserta seluruh log pelanggarannya?')) return
  try {
    await axios.delete(`${import.meta.env.VITE_API_URL}/api/siswa/${id}`, { headers })
    await fetchSiswa()
  } catch (err) {
    alert('Gagal menghapus siswa')
  }
}

function tutupModal() {
  showModal.value = false
  formError.value = ''
  successMsg.value = ''
  form.value = { user_id: null, user_id_input: '', nama_siswa: '', kelas: '' }
  userResults.value = []
}

function badgeClass(status) {
  if (status === 'Peringatan') return 'badge-warning'
  if (status === 'Skorsing') return 'badge-danger'
  return 'badge-success'
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 240px; background: #1e3a5f; color: white;
  padding: 1.5rem 1rem; display: flex; flex-direction: column; gap: 0.5rem;
}
.sidebar h2 { font-size: 1.3rem; margin-bottom: 1.5rem; text-align: center; }
.sidebar nav { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.sidebar nav a {
  color: rgba(255,255,255,0.8); text-decoration: none;
  padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.95rem;
}
.sidebar nav a:hover,
.sidebar nav a.router-link-active { background: rgba(255,255,255,0.15); color: white; }
.logout-btn {
  background: rgba(255,255,255,0.1); color: white; border: none;
  padding: 0.6rem; border-radius: 8px; cursor: pointer;
}
.logout-btn:hover { background: #e53e3e; }
.content { flex: 1; padding: 2rem; }
.header-row {
  display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 1.5rem;
}
h1 { color: #1e3a5f; }
.table-wrapper {
  background: white; border-radius: 12px;
  overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
table { width: 100%; border-collapse: collapse; }
thead { background: #1e3a5f; color: white; }
th, td { padding: 0.9rem 1rem; text-align: left; font-size: 0.9rem; }
tbody tr:nth-child(even) { background: #f8f9fa; }
tbody tr:hover { background: #e8f4f8; }
.badge { padding: 0.3rem 0.7rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
.badge-success { background: #c6f6d5; color: #276749; }
.badge-warning { background: #fefcbf; color: #744210; }
.badge-danger { background: #fed7d7; color: #9b2c2c; }
.btn-primary {
  background: #1e3a5f; color: white; border: none;
  padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600;
}
.btn-primary:hover:not(:disabled) { background: #2d6a4f; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary {
  background: #eee; color: #333; border: none;
  padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer;
}
.btn-danger-sm {
  background: #fed7d7; color: #9b2c2c; border: none;
  padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;
}
.btn-danger-sm:hover { background: #e53e3e; color: white; }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal { background: white; padding: 2rem; border-radius: 12px; width: 440px; }
.modal h2 { margin-bottom: 1.5rem; color: #1e3a5f; }
.form-group { margin-bottom: 1.2rem; position: relative; }
label { display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem; color: #444; }
input {
  width: 100%; padding: 0.6rem 0.9rem;
  border: 1.5px solid #ddd; border-radius: 8px; font-size: 0.95rem;
}
input:focus { outline: none; border-color: #1e3a5f; }
.dropdown {
  border: 1.5px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;
  background: white; position: absolute; width: 100%; z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 180px; overflow-y: auto;
}
.dropdown-item { padding: 0.65rem 1rem; cursor: pointer; font-size: 0.95rem; }
.dropdown-item:hover { background: #f0f4ff; }
.hint { font-size: 0.82rem; color: #276749; margin-top: 0.4rem; }
.hint-error { font-size: 0.82rem; color: #e53e3e; margin-top: 0.4rem; }
.modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
.error { color: #e53e3e; font-size: 0.85rem; margin-top: 0.3rem; }
.success {
  color: #276749; font-size: 0.85rem;
  background: #c6f6d5; padding: 0.5rem 0.8rem; border-radius: 6px;
}
</style>