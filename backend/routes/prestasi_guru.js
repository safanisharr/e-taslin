const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { verifyToken, requireGuru, requireAdmin } = require('../middleware/authMiddleware');

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

function uploadFields(req, res, next) {
  uploadFieldsRaw(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 5MB' : err.message;
      return res.status(400).json({ message });
    }
    next();
  });
}

// POST /api/prestasi-guru - guru mengajukan prestasi (admin: langsung disetujui)
router.post('/', verifyToken, requireGuru, uploadFields, async (req, res) => {
  const { kategori, judul_lomba, tingkat, capaian, tanggal } = req.body;
  const penyelenggara = (req.body.penyelenggara || '').trim();

  if (!kategori || !judul_lomba || !penyelenggara || !tingkat || !capaian || !tanggal) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  const isAdmin = req.user.role === 'admin';
  const status = isAdmin ? 'Disetujui' : 'Menunggu';
  const validator = isAdmin ? req.user.id : null;

  try {
    const fotoPiala = req.files?.foto_piala?.[0]?.filename || null;
    const sertifikat = req.files?.sertifikat?.[0]?.filename || null;
    const suratTugas = req.files?.surat_tugas?.[0]?.filename || null;

    const [result] = await pool.query(
      `INSERT INTO prestasi_guru
       (user_id, kategori, judul_lomba, penyelenggara, tingkat, capaian, tanggal, foto_piala, sertifikat, surat_tugas, status, divalidasi_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, kategori, judul_lomba, penyelenggara, tingkat, capaian, tanggal, fotoPiala, sertifikat, suratTugas, status, validator]
    );

    res.status(201).json({
      message: isAdmin
        ? 'Prestasi berhasil ditambahkan'
        : 'Pengajuan prestasi berhasil dikirim, menunggu validasi admin',
      id_prestasi_guru: result.insertId
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menyimpan prestasi guru', error: err.message });
  }
});

// GET /api/prestasi-guru/saya - riwayat prestasi milik guru yang login
router.get('/saya', verifyToken, requireGuru, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM prestasi_guru WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil riwayat prestasi', error: err.message });
  }
});

// GET /api/prestasi-guru/pending-count - jumlah pengajuan menunggu (ADMIN ONLY)
router.get('/pending-count', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM prestasi_guru WHERE status = 'Menunggu'");
    res.json({ total: rows[0].total });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil jumlah pengajuan', error: err.message });
  }
});

// GET /api/prestasi-guru - semua prestasi guru (ADMIN ONLY)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pg.*, u.username
       FROM prestasi_guru pg
       JOIN users u ON pg.user_id = u.id
       ORDER BY pg.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data prestasi guru', error: err.message });
  }
});

// PUT /api/prestasi-guru/:id/validasi - setuju/tolak (ADMIN ONLY)
router.put('/:id/validasi', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, alasan_penolakan } = req.body;

  if (!['Disetujui', 'Ditolak'].includes(status)) {
    return res.status(400).json({ message: 'Status harus Disetujui atau Ditolak' });
  }
  if (status === 'Ditolak' && !alasan_penolakan) {
    return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
  }

  try {
    const [existing] = await pool.query('SELECT id_prestasi_guru FROM prestasi_guru WHERE id_prestasi_guru = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Pengajuan prestasi tidak ditemukan' });
    }

    await pool.query(
      'UPDATE prestasi_guru SET status = ?, alasan_penolakan = ?, divalidasi_oleh = ? WHERE id_prestasi_guru = ?',
      [status, status === 'Ditolak' ? alasan_penolakan : null, req.user.id, id]
    );

    res.json({ message: `Pengajuan berhasil di${status === 'Disetujui' ? 'setujui' : 'tolak'}` });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memvalidasi prestasi', error: err.message });
  }
});

module.exports = router;