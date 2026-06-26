<template>
  <div class="login-container">
    <div class="login-card">
      <h1>🏫 E-Sikap</h1>
      <p class="subtitle">Sistem Pencatatan Pelanggaran Siswa</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Username</label>
          <input
            v-model="username"
            type="text"
            placeholder="Masukkan username"
            required
          />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Masukkan password"
            required
          />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Memproses...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    errorMsg.value = 'Kolom wajib diisi'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      username: username.value,
      password: password.value
    })

    authStore.login(res.data.token, res.data.user)

    if (res.data.user.role === 'guru') {
      router.push('/dashboard-guru')
    } else {
      router.push('/dashboard-siswa')
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Login gagal'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a5f, #2d6a4f);
}
.login-card {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
h1 { text-align: center; color: #1e3a5f; font-size: 2rem; }
.subtitle { text-align: center; color: #666; margin-bottom: 2rem; font-size: 0.9rem; }
.form-group { margin-bottom: 1.2rem; }
label { display: block; margin-bottom: 0.4rem; color: #444; font-weight: 600; font-size: 0.9rem; }
input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border 0.2s;
}
input:focus { outline: none; border-color: #1e3a5f; }
button {
  width: 100%;
  padding: 0.85rem;
  background: #1e3a5f;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.2s;
}
button:hover:not(:disabled) { background: #2d6a4f; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
.error { color: #e53e3e; font-size: 0.875rem; margin-bottom: 0.5rem; text-align: center; }
</style>