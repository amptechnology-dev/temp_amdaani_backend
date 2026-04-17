import multer from 'multer';
import path from 'path';
import { ApiError } from '../utils/responseHandler.js';

const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) return cb(null, true);
    cb(new ApiError(400, 'Only images are allowed (jpeg, jpg, png).'));
  },
});


export const uploadAudio = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|mp4/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
      file.mimetype === "audio/mpeg" ||
      file.mimetype === "video/mp4";
    if (mimetype && extname) return cb(null, true);
    cb(
      new ApiError(
        400,
        "Only audio/video files are allowed (mp3, mp4)."
      )
    );
  },
});

export const uploadApk = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {

    const allowedTypes = /apk/;

    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    const mimetype =
      file.mimetype === "application/vnd.android.package-archive" ||
      file.originalname.toLowerCase().endsWith(".apk");

    if (mimetype && extname) return cb(null, true);

    cb(
      new ApiError(
        400,
        "Only APK files are allowed."
      )
    );
  },
});