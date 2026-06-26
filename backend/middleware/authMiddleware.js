const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan, akses ditolak' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa' });
  }
};

const requireGuru = (req, res, next) => {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ message: 'Akses hanya untuk Guru' });
  }
  next();
};

module.exports = { verifyToken, requireGuru };