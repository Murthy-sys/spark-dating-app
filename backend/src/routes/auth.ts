import { Router, Request, Response } from 'express';
import { register, login, getMe, updatePassword, forgotPassword, resetPassword } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { sendTestEmail } from '../services/emailService';

const router = Router();

router.post('/register',         register);
router.post('/login',            login);
router.get('/me',                protect, getMe);
router.patch('/update-password', protect, updatePassword);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   resetPassword);

// ── Dev-only: POST /api/auth/test-email  { "to": "you@example.com" }
// Remove this route before going to production.
router.post('/test-email', async (req: Request, res: Response) => {
  try {
    const to = req.body.to || process.env.SMTP_USER;
    const result = await sendTestEmail(to);
    res.json({ success: true, message: `Test email sent to ${to}`, ...result });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message:  err.message,
      code:     err.code,
      response: err.response,
    });
  }
});

export default router;
