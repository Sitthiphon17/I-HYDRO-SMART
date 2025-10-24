const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// เชื่อมต่อ SQLite Database
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// สร้างตารางเก็บข้อมูลเซนเซอร์
db.run(`
  CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    temperature REAL,
    humidity REAL,
    light REAL,
    ec REAL,
    tds REAL,
    ph REAL,
    water_level REAL
  )
`, (err) => {
  if (err) console.error('❌ Error creating table:', err.message);
  else console.log('✅ Table sensor_data ready');
});

// 📌 API: รับข้อมูลจาก Arduino (POST)
app.post('/api/data', (req, res) => {
  const { temperature, humidity, light, ec, tds, ph, water_level } = req.body;

  const sql = `INSERT INTO sensor_data (temperature, humidity, light, ec, tds, ph, water_level) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [temperature, humidity, light, ec, tds, ph, water_level], function(err) {
    if (err) {
      console.error('❌ Error inserting data:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ Data inserted: ID ${this.lastID}`);
    res.json({ success: true, id: this.lastID });
  });
});

// 📌 API: ดึงข้อมูลล่าสุด (GET)
app.get('/api/data/latest', (req, res) => {
  const sql = `SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1`;

  db.get(sql, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || {});
  });
});

// 📌 API: ดึงข้อมูลย้อนหลัง (สำหรับกราฟ)
app.get('/api/data/history', (req, res) => {
  const limit = req.query.limit || 50;
  const sql = `SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT ?`;

  db.all(sql, [limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.reverse()); // เรียงจากเก่าไปใหม่
  });
});

// 📌 API: ลบข้อมูลทั้งหมด (สำหรับทดสอบ)
app.delete('/api/data/clear', (req, res) => {
  db.run(`DELETE FROM sensor_data`, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, deleted: this.changes });
  });
});

// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});