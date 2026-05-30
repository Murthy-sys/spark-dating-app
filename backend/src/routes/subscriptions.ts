import { Router } from 'express';
import {
  cancelMySubscription,
  createMySubscription,
  getMyPlan,
  getMySubscription,
  seedPlans,
  verifySubscriptionPayment,
} from '../controllers/subscriptionController';
import { protect } from '../middleware/auth';

const router = Router();

// Authenticated routes
router.get('/plan-for-me', protect, getMyPlan);
router.get('/me',          protect, getMySubscription);
router.post('/',           protect, createMySubscription);
router.post('/verify',     protect, verifySubscriptionPayment);
router.post('/cancel',     protect, cancelMySubscription);

// Admin: one-shot helper to provision plans in Razorpay
router.post('/admin/seed-plans', seedPlans);

export default router;
