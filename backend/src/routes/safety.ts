import { Router } from 'express';
import {
  getSosContacts,
  setSosContacts,
  triggerPanic,
  submitVerification,
  getVerificationStatus,
  updatePrivacy,
} from '../controllers/safetyController';
import { protect } from '../middleware/auth';
import { uploadVideo } from '../middleware/upload';

const router = Router();

router.use(protect);

// SOS contacts
router.get( '/sos-contacts', getSosContacts);
router.put( '/sos-contacts', setSosContacts);

// Panic
router.post('/panic', triggerPanic);

// Verification
router.post('/verification', uploadVideo.single('media'), submitVerification);
router.get( '/verification', getVerificationStatus);

// Privacy
router.patch('/privacy', updatePrivacy);

export default router;
