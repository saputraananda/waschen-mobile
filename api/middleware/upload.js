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
export const uploadEvidence = createUploader('assets/evidence');
export const uploadLeaveDoc = createUploader('assets/document_leave');
export const uploadProfilePhoto = createUploader('assets/profile_photos');
export const uploadGeneralDoc = createUploader('assets/documents');

export default createUploader;
