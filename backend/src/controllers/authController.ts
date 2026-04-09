import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { signToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { sendOTPEmail } from '../services/emailService';

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { displayName, email, password, age, gender, dateOfBirth } = req.body;

    // Compute age from DOB if provided
    let computedAge = age;
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let a = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) a--;
      computedAge = a;
      if (computedAge < 18) {
        return res.status(400).json({ success: false, message: 'You must be at least 18 years old.' });
      }
    }

    // Friendly duplicate-email message before Mongoose fires its own error
    const existing = await User.findOne({ email: email?.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({ displayName, email, password, age: computedAge, gender, dateOfBirth });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (err: any) {
    // Translate Mongoose validation errors into readable messages
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)
        .map((e: any) => e.message)
        .join('. ');
      return res.status(400).json({ success: false, message });
    }
    next(err);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    user.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getMe(req: AuthRequest, res: Response) {
  res.json({ success: true, user: req.user!.toSafeObject() });
}

// ─── Update Password ──────────────────────────────────────────────────────────

export async function updatePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id).select('+password');

    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is wrong' });
    }

    user.password = newPassword;
    await user.save();

    const token = signToken(user._id);
    res.json({ success: true, token, message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

// ─── Forgot Password (send OTP) ───────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    console.log('\n🔑 ─── FORGOT-PASSWORD REQUEST ───');
    console.log(`   Email received: "${email}"`);

    if (!email) {
      console.log('   ❌ No email provided');
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const normalised = email.toLowerCase().trim();
    console.log(`   Normalised email: "${normalised}"`);

    const user = await User.findOne({ email: normalised });
    console.log(`   User found in DB: ${user ? 'YES ✅ (id=' + user._id + ')' : 'NO ❌'}`);

    if (!user) {
      console.log('   → Returning generic "not found" response (no OTP generated)');
      return res.json({
        success: true,
        message: 'If that email is registered, an OTP has been sent.',
        userNotFound: true,   // <-- helps frontend show better message in dev
      });
    }

    // Generate 6-digit OTP, valid 15 minutes
    const otp = String(Math.floor(100_000 + Math.random() * 900_000));
    user.resetOTP       = otp;
    user.resetOTPExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    console.log(`   OTP generated: ${otp}  (expires in 15m)`);

    const isDev          = process.env.NODE_ENV !== 'production';
    const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    console.log(`   isDev=${isDev}, smtpConfigured=${smtpConfigured}`);

    let emailSent  = false;
    let emailError = '';

    if (smtpConfigured) {
      try {
        console.log(`   Sending OTP email FROM ${process.env.SMTP_USER} TO ${user.email}...`);
        await sendOTPEmail(user.email, otp);
        emailSent = true;
        console.log(`   ✅ OTP email sent successfully to ${user.email}`);
      } catch (emailErr: any) {
        emailError = emailErr.message;
        console.error(`   ❌ OTP email FAILED [${emailErr.code}]: ${emailErr.message}`);

        if (!isDev) {
          user.resetOTP       = undefined;
          user.resetOTPExpiry = undefined;
          await user.save({ validateBeforeSave: false });
          return res.status(500).json({
            success: false,
            message: 'Failed to send OTP email. Please try again later.',
          });
        }
        console.error('   (dev mode) OTP will be returned in the API response so you can test without email.');
      }
    }

    const responseBody = {
      success: true,
      message: emailSent
        ? `OTP sent to ${user.email}. Check your inbox (or spam).`
        : smtpConfigured
          ? `Email delivery failed. Please try again later.`
          : `Email service not configured. Please contact support.`,
      ...(isDev && emailError && { emailError }),
    };
    console.log(`   Response →`, JSON.stringify(responseBody));
    console.log('🔑 ─── END FORGOT-PASSWORD ───\n');

    return res.json(responseBody);
  } catch (err) {
    console.error('   💥 forgotPassword EXCEPTION:', err);
    next(err);
  }
}

// ─── Reset Password (verify OTP + set new password) ──────────────────────────

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetOTP +resetOTPExpiry +password');

    if (!user || user.resetOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }
    if (!user.resetOTPExpiry || user.resetOTPExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    user.password       = newPassword;
    user.resetOTP       = undefined;
    user.resetOTPExpiry = undefined;
    await user.save();

    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toSafeObject(), message: 'Password reset successfully.' });
  } catch (err) {
    next(err);
  }
}
