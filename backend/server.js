const express = require('express');
const cors = require('cors');
require('dotenv').config();

//tambahan untuk prestasi
const path = require('path');
const prestasiRoutes = require('./routes/prestasi');

const authRoutes = require('./routes/auth');
const siswaRoutes = require('./routes/siswa');
const pelanggaranRoutes = require('./routes/pelanggaran');
const importRoutes = require('./routes/import');
const laporanRoutes = require('./routes/laporan');
const userRoutes = require('./routes/users');
const kategoriRoutes = require('./routes/kategori');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  /\.vercel\.app$/
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS tidak diizinkan: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use(express.json());

const prestasiGuruRoutes = require('./routes/prestasi_guru');
app.use('/api/prestasi-guru', prestasiGuruRoutes);

//tambahan untuk prestasi
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/siswa', siswaRoutes);
app.use('/api/pelanggaran', pelanggaranRoutes);
app.use('/api/import', importRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kategori-pelanggaran', kategoriRoutes);
//tambahan prestasi
app.use('/api/prestasi', prestasiRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'E-Taslin API berjalan' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});