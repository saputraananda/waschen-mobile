import fs from 'fs';
import path from 'path';
import multer from 'multer';

/**
 * Get base upload directory path from UPLOAD_BASE_DIR environment variable
 * Fallback to local 'uploads' directory if not specified
 */
export const getBaseUploadDir = () => {
  const envDir = process.env.UPLOAD_BASE_DIR ? process.env.UPLOAD_BASE_DIR.trim() : '';
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }
  // Local development default fallback: <project_root>/uploads
  return path.resolve(process.cwd(), 'uploads');
};

/**
 * Automatically creates target subfolder inside UPLOAD_BASE_DIR if it doesn't exist yet
 * 
 * @param {string} subFolder - Relative subfolder path (e.g. 'assets/evidence', 'assets/document_leave')
 * @returns {string} Absolute path of created folder
 */
export const ensureUploadFolder = (subFolder = '') => {
  const baseDir = getBaseUploadDir();
  const targetDir = subFolder ? path.join(baseDir, subFolder) : baseDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return targetDir;
};

/**
 * Dynamic Multer Upload Middleware Factory
 * Automatically checks and creates subfolders inside process.env.UPLOAD_BASE_DIR
 * 
 * @param {string} subFolder - Subfolder path (e.g. 'assets/evidence', 'assets/document_leave')
 * @param {Object} options - Custom options (fileTypes, maxFileSize)
 */
export const createUploader = (subFolder = 'assets/documents', options = {}) => {
  const {
    fileTypes = /jpeg|jpg|png|webp|pdf|doc|docx/,
    maxFileSize = 10 * 1024 * 1024 // Default 10MB
  } = options;

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const targetPath = ensureUploadFolder(subFolder);
        cb(null, targetPath);
      } catch (err) {
        cb(err, null);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const nameWithoutExt = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${nameWithoutExt}_${uniqueSuffix}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype.toLowerCase());

    if (extName || mimeType) {
      return cb(null, true);
    }
    cb(new Error(`Tipe file tidak didukung (${file.originalname}). Format yang diperbolehkan: ${fileTypes}`));
  };

  return multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter
  });
};

// Convenient pre-configured upload middlewares for specific subfolders
export const ATTENDANCE_UPLOAD_SUBFOLDER = 'assets/attendance';
export const ATTENDANCE_UPLOAD_PUBLIC_PATH = '/uploads/assets/attendance';

export const getAttendancePhotoFilePath = (photoName) => {
  if (!photoName) return null;
  return path.join(ensureUploadFolder(ATTENDANCE_UPLOAD_SUBFOLDER), photoName);
};

export const deleteAttendancePhotoFile = async (photoName) => {
  const filePath = getAttendancePhotoFilePath(photoName);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Gagal menghapus foto absensi: ${filePath}`, err);
    }
  }
};

export const uploadEvidence = createUploader('assets/evidence');
export const uploadLeaveDoc = createUploader('assets/document_leave');
export const uploadProfilePhoto = createUploader('assets/profile_photos');
export const uploadGeneralDoc = createUploader('assets/documents');

/**
 * Attendance selfie uploader — images only, stored in assets/attendance
 */
const attendanceSelfieStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const targetPath = ensureUploadFolder(ATTENDANCE_UPLOAD_SUBFOLDER);
      cb(null, targetPath);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const employeeId = safe(req.user?.employee_id || req.user?.employeeId || 'unknown');
    const punchType = safe(req.body?.punch_type || 'punch');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `attendance_${employeeId}_${punchType}_${ts}${ext}`);
  }
});

const selfieFileFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype || '');
  if (!ok) return cb(new Error('Foto absensi harus berupa gambar (jpeg/png/webp).'));
  cb(null, true);
};

export const uploadAttendanceSelfie = multer({
  storage: attendanceSelfieStorage,
  fileFilter: selfieFileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }
});

/**
 * Leave doctor-note uploader — images only, stored in assets/leave
 */
export const LEAVE_UPLOAD_SUBFOLDER = 'assets/leave';
export const LEAVE_UPLOAD_PUBLIC_PATH = '/uploads/assets/leave';

export const getLeaveDocFilePath = (fileName) => {
  if (!fileName) return null;
  return path.join(ensureUploadFolder(LEAVE_UPLOAD_SUBFOLDER), fileName);
};

export const deleteLeaveDocFile = async (fileName) => {
  const filePath = getLeaveDocFilePath(fileName);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Gagal menghapus surat dokter: ${filePath}`, err);
    }
  }
};

const leaveDoctorNoteStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const targetPath = ensureUploadFolder(LEAVE_UPLOAD_SUBFOLDER);
      cb(null, targetPath);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const employeeId = safe(req.user?.employee_id || req.user?.employeeId || 'unknown');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `leave_${employeeId}_${ts}${ext}`);
  }
});

const leaveDoctorNoteFileFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype || '');
  if (!ok) return cb(new Error('Surat dokter harus berupa gambar (jpeg/png/webp).'));
  cb(null, true);
};

