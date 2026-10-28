const mysql = require('mysql2/promise');
require('dotenv').config();

// hidupkan ini kalau db tidak terbaca
// console.log('DEBUG DB_USER:', JSON.stringify(process.env.DB_USER));
// console.log('DEBUG DB_HOST:', JSON.stringify(process.env.DB_HOST));


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;



// -- code sebelumnya yg pakai library pg (postgreSQL) --

// const { Pool } = require('pg');
// require('dotenv').config();

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false }
// });

// module.exports = pool;
