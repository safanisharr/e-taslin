# 🏫 E-Sikap — Sistem Pencatatan Pelanggaran Kedisiplinan Siswa

Aplikasi web untuk mencatat dan mengelola pelanggaran kedisiplinan siswa secara otomatis, dibangun dengan **Vue 3** (frontend) dan **Express.js** (backend), serta database **PostgreSQL** via **Supabase**.

---

## 📌 Fitur Utama

- 🔐 **Autentikasi** — Login berbasis JWT dengan dua role: Guru dan Siswa
- 📉 **Kalkulasi Poin Otomatis** — Poin siswa berkurang otomatis saat pelanggaran dicatat
- 🚦 **Update Status Otomatis** — Status berubah menjadi *Peringatan* atau *Skorsing* berdasarkan sisa poin
- 📋 **Log Pelanggaran** — Riwayat lengkap setiap pelanggaran yang tercatat
- 👨‍🎓 **Dashboard Siswa** — Siswa dapat memantau sisa poin dan riwayat pelanggaran milik sendiri
- 📊 **Dashboard Guru** — Ringkasan statistik seluruh siswa secara real-time

---

## 🧠 Aturan Bisnis (Business Rules)

| Kondisi | Status Siswa |
|---|---|
| Poin ≥ 50 | ✅ Aman |
| Poin < 50 | ⚠️ Peringatan |
| Poin = 0 | 🚨 Skorsing / Panggilan Orang Tua |

- Setiap siswa memulai dengan **100 poin**
- Setiap pelanggaran mengurangi poin sesuai bobot yang diinput guru
- Poin tidak bisa turun di bawah 0

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Vue 3, Vite, Vue Router, Pinia, Axios |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Supabase) |
| Auth | JSON Web Token (JWT) |
| Hosting Frontend | Vercel |
| Hosting Backend | Render |
| Hosting Database | Supabase |

---

## 📁 Struktur Proyek
e-sikap/

├── frontend/

│   ├── src/

│   │   ├── views/

│   │   │   ├── LoginView.vue

│   │   │   ├── DashboardGuru.vue

│   │   │   ├── DashboardSiswa.vue

│   │   │   ├── DataSiswa.vue

│   │   │   └── LogPelanggaran.vue

│   │   ├── router/

│   │   │   └── index.js

│   │   ├── stores/

│   │   │   └── auth.js

│   │   ├── App.vue

│   │   └── main.js

│   ├── .env

│   ├── .env.example

│   └── package.json

│

└── backend/

├── routes/

│   ├── auth.js

│   ├── siswa.js

│   └── pelanggaran.js

├── middleware/

│   └── authMiddleware.js

├── db.js

├── server.js

├── .env

├── .env.example

└── package.json

---

## ⚙️ Cara Menjalankan Secara Lokal

### Prasyarat