export const uploadDoctorNote = multer({
  storage: leaveDoctorNoteStorage,
  fileFilter: leaveDoctorNoteFileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }
});

/**
 * Kasbon/Pinjaman proof-photo uploader — images only, stored in assets/kasbon
 */
export const KASBON_UPLOAD_SUBFOLDER = 'assets/kasbon';
export const KASBON_UPLOAD_PUBLIC_PATH = '/uploads/assets/kasbon';

export const getKasbonProofFilePath = (fileName) => {
  if (!fileName) return null;
  return path.join(ensureUploadFolder(KASBON_UPLOAD_SUBFOLDER), fileName);
};

export const deleteKasbonProofFile = async (fileName) => {
  const filePath = getKasbonProofFilePath(fileName);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Gagal menghapus foto bukti kasbon: ${filePath}`, err);
    }
  }
};

const kasbonProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const targetPath = ensureUploadFolder(KASBON_UPLOAD_SUBFOLDER);
      cb(null, targetPath);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const employeeId = safe(req.user?.employee_id || req.user?.employeeId || 'unknown');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `kasbon_${employeeId}_${ts}${ext}`);
  }
});

const kasbonProofFileFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype || '');
  if (!ok) return cb(new Error('Foto bukti harus berupa gambar (jpeg/png/webp).'));
  cb(null, true);
};

export const uploadKasbonProof = multer({
  storage: kasbonProofStorage,
  fileFilter: kasbonProofFileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }
});

/**
 * Produksi QC photo uploader — images only, multiple (max 5)
 * Path: assets/produksi/{stage}/  (frontliner | washing | ironing | packing | delivery)
 */
export const PRODUKSI_UPLOAD_BASE = 'assets/produksi';
export const PRODUKSI_STAGES = ['frontliner', 'washing', 'ironing', 'packing', 'delivery'];

export const normalizeProduksiStage = (stage) => {
  const s = String(stage || '').toLowerCase();
  return PRODUKSI_STAGES.includes(s) ? s : 'frontliner';
};

export const getProduksiUploadSubfolder = (stage) =>
  `${PRODUKSI_UPLOAD_BASE}/${normalizeProduksiStage(stage)}`;

export const getProduksiPhotoPublicPath = (stage) =>
  `/uploads/${getProduksiUploadSubfolder(stage)}`;

export const getProduksiPhotoFilePath = (stage, fileName) => {
  if (!fileName) return null;
  return path.join(ensureUploadFolder(getProduksiUploadSubfolder(stage)), fileName);
};

export const buildProduksiPhotoFileName = (req, file, index = 0) => {
  const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
  const ext = path.extname(file?.originalname || '').toLowerCase() || '.jpg';
  const detailId = safe(req.body?.transaction_detail_id || 'item');
  const stage = normalizeProduksiStage(req.body?.stage);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = Math.round(Math.random() * 1e4) + index;
  return `produksi_${detailId}_${stage}_${ts}_${rand}${ext}`;
};

/** Simpan buffer foto ke disk — dipanggil SETELAH record QC tersimpan di DB */
export const saveProduksiPhotoBuffers = async (stage, files, req) => {
  const saved = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file?.buffer) continue;
    const fileName = buildProduksiPhotoFileName(req, file, i);
    const filePath = getProduksiPhotoFilePath(stage, fileName);
    await fs.promises.writeFile(filePath, file.buffer);
    saved.push({ fileName, filePath });
  }
  return saved;
};

/** Hapus foto — terima path absolut, path publik DB, atau (stage, fileName) */
export const deleteProduksiPhotoFile = async (stageOrPath, fileName) => {
  let filePath = null;

  if (fileName) {
    filePath = getProduksiPhotoFilePath(stageOrPath, fileName);
  } else if (stageOrPath) {
    const raw = String(stageOrPath);
    if (raw.startsWith('/uploads/')) {
      filePath = path.join(getBaseUploadDir(), raw.replace(/^\/uploads\//, ''));
    } else if (path.isAbsolute(raw)) {
      filePath = raw;
    } else {
      // legacy: assets/progress/{filename}
      filePath = path.join(ensureUploadFolder('assets/progress'), raw);
    }
  }

  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Gagal menghapus foto produksi: ${filePath}`, err);
    }
  }
};

const produksiPhotoFileFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype || '');
  if (!ok) return cb(new Error('Foto produksi harus berupa gambar (jpeg/png/webp).'));
  cb(null, true);
};

/** Memory storage — file baru ditulis ke disk setelah QC tersimpan di database */
export const uploadProduksiPhotos = multer({
  storage: multer.memoryStorage(),
  fileFilter: produksiPhotoFileFilter,
  limits: { fileSize: 6 * 1024 * 1024, files: 5 }
});

/** @deprecated gunakan uploadProduksiPhotos */
export const uploadProgressPhotos = uploadProduksiPhotos;

export default createUploader;
