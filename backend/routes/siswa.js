const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { verifyToken, requireGuru, requireAdmin } = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '..', 'uploads', 'prestasi');

// Hapus siswa beserta log pelanggaran & prestasinya (dipakai hapus satuan dan massal)
async function hapusSiswaBeserta(connection, ids) {
  if (ids.length === 0) return { deleted: 0, files: [] };

  const [files] = await connection.query(
    'SELECT foto_piala, sertifikat, surat_tugas FROM prestasi WHERE siswa_id IN (?)',
    [ids]
  );

  await connection.query('DELETE FROM log_pelanggaran WHERE siswa_id IN (?)', [ids]);
  await connection.query('DELETE FROM prestasi WHERE siswa_id IN (?)', [ids]);
  const [result] = await connection.query('DELETE FROM siswa WHERE id_siswa IN (?)', [ids]);

  return { deleted: result.affectedRows, files };
}

// Hapus file bukti dari disk (setelah transaksi database sukses)
function hapusFileBukti(files) {
  files.forEach(f => {
    [f.foto_piala, f.sertifikat, f.surat_tugas].forEach(name => {
      if (name) fs.unlink(path.join(uploadDir, name), () => {});
    });
  });
}

// GET /api/siswa - guru & admin boleh lihat
router.get('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT s.*, u.username FROM siswa s JOIN users u ON s.user_id = u.id ORDER BY s.id_siswa ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data siswa', error: err.message });
  }
});

// GET /api/siswa/profil - profil siswa yang sedang login
router.get('/profil', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM siswa WHERE user_id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Profil siswa tidak ditemukan' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil profil', error: err.message });
  }
});

// POST /api/siswa - tambah siswa baru (ADMIN ONLY)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { user_id, nama_siswa, kelas } = req.body;

  if (!user_id || !nama_siswa || !kelas) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO siswa (user_id, nama_siswa, kelas) VALUES (?, ?, ?)',
      [user_id, nama_siswa, kelas]
    );
    const [rows] = await pool.query('SELECT * FROM siswa WHERE id_siswa = ?', [result.insertId]);
    res.status(201).json({ message: 'Data siswa berhasil ditambahkan', siswa: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambah siswa', error: err.message });
  }
});

// POST /api/siswa/bulk-delete - hapus banyak siswa sekaligus (ADMIN ONLY)
router.post('/bulk-delete', verifyToken, requireAdmin, async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'Pilih minimal satu siswa' });
  }

  const cleanIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
  if (cleanIds.length === 0) {
    return res.status(400).json({ message: 'ID siswa tidak valid' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { deleted, files } = await hapusSiswaBeserta(connection, cleanIds);
    await connection.commit();
    hapusFileBukti(files);
    res.json({ message: `${deleted} data siswa berhasil dihapus`, deleted });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menghapus siswa terpilih', error: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/siswa/:id - edit data siswa (ADMIN ONLY)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nama_siswa, kelas } = req.body;

  if (!nama_siswa || !kelas) {
    return res.status(400).json({ message: 'Kolom wajib diisi' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM siswa WHERE id_siswa = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    await pool.query('UPDATE siswa SET nama_siswa = ?, kelas = ? WHERE id_siswa = ?', [nama_siswa, kelas, id]);

    const [rows] = await pool.query('SELECT * FROM siswa WHERE id_siswa = ?', [id]);
    res.json({ message: 'Data siswa berhasil diupdate', siswa: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Gagal update siswa', error: err.message });
  }
});

// DELETE /api/siswa/:id - hapus satu siswa (ADMIN ONLY)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { files } = await hapusSiswaBeserta(connection, [Number(req.params.id)]);
    await connection.commit();
    hapusFileBukti(files);
    res.json({ message: 'Data siswa berhasil dihapus' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menghapus siswa', error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;