const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireGuru } = require('../middleware/authMiddleware');

// GET /api/kategori-pelanggaran - daftar tata tertib resmi (guru & admin)
router.get('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM kategori_pelanggaran ORDER BY no_urut ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data kategori pelanggaran', error: err.message });
  }
});

module.exports = router;