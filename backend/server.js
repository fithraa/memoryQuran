require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'rahasia_sementara';

app.use(cors());
app.use(express.json());

// Koneksi ke 1 Database MySQL Bersama (bisa dipakai dari Codespaces maupun Lokal)
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
  // Jika provider MySQL cloud mewajibkan SSL, tambahkan:
  // ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
  if (err) {
    console.error('Gagal konek ke MySQL:', err.message);
    process.exit(1);
  }
  console.log('Terhubung ke MySQL bersama.');
  initTables();
});

function initTables() {
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user'
    )
  `);

  db.query(`
    CREATE TABLE IF NOT EXISTS items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT
    )
  `);

  db.query('SELECT COUNT(*) AS count FROM users', (err, results) => {
    if (!err && results[0].count === 0) {
      const adminPass = bcrypt.hashSync('admin123', 8);
      const userPass = bcrypt.hashSync('user123', 8);

      db.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?), (?, ?, ?)',
        ['admin', adminPass, 'admin', 'budi', userPass, 'user']
      );
      console.log('Akun awal dibuat: admin/admin123 (admin) & budi/user123 (user)');
    }
  });
}

// Middleware JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Token tidak ditemukan!' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token tidak valid!' });
    req.user = decoded;
    next();
  });
};

// Middleware Hak Akses Admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses ditolak! Khusus admin.' });
  }
  next();
};

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const user = results[0];
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Password salah!' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: '2h' }
    );

    res.json({
      username: user.username,
      role: user.role,
      token
    });
  });
});

// CRUD Barang (Baca: semua user terautentikasi | Tambah & Hapus: admin)
app.get('/api/items', verifyToken, (req, res) => {
  db.query('SELECT * FROM items ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/items', verifyToken, isAdmin, (req, res) => {
  const { name, description } = req.body;
  db.query(
    'INSERT INTO items (name, description) VALUES (?, ?)',
    [name, description],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: results.insertId, name, description });
    }
  );
});

app.delete('/api/items/:id', verifyToken, isAdmin, (req, res) => {
  db.query('DELETE FROM items WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Data berhasil dihapus' });
  });
});

// Setting Hak Akses User (Khusus Admin)
app.get('/api/users', verifyToken, isAdmin, (req, res) => {
  db.query('SELECT id, username, role FROM users ORDER BY id ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/users/:id/role', verifyToken, isAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Role tidak valid' });
  }

  db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Hak akses diperbarui' });
  });
});

app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`);
});