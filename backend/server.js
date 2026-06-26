const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const siswaRoutes = require('./routes/siswa');
const pelanggaranRoutes = require('./routes/pelanggaran');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://e-sikap.vercel.app' // ← ganti dengan URL Vercel kamu yang asli
  ],
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/siswa', siswaRoutes);
app.use('/api/pelanggaran', pelanggaranRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'E-Sikap API berjalan' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});