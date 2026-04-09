import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  sendImageMessage,
} from '../controllers/messageController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(protect);

router.get('/:matchId',                           getMessages);
router.post('/:matchId',                          sendMessage);
router.post('/:matchId/image', upload.single('image'), sendImageMessage);

export default router;
