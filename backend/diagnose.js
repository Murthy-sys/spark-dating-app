/**
 * Full OTP diagnostic — run with:
 *   node diagnose.js your@email.com
 *
 * Tests: DB connection → user exists → forgot-password API → email delivery
 */
require('dotenv').config();
const mongoose = require('mongoose');
const http     = require('http');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node diagnose.js your@email.com');
  process.exit(1);
}

const PORT    = process.env.PORT || 5001;
const API_URL = `http://localhost:${PORT}/api`;

// ─── helpers ─────────────────────────────────────────────────────────────────
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = http.request(`${API_URL}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(' Spark OTP Diagnostic');
  console.log('═══════════════════════════════════════════════');
  console.log(`Email : ${email}`);
  console.log(`API   : ${API_URL}`);
  console.log('───────────────────────────────────────────────\n');

  // ── 1. MongoDB ──────────────────────────────────────────────────────────────
  process.stdout.write('1. MongoDB connection ... ');
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/spark_dating',
      { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected');
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    console.log('   → Make sure MongoDB is running: mongod --dbpath /data/db');
    process.exit(1);
  }

  // ── 2. User lookup ──────────────────────────────────────────────────────────
  process.stdout.write(`2. User "${email}" in DB ... `);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
  if (user) {
    console.log(`✅ Found  (id: ${user._id})`);
  } else {
    console.log('❌ NOT FOUND');
    console.log('   → This email is not registered. You cannot reset its password.');
    console.log('   → Register first via the app, then try forgot-password.');
    await mongoose.disconnect();
    process.exit(1);
  }
  await mongoose.disconnect();

  // ── 3. Backend running? ─────────────────────────────────────────────────────
  process.stdout.write(`3. Backend on port ${PORT} ... `);
  try {
    const healthRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}/health`, (r) => {
        let b = ''; r.on('data', c => b += c); r.on('end', () => resolve(b));
      }).on('error', reject);
    });
    console.log('✅ Running', healthRes.slice(0, 60));
  } catch {
    console.log(`❌ Cannot reach localhost:${PORT}`);
    console.log('   → Start the backend first: npm run dev (in the backend folder)');
    process.exit(1);
  }

  // ── 4. forgot-password API ──────────────────────────────────────────────────
  process.stdout.write('4. POST /auth/forgot-password ... ');
  let otpFromServer = '';
  try {
    const { status, body } = await post('/auth/forgot-password', { email });
    if (status === 429) {
      console.log('❌ RATE LIMITED (429)');
      console.log('   → You have hit the 10-request limit. Wait 15 minutes or restart the backend.');
      process.exit(1);
    }
    console.log(`HTTP ${status}`);
    console.log('   Response:', JSON.stringify(body, null, 2));
    if (body.otp) {
      otpFromServer = body.otp;
      console.log(`\n   ✅ OTP received from server: ${otpFromServer}`);
    } else {
      console.log('\n   ⚠️  No OTP in response.');
      console.log('   → Check NODE_ENV in backend/.env — it must NOT be "production"');
      console.log('   → Current NODE_ENV:', process.env.NODE_ENV);
    }
  } catch (err) {
    console.log('❌ Request failed:', err.message);
    process.exit(1);
  }

  // ── 5. SMTP test ────────────────────────────────────────────────────────────
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    process.stdout.write('\n5. SMTP verify ... ');
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
      },
    });
    try {
      await t.verify();
      console.log('✅ Gmail SMTP OK');
    } catch (err) {
      console.log('❌ FAILED:', err.message);
      if (err.code === 'EAUTH') {
        console.log('   → App Password is wrong or expired.');
        console.log('   → Generate a new one: https://myaccount.google.com/apppasswords');
        console.log('   → Update SMTP_PASS in backend/.env');
      }
    }
  } else {
    console.log('\n5. SMTP — skipped (SMTP_USER/SMTP_PASS not set)');
  }

  console.log('\n═══════════════════════════════════════════════');
  if (otpFromServer) {
    console.log(`✅ DIAGNOSIS COMPLETE — use OTP ${otpFromServer} in the app`);
  } else {
    console.log('⚠️  DIAGNOSIS COMPLETE — see issues above');
  }
  console.log('═══════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => { console.error('Unexpected:', err); process.exit(1); });