Pastikan sudah terinstall:
- [Node.js](https://nodejs.org/) v18 atau lebih baru
- Akun [Supabase](https://supabase.com/) untuk database

---

### 1. Clone Repository

```bash
git clone https://github.com/username/e-sikap.git
cd e-sikap
```

---

### 2. Setup Database (Supabase)

1. Buat project baru di [supabase.com](https://supabase.com/)
2. Buka menu **SQL Editor** → klik **New Query**
3. Jalankan SQL berikut:

```sql
-- Tabel users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(10) CHECK (role IN ('guru', 'siswa')) NOT NULL
);

-- Tabel siswa
CREATE TABLE siswa (
  id_siswa SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  nama_siswa VARCHAR(100) NOT NULL,
  kelas VARCHAR(20),
  total_poin INT DEFAULT 100,
  status VARCHAR(30) DEFAULT 'Aman'
);

-- Tabel log_pelanggaran
CREATE TABLE log_pelanggaran (
  id_log SERIAL PRIMARY KEY,
  siswa_id INT REFERENCES siswa(id_siswa),
  nama_pelanggaran VARCHAR(150) NOT NULL,
  poin_dikurangi INT NOT NULL CHECK (poin_dikurangi > 0),
  tanggal TIMESTAMP DEFAULT NOW()
);
```

4. Salin **Connection String** dari menu **Project Settings → Database → URI**

---

### 3. Setup Backend

```bash
cd backend
npm install
```

Buat file `.env` di folder `backend/`:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
JWT_SECRET=isi_dengan_string_rahasia_bebas
PORT=3000
```

Jalankan server:

```bash
# Mode development (auto-restart)
npm run dev

# Mode production
npm start
```

Backend berjalan di: `http://localhost:3000`

---

### 4. Setup Frontend

```bash
cd frontend
npm install
```

Buat file `.env` di folder `frontend/`:

```env
VITE_API_URL=http://localhost:3000
```

Jalankan aplikasi:

```bash
npm run dev
```

Frontend berjalan di: `http://localhost:5173`

---

## 🌐 Cara Deploy

### Backend → Render

1. Push repository ke GitHub
2. Buka [render.com](https://render.com/) → **New Web Service**
3. Hubungkan repository GitHub kamu
4. Konfigurasi:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Tambahkan **Environment Variables** di dashboard Render:
DATABASE_URL = (connection string Supabase)

JWT_SECRET   = (string rahasia kamu)

PORT         = 3000

6. Klik **Deploy** — salin URL backend yang diberikan Render

---

### Frontend → Vercel

1. Buka [vercel.com](https://vercel.com/) → **Add New Project**
2. Import repository GitHub kamu
3. Konfigurasi:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
4. Tambahkan **Environment Variables** di dashboard Vercel:
VITE_API_URL = https://url-backend-kamu.onrender.com

5. Klik **Deploy**

---

## 🔑 Endpoint API

### Auth

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Registrasi akun baru | ❌ |
| POST | `/api/auth/login` | Login dan mendapatkan token | ❌ |

### Siswa

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/siswa` | Ambil semua data siswa | Guru |
| GET | `/api/siswa/profil` | Ambil profil siswa yang login | Siswa |
| POST | `/api/siswa` | Tambah data siswa baru | Guru |
| DELETE | `/api/siswa/:id` | Hapus data siswa | Guru |

### Pelanggaran

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/pelanggaran` | Ambil semua log pelanggaran | Guru |
| GET | `/api/pelanggaran/saya` | Ambil log milik siswa login | Siswa |
| POST | `/api/pelanggaran` | Catat pelanggaran baru | Guru |

---

## 🧪 Skenario Pengujian (Black Box Testing)

| Fitur | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| Login | Form dikosongkan | Null | Alert "Kolom wajib diisi" |
| Login | Password salah | Kredensial tidak valid | Pesan "Username atau password salah" |
| Validasi Form | Input teks pada kolom poin | String | Sistem menolak, validasi tipe data |
| Validasi Form | Input angka minus pada poin | Angka ≤ 0 | Sistem menolak, poin harus > 0 |
| Kalkulasi Poin | Catat pelanggaran (sanksi 15) | Poin: 100 | total_poin menjadi 85 |
| Logika Status | Poin turun di bawah 50 | total_poin = 45 | Status berubah → "Peringatan" |
| Logika Status | Poin habis | total_poin = 0 | Status berubah → "Skorsing" |

---

## 👤 Akun Default untuk Testing

Setelah setup, register akun melalui endpoint `/api/auth/register` dengan body:

```json
// Akun Guru
{
  "username": "guru_admin",
  "password": "password123",
  "role": "guru"
}

// Akun Siswa
{
  "username": "siswa_001",
  "password": "password123",
  "role": "siswa"
}
```

---

## 🗂️ File Environment (Contoh)

**`backend/.env.example`**
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
JWT_SECRET=ganti_dengan_string_rahasia
PORT=3000
```

**`frontend/.env.example`**
```env
VITE_API_URL=http://localhost:3000
```

---

## 📋 .gitignore

Pastikan file `.gitignore` menyertakan:
Dependencies
node_modules/
Environment variables
.env
Build output
dist/

---

## 📅 Jadwal Pelaksanaan

| No | Kegiatan | Minggu 1 | Minggu 2 | Minggu 3 | Minggu 4 |
|---|---|---|---|---|---|
| 1 | Analisis Kebutuhan & Desain Database | ✔ | | | |
| 2 | Implementasi Backend & Frontend | | ✔ | ✔ | |
| 3 | Eksekusi Black Box Testing | | | ✔ | |
| 4 | Penyusunan Laporan & Dokumentasi | | | | ✔ |

---

## 👨‍💻 Developer

| Nama | NIM | Program Studi |
|---|---|---|
| Radhi Rabbani | 233510016 | Teknik Informatika |

**Universitas Islam Riau — Fakultas Teknik**
**Mata Kuliah: Implementasi dan Pengujian Perangkat Lunak**
**Tahun: 2026**

---

## 📝 Lisensi

Proyek ini dibuat untuk keperluan akademik. Bebas digunakan sebagai referensi pembelajaran.