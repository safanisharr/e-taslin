const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verifyToken, requireGuru } = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

// Konversi tanggal dari Excel (bisa berupa Date object, serial number, atau teks) jadi Date JS yang benar
function parseExcelDate(value) {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    // Serial number Excel: hari ke-0 Excel = 30 Desember 1899
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;

  return new Date();
}

// POST /api/import/siswa - import massal data siswa + riwayat pelanggaran (guru only)
router.post('/siswa', verifyToken, requireGuru, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File Excel wajib diupload' });
  }

  const connection = await pool.getConnection();
  try {
    // cellDates: true supaya kolom bertipe Date di Excel terbaca sebagai Date JS, bukan angka serial
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });

    const sheetSiswa = workbook.Sheets['Data Siswa'];
    if (!sheetSiswa) {
      connection.release();
      return res.status(400).json({ message: "Sheet 'Data Siswa' tidak ditemukan di file Excel" });
    }
    const dataSiswa = XLSX.utils.sheet_to_json(sheetSiswa);

    const sheetPelanggaran = workbook.Sheets['Riwayat Pelanggaran'];
    const dataPelanggaran = sheetPelanggaran ? XLSX.utils.sheet_to_json(sheetPelanggaran) : [];

    await connection.beginTransaction();

    // Ambil daftar tata tertib resmi untuk pencocokan otomatis
    const [kategoriRows] = await connection.query(
      'SELECT nama_pelanggaran, jenis, tindakan, diproses_oleh FROM kategori_pelanggaran'
    );
    const kategoriMap = {};
    kategoriRows.forEach(k => {
      kategoriMap[k.nama_pelanggaran.trim().toLowerCase()] = k;
    });

    const usernameToSiswaId = {};
    const usernameToPoin = {};
    let jumlahSiswaBaru = 0;
    let jumlahSiswaDilewati = 0;

    // 1. Proses Sheet "Data Siswa"
    for (const row of dataSiswa) {
      const username = String(row.username || '').trim();
      const nama_siswa = String(row.nama_siswa || '').trim();
      const kelas = String(row.kelas || '').trim();
      const password = String(row.password || 'siswa123').trim();

      if (!username || !nama_siswa || !kelas) continue;

      const [existingUser] = await connection.query(
        'SELECT id FROM users WHERE username = ?', [username]
      );

      let userId;
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        jumlahSiswaDilewati++;
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hashedPassword, 'siswa']
        );
        userId = userResult.insertId;
        jumlahSiswaBaru++;
      }

      const [existingSiswa] = await connection.query(
        'SELECT id_siswa, total_poin FROM siswa WHERE user_id = ?', [userId]
      );

      let idSiswa, totalPoin;
      if (existingSiswa.length > 0) {
        idSiswa = existingSiswa[0].id_siswa;
        totalPoin = existingSiswa[0].total_poin;
      } else {
        const [siswaResult] = await connection.query(
          'INSERT INTO siswa (user_id, nama_siswa, kelas) VALUES (?, ?, ?)',
          [userId, nama_siswa, kelas]
        );
        idSiswa = siswaResult.insertId;
        totalPoin = 100;
      }

      usernameToSiswaId[username] = idSiswa;
      usernameToPoin[username] = totalPoin;
    }

    // 2. Proses Sheet "Riwayat Pelanggaran" (urutkan berdasarkan tanggal biar poin terhitung benar)
    const pelanggaranValid = dataPelanggaran.filter(
      row => row.username_siswa && row.nama_pelanggaran && row.poin_dikurangi
    );
    pelanggaranValid.sort((a, b) => {
      const dateA = parseExcelDate(a.tanggal);
      const dateB = parseExcelDate(b.tanggal);
      return dateA - dateB;
    });

    let jumlahLogDitambah = 0;
    let jumlahLogDilewati = 0;

    for (const row of pelanggaranValid) {
      const username = String(row.username_siswa).trim();
      const namaPelanggaran = String(row.nama_pelanggaran).trim();
      const poinDikurangi = Number(row.poin_dikurangi);

      let idSiswa = usernameToSiswaId[username];

      if (!idSiswa) {
        const [rows] = await connection.query(
          `SELECT s.id_siswa, s.total_poin FROM siswa s 
           JOIN users u ON s.user_id = u.id WHERE u.username = ?`, [username]
        );
        if (rows.length === 0) {
          jumlahLogDilewati++;
          continue;
        }
        idSiswa = rows[0].id_siswa;
        usernameToSiswaId[username] = idSiswa;
        usernameToPoin[username] = rows[0].total_poin;
      }

      if (!poinDikurangi || poinDikurangi <= 0) {
        jumlahLogDilewati++;
        continue;
      }

      // Cocokkan dengan tata tertib resmi berdasarkan nama pelanggaran,
      // atau pakai kolom manual di Excel kalau ada, atau biarkan kosong
      const kategoriMatch = kategoriMap[namaPelanggaran.toLowerCase()];
      const jenis = row.jenis ? String(row.jenis).trim() : (kategoriMatch ? kategoriMatch.jenis : null);
      const tindakan = row.tindakan ? String(row.tindakan).trim() : (kategoriMatch ? kategoriMatch.tindakan : null);
      const diprosesOleh = row.diproses_oleh ? String(row.diproses_oleh).trim() : (kategoriMatch ? kategoriMatch.diproses_oleh : null);

      const poinSekarang = usernameToPoin[username];
      let poinBaru = poinSekarang - poinDikurangi;
      if (poinBaru < 0) poinBaru = 0;

      let statusBaru = 'Aman';
      if (poinBaru === 0) statusBaru = 'Skorsing';
      else if (poinBaru < 50) statusBaru = 'Peringatan';

      await connection.query(
        'UPDATE siswa SET total_poin = ?, status = ? WHERE id_siswa = ?',
        [poinBaru, statusBaru, idSiswa]
      );

      const tanggalInsert = parseExcelDate(row.tanggal);
      await connection.query(
        `INSERT INTO log_pelanggaran 
         (siswa_id, nama_pelanggaran, jenis, poin_dikurangi, tindakan, diproses_oleh, tanggal) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [idSiswa, namaPelanggaran, jenis, poinDikurangi, tindakan, diprosesOleh, tanggalInsert]
      );

      usernameToPoin[username] = poinBaru;
      jumlahLogDitambah++;
    }

    await connection.commit();

    res.status(201).json({
      message: 'Import data berhasil',
      ringkasan: {
        siswa_baru: jumlahSiswaBaru,
        siswa_sudah_ada: jumlahSiswaDilewati,
        log_pelanggaran_ditambahkan: jumlahLogDitambah,
        log_pelanggaran_dilewati: jumlahLogDilewati
      }
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal import data', error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;  