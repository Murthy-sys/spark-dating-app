/**
 * emailService.ts — Nodemailer wrapper (nodemailer v8, Gmail SMTP)
 *
 * Gmail setup
 * -----------
 * 1. Google Account → Security → 2-Step Verification → ON
 * 2. Google Account → Security → App passwords → create one
 * 3. Copy the 16-char key into backend/.env as SMTP_PASS (spaces are fine)
 *
 * Required .env keys:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx
 */

import nodemailer from 'nodemailer';

// ─── Build one transporter per process ───────────────────────────────────────
// Kept simple on purpose — no pool, no requireTLS, no spread tricks.
// Nodemailer auto-negotiates STARTTLS on port 587 when secure=false.

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',          // uses Gmail's well-known host/port/tls settings
    auth: {
      user: process.env.SMTP_USER!,
      pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    },
  });
}

// ─── Startup verification ─────────────────────────────────────────────────────

export async function verifyEmailService(): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  SMTP_USER / SMTP_PASS not set — email sending disabled.');
    return;
  }

  const t = createTransporter();
  try {
    await t.verify();
    console.log(`✅ SMTP ready — sending as ${process.env.SMTP_USER}`);
  } catch (err: any) {
    console.error('❌ SMTP verify FAILED:', err.message);
    if (err.code === 'EAUTH') {
      console.error('   → Invalid Gmail credentials.');
      console.error('   → Make sure 2-Step Verification is ON and SMTP_PASS is a valid App Password.');
      console.error('   → Generate one at: https://myaccount.google.com/apppasswords');
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'EDNS') {
      console.error('   → Cannot reach smtp.gmail.com — check your internet/firewall.');
    }
  }
}

// ─── Send OTP ─────────────────────────────────────────────────────────────────

export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER / SMTP_PASS not set in backend/.env');
  }

  const t = createTransporter();

  await t.sendMail({
    from:    `"Spark ⚡" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Spark password reset code',
    text: `Your Spark OTP is: ${otp}\n\nExpires in 15 minutes.\nIgnore if you didn't request this.`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#0A0818;border-radius:16px;padding:40px;">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <h1 style="margin:0;color:#FF4B7E;font-size:26px;letter-spacing:5px;font-weight:900;">⚡ SPARK</h1>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:14px;">
            <p style="margin:0;color:#fff;font-size:16px;">Your password reset code:</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <div style="background:#1a1530;border-radius:12px;padding:22px 36px;
                        display:inline-block;border:2px solid #FF4B7E;">
              <span style="font-size:38px;font-weight:900;letter-spacing:10px;
                           color:#FF4B7E;font-family:monospace;">${otp}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center">
            <p style="margin:0;color:#888;font-size:13px;line-height:1.7;">
              Expires in <strong style="color:#FF4B7E;">15 minutes</strong>.<br/>
              Ignore this email if you didn't request it.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// ─── Test helper (used by /api/auth/test-email) ───────────────────────────────

export async function sendTestEmail(to: string): Promise<{ accepted: string[] }> {
  const t = createTransporter();
  const info = await t.sendMail({
    from:    `"Spark ⚡" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Spark SMTP test',
    text:    'If you see this, your SMTP config is working correctly!',
  });
  return { accepted: info.accepted as string[] };
}
