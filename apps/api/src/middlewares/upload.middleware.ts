import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const avatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      cb(new Error('Use uma imagem JPG, PNG, WEBP ou GIF'));
      return;
    }
    cb(null, true);
  },
});

export function handleAvatarUpload(req: Request, res: Response, next: NextFunction) {
  avatarMulter.single('avatar')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        status: 'error',
        message: 'A foto deve ter no máximo 5 MB',
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Arquivo inválido';
    res.status(400).json({
      status: 'error',
      message,
    });
  });
}
