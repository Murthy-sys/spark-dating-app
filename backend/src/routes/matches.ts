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
} from '../controllers/matchController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/like/:userId',      likeUser);
router.post('/star/:userId',      starUser);
router.delete('/star/:userId',    unstarUser);
router.delete('/unlike/:userId',  unlikeUser);
router.get('/starred',            getStarredUsers);
router.get('/liked',              getLikedUsers);
router.get('/',                   getMatches);
router.get('/likes-received',     getLikesReceived);
router.delete('/:matchId',        unmatch);

export default router;
