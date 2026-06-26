const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const siswaRoutes = require('./routes/siswa');
const pelanggaranRoutes = require('./routes/pelanggaran');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://e-sikap.vercel.app',
  /\.vercel\.app$/  // izinkan semua subdomain vercel
];

app.use(cors({
  origin: function (origin, callback) {
    // Izinkan request tanpa origin (curl, Postman, dll)
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

// Penting: handle preflight request
app.options('*', cors());

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