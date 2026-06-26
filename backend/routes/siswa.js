const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireGuru } = require('../middleware/authMiddleware');

// GET /api/siswa - ambil semua data siswa (guru only)
router.get('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT s.*, u.username FROM siswa s JOIN users u ON s.user_id = u.id ORDER BY s.id_siswa ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data siswa', error: err.message });
  }
});

// GET /api/siswa/profil - ambil profil siswa yang sedang login
router.get('/profil', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM siswa WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profil siswa tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil profil', error: err.message });
  }
});

// POST /api/siswa - tambah siswa baru (guru only)
router.post('/', verifyToken, requireGuru, async (req, res) => {
  const { user_id, nama_siswa, kelas } = req.body;

  if (!user_id || !nama_siswa || !kelas) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO siswa (user_id, nama_siswa, kelas) VALUES ($1, $2, $3) RETURNING *',
      [user_id, nama_siswa, kelas]
    );
    res.status(201).json({ message: 'Data siswa berhasil ditambahkan', siswa: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambah siswa', error: err.message });
  }
});

// DELETE /api/siswa/:id - hapus siswa (guru only)
router.delete('/:id', verifyToken, requireGuru, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM log_pelanggaran WHERE siswa_id = $1', [id]);
    await pool.query('DELETE FROM siswa WHERE id_siswa = $1', [id]);
    res.json({ message: 'Data siswa berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus siswa', error: err.message });
  }
});

module.exports = router;