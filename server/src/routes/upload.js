import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware/auth.js';
import { permError } from '../helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/|video\/|audio\//.test(file.mimetype);
    cb(ok ? null : new Error('仅支持图片、视频、音频'), ok);
  },
});

const router = Router();

router.post('/', requireAuth,
  (req, res, next) => { const pe = permError(req.user, 'upload'); if (pe) return res.status(403).json({ error: pe }); next(); },
  upload.array('files', 9), (req, res) => {
  const files = (req.files || []).map(f => ({
    url: `/uploads/${f.filename}`,
    type: f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('video/') ? 'video' : 'audio',
    name: f.originalname,
  }));
  res.json({ files });
});

export default router;
