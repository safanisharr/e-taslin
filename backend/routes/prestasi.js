const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { verifyToken, requireGuru } = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'prestasi');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Hanya JPG, PNG, atau PDF.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const uploadFieldsRaw = upload.fields([
  { name: 'foto_piala', maxCount: 1 },
  { name: 'sertifikat', maxCount: 1 },
  { name: 'surat_tugas', maxCount: 1 }
]);

// Bungkus multer supaya error upload dikembalikan sebagai JSON yang jelas
function uploadFields(req, res, next) {
  uploadFieldsRaw(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 5MB' : err.message;
      return res.status(400).json({ message });
    }
    next();
  });
}

async function getSiswaIdFromUser(userId) {
  const [rows] = await pool.query('SELECT id_siswa FROM siswa WHERE user_id = ?', [userId]);
  return rows.length > 0 ? rows[0].id_siswa : null;
}

// POST /api/prestasi - siswa mengajukan klaim prestasi baru
router.post('/', verifyToken, uploadFields, async (req, res) => {
  if (req.user.role !== 'siswa') {
    return res.status(403).json({ message: 'Endpoint ini khusus untuk siswa' });
  }

  const { kategori, judul_lomba, tingkat, capaian, tanggal } = req.body;
  const penyelenggara = (req.body.penyelenggara || '').trim();

  if (!kategori || !judul_lomba || !penyelenggara || !tingkat || !capaian || !tanggal) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const siswaId = await getSiswaIdFromUser(req.user.id);
    if (!siswaId) {
      return res.status(404).json({ message: 'Profil siswa tidak ditemukan' });
    }

    const fotoPiala = req.files?.foto_piala?.[0]?.filename || null;
    const sertifikat = req.files?.sertifikat?.[0]?.filename || null;
    const suratTugas = req.files?.surat_tugas?.[0]?.filename || null;

    const [result] = await pool.query(
      `INSERT INTO prestasi 
       (siswa_id, kategori, judul_lomba, penyelenggara, tingkat, capaian, tanggal, foto_piala, sertifikat, surat_tugas, status, diinput_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu', 'siswa')`,
      [siswaId, kategori, judul_lomba, penyelenggara, tingkat, capaian, tanggal, fotoPiala, sertifikat, suratTugas]
    );

    res.status(201).json({ message: 'Pengajuan prestasi berhasil dikirim, menunggu validasi guru', id_prestasi: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengajukan prestasi', error: err.message });
  }
});

// POST /api/prestasi/guru - guru/admin input prestasi siswa langsung (otomatis disetujui)
router.post('/guru', verifyToken, requireGuru, uploadFields, async (req, res) => {
  const { siswa_id, kategori, judul_lomba, tingkat, capaian, tanggal } = req.body;
  const penyelenggara = (req.body.penyelenggara || '').trim();

  if (!siswa_id || !kategori || !judul_lomba || !penyelenggara || !tingkat || !capaian || !tanggal) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const fotoPiala = req.files?.foto_piala?.[0]?.filename || null;
    const sertifikat = req.files?.sertifikat?.[0]?.filename || null;
    const suratTugas = req.files?.surat_tugas?.[0]?.filename || null;

    const [result] = await pool.query(
      `INSERT INTO prestasi 
       (siswa_id, kategori, judul_lomba, penyelenggara, tingkat, capaian, tanggal, foto_piala, sertifikat, surat_tugas, status, diinput_oleh, divalidasi_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disetujui', 'guru', ?)`,
      [siswa_id, kategori, judul_lomba, penyelenggara, tingkat, capaian, tanggal, fotoPiala, sertifikat, suratTugas, req.user.id]
    );

    res.status(201).json({ message: 'Prestasi berhasil ditambahkan', id_prestasi: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambahkan prestasi', error: err.message });
  }
});

// GET /api/prestasi/saya - riwayat prestasi milik siswa yang login
router.get('/saya', verifyToken, async (req, res) => {
  if (req.user.role !== 'siswa') {
    return res.status(403).json({ message: 'Endpoint ini khusus untuk siswa' });
  }

  try {
    const siswaId = await getSiswaIdFromUser(req.user.id);
    if (!siswaId) {
      return res.status(404).json({ message: 'Profil siswa tidak ditemukan' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM prestasi WHERE siswa_id = ? ORDER BY created_at DESC',
      [siswaId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil riwayat prestasi', error: err.message });
  }
});

// GET /api/prestasi - semua pengajuan (guru & admin), bisa difilter ?status=Menunggu
router.get('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT p.*, s.nama_siswa, s.kelas 
                 FROM prestasi p 
                 JOIN siswa s ON p.siswa_id = s.id_siswa`;
    const params = [];
    if (status) {
      query += ' WHERE p.status = ?';
      params.push(status);
    }
    query += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data prestasi', error: err.message });
  }
});

// GET /api/prestasi/pending-count - jumlah pengajuan menunggu (untuk badge notifikasi)
router.get('/pending-count', verifyToken, requireGuru, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT COUNT(*) as total FROM prestasi WHERE status = 'Menunggu'"
    );
    res.json({ total: rows[0].total });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil jumlah pengajuan', error: err.message });
  }
});

// GET /api/prestasi/ranking - leaderboard siswa dengan prestasi tervalidasi terbanyak
router.get('/ranking', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id_siswa, s.nama_siswa, s.kelas, COUNT(p.id_prestasi) as jumlah_prestasi
       FROM siswa s
       JOIN prestasi p ON p.siswa_id = s.id_siswa AND p.status = 'Disetujui'
       GROUP BY s.id_siswa, s.nama_siswa, s.kelas
       ORDER BY jumlah_prestasi DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil ranking prestasi', error: err.message });
  }
});

// PUT /api/prestasi/:id/validasi - guru/admin setujui atau tolak pengajuan
router.put('/:id/validasi', verifyToken, requireGuru, async (req, res) => {
  const { id } = req.params;
  const { status, alasan_penolakan } = req.body;

  if (!['Disetujui', 'Ditolak'].includes(status)) {
    return res.status(400).json({ message: 'Status harus Disetujui atau Ditolak' });
  }
  if (status === 'Ditolak' && !alasan_penolakan) {
    return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM prestasi WHERE id_prestasi = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Pengajuan prestasi tidak ditemukan' });
    }

    await pool.query(
      'UPDATE prestasi SET status = ?, alasan_penolakan = ?, divalidasi_oleh = ? WHERE id_prestasi = ?',
      [status, status === 'Ditolak' ? alasan_penolakan : null, req.user.id, id]
    );

    res.json({ message: `Pengajuan berhasil di${status === 'Disetujui' ? 'setujui' : 'tolak'}` });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memvalidasi prestasi', error: err.message });
  }
});

module.exports = router;