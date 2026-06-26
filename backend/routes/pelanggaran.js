const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireGuru } = require('../middleware/authMiddleware');

// GET /api/pelanggaran - ambil semua log (guru only)
router.get('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, s.nama_siswa, s.kelas 
       FROM log_pelanggaran l 
       JOIN siswa s ON l.siswa_id = s.id_siswa 
       ORDER BY l.tanggal DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil log pelanggaran', error: err.message });
  }
});

// GET /api/pelanggaran/saya - log milik siswa yang login
router.get('/saya', verifyToken, async (req, res) => {
  try {
    const siswaResult = await pool.query(
      'SELECT id_siswa FROM siswa WHERE user_id = $1', [req.user.id]
    );
    if (siswaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Profil siswa tidak ditemukan' });
    }
    const siswaId = siswaResult.rows[0].id_siswa;

    const result = await pool.query(
      'SELECT * FROM log_pelanggaran WHERE siswa_id = $1 ORDER BY tanggal DESC',
      [siswaId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil log', error: err.message });
  }
});

// POST /api/pelanggaran - input pelanggaran baru (guru only)
router.post('/', verifyToken, requireGuru, async (req, res) => {
  const { siswa_id, nama_pelanggaran, poin_dikurangi } = req.body;

  if (!siswa_id || !nama_pelanggaran || !poin_dikurangi) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  if (typeof poin_dikurangi !== 'number' || poin_dikurangi <= 0) {
    return res.status(400).json({ message: 'Bobot poin harus berupa angka lebih dari 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ambil poin siswa sekarang
    const siswaResult = await client.query(
      'SELECT total_poin FROM siswa WHERE id_siswa = $1', [siswa_id]
    );
    if (siswaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    const poinSekarang = siswaResult.rows[0].total_poin;
    let poinBaru = poinSekarang - poin_dikurangi;
    if (poinBaru < 0) poinBaru = 0;

    // Tentukan status baru
    let statusBaru = 'Aman';
    if (poinBaru === 0) statusBaru = 'Skorsing';
    else if (poinBaru < 50) statusBaru = 'Peringatan';

    // Update poin dan status siswa
    await client.query(
      'UPDATE siswa SET total_poin = $1, status = $2 WHERE id_siswa = $3',
      [poinBaru, statusBaru, siswa_id]
    );

    // Catat log pelanggaran
    const logResult = await client.query(
      'INSERT INTO log_pelanggaran (siswa_id, nama_pelanggaran, poin_dikurangi) VALUES ($1, $2, $3) RETURNING *',
      [siswa_id, nama_pelanggaran, poin_dikurangi]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Pelanggaran berhasil dicatat',
      log: logResult.rows[0],
      poin_sekarang: poinBaru,
      status: statusBaru
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Gagal mencatat pelanggaran', error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;