const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  //sebelum
  // if (!['guru', 'siswa'].includes(role)) {
  //   return res.status(400).json({ message: 'Role tidak valid' });
  // }

  //diubah menjadi :
    if (role !== 'siswa') {
    return res.status(403).json({ message: 'Registrasi publik hanya untuk akun siswa' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    const [rows] = await pool.query(
      'SELECT id, username, role FROM users WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ message: 'Registrasi berhasil', user: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username sudah digunakan' });
    }
    res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
  }
});

// GET /api/auth/users-siswa
router.get('/users-siswa', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username FROM users WHERE role = 'siswa' ORDER BY username ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data user', error: err.message });
  }
});

module.exports = router;