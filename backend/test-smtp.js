/**
 * Standalone SMTP diagnostic — run with:
 *   node test-smtp.js
 *
 * Reads .env automatically and sends a real test email.
 * Use this to confirm SMTP works before debugging the server.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.SMTP_USER;
const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

if (!user || !pass) {
  console.error('❌ SMTP_USER or SMTP_PASS missing in .env');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SMTP Diagnostics for Spark');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Host  : ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
console.log(`Port  : ${process.env.SMTP_PORT || 587}`);
console.log(`User  : ${user}`);
console.log(`Pass  : ${'*'.repeat(pass.length)} (${pass.length} chars)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
});

async function run() {
  // Step 1: Verify credentials
  console.log('Step 1/2  Verifying SMTP credentials...');
  try {
    await transporter.verify();
    console.log('✅ Credentials OK\n');
  } catch (err) {
    console.error('❌ VERIFY FAILED');
    console.error('   Message :', err.message);
    console.error('   Code    :', err.code);
    if (err.code === 'EAUTH') {
      console.error('\n   ┌──────────────────────────────────────────────┐');
      console.error('   │  Authentication failed. Try these steps:      │');
      console.error('   │  1. Confirm 2-Step Verification is ON         │');
      console.error('   │  2. Generate a NEW App Password at:           │');
      console.error('   │     https://myaccount.google.com/apppasswords │');
      console.error('   │  3. Paste it into backend/.env as SMTP_PASS   │');
      console.error('   └──────────────────────────────────────────────┘');
    }
    process.exit(1);
  }

  // Step 2: Send a real test email
  console.log(`Step 2/2  Sending test email to ${user}...`);
  try {
    const info = await transporter.sendMail({
      from:    `"Spark Test" <${user}>`,
      to:      user,
      subject: '✅ Spark SMTP test — it works!',
      text:    'Your SMTP configuration is working correctly. OTP emails will be delivered.',
    });
    console.log('✅ Email sent!');
    console.log('   MessageId :', info.messageId);
    console.log('   Accepted  :', info.accepted);
    console.log('\n📬 Check your inbox (and Spam folder) at:', user);
  } catch (err) {
    console.error('❌ SEND FAILED');
    console.error('   Message  :', err.message);
    console.error('   Code     :', err.code);
    console.error('   Response :', err.response);
    process.exit(1);
  }
}

run();
