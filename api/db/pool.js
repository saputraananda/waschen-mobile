import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Main Waschen database pool (contains users, mst_employee, mst_position, mst_department, mst_outlet)
export const mainPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'waschen',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// secondary my_waschen database pool (contains mst_role)
export const myWaschenPool = mysql.createPool({
  host: process.env.DB_HOST_MY_WASCHEN || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT_MY_WASCHEN) || parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER_MY_WASCHEN || process.env.DB_USER || 'root',
  password: process.env.DB_PASS_MY_WASCHEN || process.env.DB_PASS || '',
  database: process.env.DB_NAME_MY_WASCHEN || 'my_waschen_prod',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
