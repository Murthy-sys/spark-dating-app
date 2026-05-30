import { Router } from 'express';
import {
  likeUser,
  getMatches,
  getLikesReceived,
  unmatch,
  starUser,
  unstarUser,
  getStarredUsers,
  getLikedUsers,
  unlikeUser,
  getDailyStatus,
} from '../controllers/matchController';
import { protect } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/subscription';

const router = Router();

router.use(protect);

// ─── Free for everyone ────────────────────────────────────────────────────────
router.post('/like/:userId',      likeUser);
router.delete('/unlike/:userId',  unlikeUser);
router.get('/daily-status',       getDailyStatus);
router.get('/liked',              getLikedUsers);
router.get('/',                   getMatches);
router.delete('/:matchId',        unmatch);

// ─── Premium-only (requires active Spark Premium subscription) ────────────────
router.post('/star/:userId',      requireActiveSubscription, starUser);
router.delete('/star/:userId',    requireActiveSubscription, unstarUser);
router.get('/starred',            requireActiveSubscription, getStarredUsers);
router.get('/likes-received',     requireActiveSubscription, getLikesReceived);

export default router;
