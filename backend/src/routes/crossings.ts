import { Router } from 'express';
import { reportLocation, getCrossedPaths } from '../controllers/crossingController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/location',  reportLocation);   // POST location → detect crossings
router.get('/',           getCrossedPaths);  // GET crossed-paths feed

export default router;
