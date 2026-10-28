const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { verifyToken, requireGuru, requireAdmin } = require('../middleware/authMiddleware');

// GET /api/laporan/pdf?detail=true - export laporan pelanggaran siswa (guru only)
router.get('/pdf', verifyToken, requireGuru, async (req, res) => {
  const includeDetail = req.query.detail === 'true';

  try {
    const [siswaRows] = await pool.query(
      'SELECT id_siswa, nama_siswa, kelas, total_poin, status FROM siswa ORDER BY kelas ASC, nama_siswa ASC'
    );

    let logBySiswa = {};
    if (includeDetail) {
      const [logRows] = await pool.query(
        'SELECT siswa_id, nama_pelanggaran, poin_dikurangi, tanggal FROM log_pelanggaran ORDER BY tanggal ASC'
      );
      logRows.forEach(log => {
        if (!logBySiswa[log.siswa_id]) logBySiswa[log.siswa_id] = [];
        logBySiswa[log.siswa_id].push(log);
      });
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan-pelanggaran-siswa.pdf');
    doc.pipe(res);

    doc.fontSize(16).text('Laporan Pelanggaran Kedisiplinan Siswa', { align: 'center' });
    doc.fontSize(10).fillColor('gray').text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('black');

    siswaRows.forEach((siswa, index) => {
      doc.fontSize(11).font('Helvetica-Bold').text(
        `${index + 1}. ${siswa.nama_siswa} - Kelas ${siswa.kelas}`
      );
      doc.font('Helvetica').fontSize(10).text(
        `   Total Poin: ${siswa.total_poin}   |   Status: ${siswa.status}`
      );

      if (includeDetail) {
        const logs = logBySiswa[siswa.id_siswa] || [];
        if (logs.length === 0) {
          doc.fontSize(9).fillColor('gray').text('   Tidak ada riwayat pelanggaran');
          doc.fillColor('black');
        } else {
          logs.forEach(log => {
            const tanggal = new Date(log.tanggal).toLocaleDateString('id-ID');
            doc.fontSize(9).text(
              `   - ${tanggal}: ${log.nama_pelanggaran} (-${log.poin_dikurangi} poin)`
            );
          });
        }
      }
      doc.moveDown(0.8);

      if (doc.y > 720) {
        doc.addPage();
      }
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Gagal membuat laporan PDF', error: err.message });
  }
});

// ===== Helper PDF prestasi (dipakai prestasi siswa & guru) =====

function urutanPrestasi(alias) {
  return `FIELD(${alias}.tingkat, 'Internasional','Nasional','Provinsi','Kabupaten/Kota','Internal'),
          FIELD(${alias}.capaian, 'Juara 1','Juara 2','Juara 3','Harapan','Finalis','Peserta'),
          ${alias}.tanggal DESC`;
}

function formatTgl(d) {
  return new Date(d).toLocaleDateString('id-ID');
}

function drawTable(doc, cols, rows) {
  const startX = doc.page.margins.left;
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const pad = 4;
  const bottom = doc.page.height - doc.page.margins.bottom;
  let y = doc.y;

  const drawHeader = () => {
    doc.rect(startX, y, totalW, 20).fill('#1e3a5f');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    let x = startX;
    cols.forEach(c => {
      doc.text(c.label, x + pad, y + 6, { width: c.width - pad * 2, lineBreak: false });
      x += c.width;
    });
    doc.fillColor('black');
    y += 20;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(9);

  rows.forEach((cells, idx) => {
    const heights = cells.map((t, i) =>
      doc.heightOfString(String(t), { width: cols[i].width - pad * 2 })
    );
    const rowH = Math.max(...heights) + pad * 2;

    if (y + rowH > bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
      doc.font('Helvetica').fontSize(9);
    }

    if (idx % 2 === 1) {
      doc.rect(startX, y, totalW, rowH).fill('#f3f6fa');
      doc.fillColor('black');
    }

    let x = startX;
    cells.forEach((t, i) => {
      doc.text(String(t), x + pad, y + pad, { width: cols[i].width - pad * 2 });
      x += cols[i].width;
    });
    y += rowH;
  });

  doc.x = startX;
  doc.y = y;
}

// rows: [{ nama, kategori, judul_lomba, tingkat, capaian, tanggal, status }]
function buatPdfPrestasi(res, { judul, namaFile, infoFilter, rows, labelNama, tampilStatus }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${namaFile}`);
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(16).text(judul, { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('gray');
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, { align: 'center' });
  doc.text(infoFilter, { align: 'center' });
  doc.text(`Total prestasi: ${rows.length}`, { align: 'center' });
  doc.fillColor('black').moveDown(1);

  const cols = tampilStatus
    ? [
        { label: 'No', width: 25 }, { label: labelNama, width: 110 },
        { label: 'Judul Lomba', width: 115 }, { label: 'Tingkat', width: 75 },
        { label: 'Capaian', width: 50 }, { label: 'Tanggal', width: 60 },
        { label: 'Status', width: 60 }
      ]
    : [
        { label: 'No', width: 25 }, { label: labelNama, width: 120 },
        { label: 'Judul Lomba', width: 155 }, { label: 'Tingkat', width: 80 },
        { label: 'Capaian', width: 55 }, { label: 'Tanggal', width: 65 }
      ];

  let adaData = false;
  ['Akademik', 'Non-Akademik'].forEach(kat => {
    const dataKat = rows.filter(r => r.kategori === kat);
    if (dataKat.length === 0) return;
    adaData = true;

    if (doc.y > doc.page.height - doc.page.margins.bottom - 80) doc.addPage();

    doc.x = doc.page.margins.left;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1e3a5f')
       .text(`Prestasi ${kat} (${dataKat.length})`);
    doc.fillColor('black').moveDown(0.4);

    const tableRows = dataKat.map((r, i) => {
      const base = [i + 1, r.nama, r.judul_lomba, r.tingkat, r.capaian, formatTgl(r.tanggal)];
      return tampilStatus ? [...base, r.status] : base;
    });
    drawTable(doc, cols, tableRows);
    doc.moveDown(1);
  });

  if (!adaData) {
    doc.font('Helvetica').fontSize(11).fillColor('gray')
       .text('Tidak ada data prestasi sesuai filter.', { align: 'center' });
  }

  doc.end();
}

// GET /api/laporan/prestasi-pdf?kategori=Semua|Akademik|Non-Akademik&status=Disetujui|Menunggu|Ditolak|Semua
router.get('/prestasi-pdf', verifyToken, requireGuru, async (req, res) => {
  const kategoriFilter = ['Akademik', 'Non-Akademik'].includes(req.query.kategori) ? req.query.kategori : 'Semua';
  const statusFilter = ['Disetujui', 'Menunggu', 'Ditolak', 'Semua'].includes(req.query.status) ? req.query.status : 'Disetujui';

  try {
    const conditions = [];
    const params = [];
    if (kategoriFilter !== 'Semua') { conditions.push('p.kategori = ?'); params.push(kategoriFilter); }
    if (statusFilter !== 'Semua') { conditions.push('p.status = ?'); params.push(statusFilter); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT p.*, s.nama_siswa, s.kelas
       FROM prestasi p
       JOIN siswa s ON p.siswa_id = s.id_siswa
       ${where}
       ORDER BY ${urutanPrestasi('p')}`,
      params
    );

    buatPdfPrestasi(res, {
      judul: 'Laporan Prestasi Siswa',
      namaFile: 'laporan-prestasi-siswa.pdf',
      infoFilter: `Kategori: ${kategoriFilter} | Status: ${statusFilter}`,
      rows: rows.map(r => ({ ...r, nama: `${r.nama_siswa}\n${r.kelas}`, judul_lomba: r.penyelenggara ? `${r.judul_lomba}\n(${r.penyelenggara})` : r.judul_lomba })),
      labelNama: 'Nama Siswa',
      tampilStatus: statusFilter === 'Semua'
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal membuat laporan prestasi', error: err.message });
  }
});

// GET /api/laporan/prestasi-guru-pdf?status=... (ADMIN ONLY)
router.get('/prestasi-guru-pdf', verifyToken, requireAdmin, async (req, res) => {
  const statusFilter = ['Disetujui', 'Menunggu', 'Ditolak', 'Semua'].includes(req.query.status) ? req.query.status : 'Disetujui';

  try {
    const params = [];
    let where = '';
    if (statusFilter !== 'Semua') { where = 'WHERE pg.status = ?'; params.push(statusFilter); }

    const [rows] = await pool.query(
      `SELECT pg.*, u.username
       FROM prestasi_guru pg
       JOIN users u ON pg.user_id = u.id
       ${where}
       ORDER BY ${urutanPrestasi('pg')}`,
      params
    );

    buatPdfPrestasi(res, {
      judul: 'Laporan Prestasi Guru',
      namaFile: 'laporan-prestasi-guru.pdf',
      infoFilter: `Status: ${statusFilter}`,
      rows: rows.map(r => ({ ...r, nama: r.username, judul_lomba: r.penyelenggara ? `${r.judul_lomba}\n(${r.penyelenggara})` : r.judul_lomba })),
      labelNama: 'Nama Guru',
      tampilStatus: statusFilter === 'Semua'
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal membuat laporan prestasi guru', error: err.message });
  }
});

module.exports = router;