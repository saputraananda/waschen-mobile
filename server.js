import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import loginRoutes from './api/routes/auth/login.routes.js';
import biometricsRoutes from './api/routes/auth/biometrics.routes.js';
import profileRoutes from './api/routes/profile/profile.routes.js';
import attendanceRoutes from './api/routes/attendance/attendance.routes.js';
import leaveRoutes from './api/routes/leave/leave.routes.js';
import kasbonRoutes from './api/routes/kasbon/kasbon.routes.js';
import produksiRoutes from './api/routes/produksi/produksi.routes.js';
import historyRoutes from './api/routes/history/history.routes.js';
import { getBaseUploadDir } from './api/middleware/upload.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(getBaseUploadDir()));

// API Routes
app.use('/api/auth', loginRoutes);
app.use('/api/auth', biometricsRoutes);
app.use('/api/employee', profileRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/kasbon', kasbonRoutes);
app.use('/api/progress', produksiRoutes);
app.use('/api/history', historyRoutes);

// Serve static assets in production (self-hosted / local only — Vercel serves dist/ separately)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Wildcard handler for client side routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else if (!process.env.VERCEL) {
  app.get('/', (req, res) => {
    res.send('React & Express Starter Pack API Server is running. Frontend dev server is active on port 9000.');
  });
}

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`  React & Express Monorepo Starter Server `);
    console.log(`  Status: Running                        `);
    console.log(`  Port:   http://localhost:${PORT}        `);
    console.log(`=========================================`);
  });
}

export default app;

