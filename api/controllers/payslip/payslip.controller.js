import fs from 'fs';
import path from 'path';
import { myWaschenPool } from '../../db/pool.js';
import { payslipAbsPath } from '../../middleware/upload.js';

const MIME = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

export const listMyPayslips = async (req, res) => {
  try {
    const employeeId = Number(req.user.employee_id);
    const [rows] = await myWaschenPool.query(
      `SELECT id, employee_id, payslip_month, file_name, created_at, updated_at
       FROM tr_payslip_waschen
       WHERE employee_id = ?
       ORDER BY payslip_month DESC, id DESC`,
      [employeeId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('listMyPayslips:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat slip gaji' });
  }
};

export const viewMyPayslip = async (req, res) => {
  try {
    const employeeId = Number(req.user.employee_id);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Slip tidak valid' });
    const [rows] = await myWaschenPool.query(
      'SELECT file_path, file_name FROM tr_payslip_waschen WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Slip gaji tidak ditemukan' });
    const abs = payslipAbsPath(rows[0].file_path);
    if (!abs || !fs.existsSync(abs)) {
      return res.status(404).json({ success: false, message: 'File slip gaji tidak ada di server' });
    }
    const ext = path.extname(abs).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(rows[0].file_name || path.basename(abs))}"`);
    return fs.createReadStream(abs).pipe(res);
  } catch (error) {
    console.error('viewMyPayslip:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuka slip gaji' });
  }
};
