import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  updateLocation,
  uploadPhoto,
  deletePhoto,
  blockUser,
  reportUser,
  deactivateAccount,
  getNearbyUsers,
} from '../controllers/userController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(protect); // all user routes require auth

// ── Specific /me routes BEFORE /:id to avoid param collision ─────────────────
router.get('/nearby',          getNearbyUsers);      // GET  /users/nearby?radius=10&limit=20
router.patch('/me',            updateProfile);       // PATCH /users/me
router.patch('/me/location',   updateLocation);      // PATCH /users/me/location
router.post('/me/photos',      upload.single('photo'), uploadPhoto);
router.delete('/me/photos/:index', deletePhoto);
router.delete('/me',           deactivateAccount);

// ── Per-user routes ───────────────────────────────────────────────────────────
router.get('/:id',             getProfile);          // GET  /users/:id
router.post('/:id/block',      blockUser);           // POST /users/:id/block
router.post('/:id/report',     reportUser);          // POST /users/:id/report

export default router;
