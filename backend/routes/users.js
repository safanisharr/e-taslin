const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// GET /api/users/guru - daftar semua akun guru & admin (ADMIN ONLY)
router.get('/guru', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, role FROM users WHERE role IN ('guru','admin') ORDER BY username ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data guru', error: err.message });
  }
});

// POST /api/users/guru - tambah akun guru baru (ADMIN ONLY)
router.post('/guru', verifyToken, requireAdmin, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'guru']
    );
    res.status(201).json({
      message: 'Akun guru berhasil ditambahkan',
      user: { id: result.insertId, username, role: 'guru' }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username sudah digunakan' });
    }
    res.status(500).json({ message: 'Gagal menambah akun guru', error: err.message });
  }
});

// DELETE /api/users/guru/:id - hapus akun guru (ADMIN ONLY, tidak bisa hapus sesama admin)
router.delete('/guru/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT role FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Akun tidak ditemukan' });
    }
    if (rows[0].role === 'admin') {
      connection.release();
      return res.status(403).json({ message: 'Tidak bisa menghapus akun admin' });
    }

    await connection.beginTransaction();
    // lepaskan keterkaitan data prestasi sebelum akun dihapus
    await connection.query('UPDATE prestasi SET divalidasi_oleh = NULL WHERE divalidasi_oleh = ?', [id]);
    await connection.query('UPDATE prestasi_guru SET divalidasi_oleh = NULL WHERE divalidasi_oleh = ?', [id]);
    await connection.query('DELETE FROM prestasi_guru WHERE user_id = ?', [id]);
    await connection.query('DELETE FROM users WHERE id = ?', [id]);
    await connection.commit();

    res.json({ message: 'Akun guru berhasil dihapus' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menghapus akun guru', error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;