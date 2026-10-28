const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { verifyToken, requireGuru } = require('../middleware/authMiddleware');

const STATUS_TINDAK = ['Belum Ditindaklanjuti', 'Sedang Ditindaklanjuti', 'Selesai Ditindaklanjuti'];

const buktiDir = path.join(__dirname, '..', 'uploads', 'pelanggaran');
if (!fs.existsSync(buktiDir)) fs.mkdirSync(buktiDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, buktiDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png'].includes(ext)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Hanya JPG atau PNG.'));
};

const uploadBukti = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }).single('foto_bukti');

function handleUpload(req, res, next) {
  uploadBukti(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 5MB' : err.message;
      return res.status(400).json({ message });
    }
    next();
  });
}

// GET /api/pelanggaran - ambil semua log (guru only)
router.get('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, s.nama_siswa, s.kelas,
              ur.username AS dilaporkan_oleh_nama,
              ut.username AS ditindaklanjuti_oleh_nama
       FROM log_pelanggaran l
       JOIN siswa s ON l.siswa_id = s.id_siswa
       LEFT JOIN users ur ON l.dilaporkan_oleh = ur.id
       LEFT JOIN users ut ON l.ditindaklanjuti_oleh = ut.id
       ORDER BY l.tanggal DESC, l.id_log DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil log pelanggaran', error: err.message });
  }
});

// GET /api/pelanggaran/saya - log milik siswa yang login
router.get('/saya', verifyToken, async (req, res) => {
  try {
    const [siswaRows] = await pool.query(
      'SELECT id_siswa FROM siswa WHERE user_id = ?', [req.user.id]
    );
    if (siswaRows.length === 0) {
      return res.status(404).json({ message: 'Profil siswa tidak ditemukan' });
    }
    const siswaId = siswaRows[0].id_siswa;

    const [rows] = await pool.query(
      'SELECT * FROM log_pelanggaran WHERE siswa_id = ? ORDER BY tanggal DESC, id_log DESC',
      [siswaId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil log', error: err.message });
  }
});

// POST /api/pelanggaran - input pelanggaran baru berdasarkan kategori resmi (guru only)
router.post('/', verifyToken, requireGuru, async (req, res) => {
  const { siswa_id, kategori_id } = req.body;

  if (!siswa_id || !kategori_id) {
    return res.status(400).json({ message: 'Siswa dan kategori pelanggaran wajib dipilih' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [kategoriRows] = await connection.query(
      'SELECT * FROM kategori_pelanggaran WHERE id_kategori = ?', [kategori_id]
    );
    if (kategoriRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Kategori pelanggaran tidak ditemukan' });
    }
    const kategori = kategoriRows[0];

    const [siswaRows] = await connection.query(
      'SELECT total_poin FROM siswa WHERE id_siswa = ?', [siswa_id]
    );
    if (siswaRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    const poinSekarang = siswaRows[0].total_poin;
    let poinBaru = poinSekarang - kategori.poin;
    if (poinBaru < 0) poinBaru = 0;

    let statusBaru = 'Aman';
    if (poinBaru === 0) statusBaru = 'Skorsing';
    else if (poinBaru < 50) statusBaru = 'Peringatan';

    await connection.query(
      'UPDATE siswa SET total_poin = ?, status = ? WHERE id_siswa = ?',
      [poinBaru, statusBaru, siswa_id]
    );

    // dilaporkan_oleh diambil dari akun yang sedang login
    const [insertResult] = await connection.query(
      `INSERT INTO log_pelanggaran 
       (siswa_id, nama_pelanggaran, jenis, poin_dikurangi, tindakan, diproses_oleh, dilaporkan_oleh) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [siswa_id, kategori.nama_pelanggaran, kategori.jenis, kategori.poin, kategori.tindakan, kategori.diproses_oleh, req.user.id]
    );
    const [logRows] = await connection.query(
      'SELECT * FROM log_pelanggaran WHERE id_log = ?', [insertResult.insertId]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Pelanggaran berhasil dicatat',
      log: logRows[0],
      poin_sekarang: poinBaru,
      status: statusBaru
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal mencatat pelanggaran', error: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/pelanggaran/:id/tindak-lanjut - perbarui status tindak lanjut + bukti (guru & admin)
router.put('/:id/tindak-lanjut', verifyToken, requireGuru, handleUpload, async (req, res) => {
  const { id } = req.params;
  const { status_tindak } = req.body;
  const fotoBaru = req.file ? req.file.filename : null;

  const buangUpload = () => {
    if (fotoBaru) fs.unlink(path.join(buktiDir, fotoBaru), () => {});
  };

  if (!STATUS_TINDAK.includes(status_tindak)) {
    buangUpload();
    return res.status(400).json({ message: 'Status tindak lanjut tidak valid' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT foto_bukti FROM log_pelanggaran WHERE id_log = ?', [id]
    );
    if (rows.length === 0) {
      buangUpload();
      return res.status(404).json({ message: 'Log pelanggaran tidak ditemukan' });
    }

    const fotoLama = rows[0].foto_bukti;
    const catatan = (req.body.catatan_tindak_lanjut || '').trim().slice(0, 2000) || null;
    const fotoFinal = fotoBaru || fotoLama;

    if (status_tindak === 'Selesai Ditindaklanjuti' && !catatan && !fotoFinal) {
      buangUpload();
      return res.status(400).json({ message: 'Untuk status Selesai, isi catatan atau unggah foto bukti' });
    }

    // Kalau dikembalikan ke "Belum", jejak pembaruan dikosongkan
    const reset = status_tindak === 'Belum Ditindaklanjuti';

    await pool.query(
      `UPDATE log_pelanggaran
       SET status_tindak = ?, catatan_tindak_lanjut = ?, foto_bukti = ?,
           ditindaklanjuti_oleh = ?, tgl_tindak_lanjut = ${reset ? 'NULL' : 'NOW()'}
       WHERE id_log = ?`,
      [status_tindak, catatan, fotoFinal, reset ? null : req.user.id, id]
    );

    // Hapus foto lama kalau sudah diganti
    if (fotoBaru && fotoLama) {
      fs.unlink(path.join(buktiDir, fotoLama), () => {});
    }

    res.json({ message: 'Tindak lanjut berhasil diperbarui' });
  } catch (err) {
    buangUpload();
    res.status(500).json({ message: 'Gagal memperbarui tindak lanjut', error: err.message });
  }
});

module.exports = router;