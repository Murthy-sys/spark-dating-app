import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// ─── Detect whether Cloudinary is properly configured ─────────────────────────
const CLOUDINARY_CONFIGURED =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured — uploads go to Cloudinary');
} else {
  console.log('⚠️  Cloudinary not configured — uploads saved to local /uploads folder');
}

// ─── Local uploads directory ──────────────────────────────────────────────────
export const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

// ─── Multer — memory storage ──────────────────────────────────────────────────
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── Main upload function ─────────────────────────────────────────────────────
// baseUrl: pass req.protocol + '://' + req.get('host') from the controller
// so that local URLs use the real network IP, not localhost
export async function uploadImage(
  buffer: Buffer,
  publicId: string,
  folder = 'spark/profiles',
  baseUrl?: string,                  // ← caller passes this for local fallback
): Promise<{ url: string; publicId: string }> {
  if (CLOUDINARY_CONFIGURED) {
    return _uploadToCloudinary(buffer, folder, publicId);
  }
  return _saveToLocalDisk(buffer, publicId, baseUrl);
}

// ─── Cloudinary implementation ────────────────────────────────────────────────
function _uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const options: any = {
      folder,
      transformation: [
        { width: 800, height: 1000, crop: 'fill', quality: 'auto' },
        { fetch_format: 'auto' },
      ],
    };
    if (publicId) options.public_id = publicId;

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        console.error('Cloudinary upload error:', error);
        return reject(error ?? new Error('Cloudinary upload failed'));
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ─── Local disk fallback ──────────────────────────────────────────────────────
async function _saveToLocalDisk(
  buffer: Buffer,
  publicId: string,
  baseUrl?: string,
): Promise<{ url: string; publicId: string }> {
  const safeFilename = publicId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.jpg';
  const filePath = path.join(LOCAL_UPLOADS_DIR, safeFilename);

  fs.writeFileSync(filePath, buffer);

  // Use the provided baseUrl (from req.get('host')) so the device can
  // reach the file over any network (LAN, tunnel, production).
  // Never fall back to localhost — it's unreachable from physical devices.
  const resolvedBase =
    baseUrl ||
    process.env.SERVER_BASE_URL ||
    `http://0.0.0.0:${process.env.PORT || 5001}`;

  if (!baseUrl && !process.env.SERVER_BASE_URL) {
    console.warn(
      '[upload] ⚠️  No baseUrl from request and SERVER_BASE_URL not set. ' +
      'Uploaded image URLs will use 0.0.0.0 which may not be reachable. ' +
      'Always pass req.protocol + "://" + req.get("host") from the controller.',
    );
  }

  const url = `${resolvedBase}/uploads/${safeFilename}`;
  return { url, publicId: safeFilename };
}

// ─── Delete image ─────────────────────────────────────────────────────────────
export async function deleteImage(publicId: string): Promise<void> {
  if (CLOUDINARY_CONFIGURED) {
    await cloudinary.uploader.destroy(publicId);
  } else {
    const filePath = path.join(LOCAL_UPLOADS_DIR, publicId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

// ─── Legacy alias ─────────────────────────────────────────────────────────────
export { _uploadToCloudinary as uploadToCloudinary };
