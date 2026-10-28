const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan, akses ditolak' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa' });
  }
};

// requireGuru: mengizinkan role 'guru' MAUPUN 'admin' (keduanya tetap "staff")
const requireGuru = (req, res, next) => {
  if (req.user.role !== 'guru' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses hanya untuk Guru' });
  }
  next();
};

// requireAdmin: HANYA role 'admin' yang boleh lewat
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses hanya untuk Admin' });
  }
  next();
};

module.exports = { verifyToken, requireGuru, requireAdmin };