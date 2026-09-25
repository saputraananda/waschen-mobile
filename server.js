import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import loginRoutes from './api/routes/auth/login.routes.js';
import biometricsRoutes from './api/routes/auth/biometrics.routes.js';
import profileRoutes from './api/routes/profile/profile.routes.js';
import attendanceRoutes from './api/routes/attendance/attendance.routes.js';
import leaveRoutes from './api/routes/leave/leave.routes.js';
import kasbonRoutes from './api/routes/kasbon/kasbon.routes.js';
import produksiRoutes from './api/routes/produksi/produksi.routes.js';
import deliveryRoutes from './api/routes/delivery/delivery.routes.js';
import overtimeRoutes from './api/routes/overtime/overtime.routes.js';
import historyRoutes from './api/routes/history/history.routes.js';
import realtimeRoutes from './api/routes/realtime/realtime.routes.js';
import { getBaseUploadDir } from './api/middleware/upload.js';
import { initSocket } from './api/socket/io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 9001;

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === 'object' && !Array.isArray(body) && 'error' in body) {
        const { error, ...safe } = body;
        return originalJson(safe);
      }
      return originalJson(body);
    };
    next();
  });
}

app.use('/uploads', express.static(getBaseUploadDir()));

app.use('/api/auth', loginRoutes);
app.use('/api/auth', biometricsRoutes);
app.use('/api/employee', profileRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/kasbon', kasbonRoutes);
app.use('/api/progress', produksiRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/realtime', realtimeRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Waschen Mobile API + Socket.IO. Frontend: port 9000.');
  });
}

initSocket(server);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection', err?.stack || err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err?.stack || err?.message || err);
});

server.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`=========================================`);
    console.log(`  Waschen Mobile API + Socket.IO`);
    console.log(`  Port:   http://localhost:${PORT}`);
    console.log(`=========================================`);
  }
});

export default app;
