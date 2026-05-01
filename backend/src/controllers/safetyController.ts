import { Response, NextFunction } from 'express';
import User from '../models/User';
import PanicEvent from '../models/PanicEvent';
import { AuthRequest } from '../middleware/auth';
import { saveVerificationMedia } from '../middleware/upload';
import { computeTrustScore } from '../utils/trustScore';

// ─── SOS Contacts ────────────────────────────────────────────────────────────

export async function getSosContacts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const me = await User.findById(req.user!._id).select('sosContacts');
    res.json({ success: true, contacts: me?.sosContacts ?? [] });
  } catch (err) { next(err); }
}

export async function setSosContacts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const raw = req.body.contacts;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ success: false, message: 'contacts must be an array' });
    }
    if (raw.length > 3) {
      return res.status(400).json({ success: false, message: 'Up to 3 SOS contacts allowed' });
    }
    // Trim + minimal shape check
    const contacts = raw.map((c: any) => ({
      name:  String(c?.name  ?? '').trim(),
      phone: String(c?.phone ?? '').trim(),
    }));
    if (contacts.some((c) => !c.name || !c.phone)) {
      return res.status(400).json({ success: false, message: 'Each contact needs name and phone' });
    }

    const me = await User.findById(req.user!._id);
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });
    me.sosContacts = contacts;
    me.trustScore  = computeTrustScore(me);
    await me.save({ validateBeforeSave: false });

    res.json({ success: true, contacts: me.sosContacts, trustScore: me.trustScore });
  } catch (err) { next(err); }
}

// ─── Panic Trigger ───────────────────────────────────────────────────────────

/**
 * Records a panic event and returns the user's SOS contacts so the client
 * can deep-link the device's native SMS app with a prefilled body.
 *
 * We deliberately do NOT send SMS server-side in Phase 2 — that would need
 * Twilio creds + SMS spend budget. The client-side SMS deep-link is private,
 * free, and works on every phone.
 */
export async function triggerPanic(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude } = req.body ?? {};
    const me = await User.findById(req.user!._id).select('sosContacts displayName');
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });

    const location = (typeof latitude === 'number' && typeof longitude === 'number')
      ? { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] }
      : null;

    const event = await PanicEvent.create({
      user:             me._id,
      triggeredAt:      new Date(),
      location,
      notifiedContacts: me.sosContacts ?? [],
    });

    // Build a ready-to-send SMS body the client can plug into sms: URI
    const mapsLink = location
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : '(location unavailable)';
    const smsBody = `🚨 ${me.displayName} needs help. Location: ${mapsLink}. Sent from Spark.`;

    res.json({
      success:  true,
      eventId:  event._id,
      contacts: me.sosContacts ?? [],
      smsBody,
    });
  } catch (err) { next(err); }
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * User submits a selfie video for verification.
 *
 * Today's gates:
 *   1. Multer upstream rejected non-video files (uploadVideo middleware).
 *   2. Camera-only on the client (gallery is disabled in the UI).
 *
 * Auto-approved by default. Set VERIFICATION_REQUIRE_REVIEW=true to flip
 * to manual review. When a Claude/OpenAI key is wired in, this is the right
 * place to add an AI vision liveness check.
 */
const REQUIRE_REVIEW = process.env.VERIFICATION_REQUIRE_REVIEW === 'true';

export async function submitVerification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No media uploaded' });

    const me = await User.findById(req.user!._id);
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });

    const baseUrl  = `${req.protocol}://${req.get('host')}`;
    const publicId = `verify_${me._id}_${Date.now()}`;
    const { url }  = await saveVerificationMedia(
      req.file.buffer,
      req.file.originalname || 'verify',
      publicId,
      baseUrl,
    );

    const now = new Date();
    me.verification = {
      status:      REQUIRE_REVIEW ? 'pending' : 'verified',
      mediaURL:    url,
      submittedAt: now,
      reviewedAt:  REQUIRE_REVIEW ? undefined : now,
    };
    me.trustScore = computeTrustScore(me);
    await me.save({ validateBeforeSave: false });

    res.status(201).json({
      success:      true,
      verification: me.verification,
      trustScore:   me.trustScore,
    });
  } catch (err) { next(err); }
}

export async function getVerificationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const me = await User.findById(req.user!._id).select('verification trustScore');
    res.json({
      success:      true,
      verification: me?.verification ?? { status: 'unverified' },
      trustScore:   me?.trustScore ?? 0,
    });
  } catch (err) { next(err); }
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

export async function updatePrivacy(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ALLOWED_VIS = ['everyone', 'verified_only', 'matches_only'];
    const incoming    = req.body ?? {};

    const me = await User.findById(req.user!._id);
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });

    if (incoming.visibility !== undefined) {
      if (!ALLOWED_VIS.includes(incoming.visibility)) {
        return res.status(400).json({ success: false, message: 'Invalid visibility' });
      }
      me.privacy.visibility = incoming.visibility;
    }
    if (typeof incoming.hidePhotosUntilMatch === 'boolean') {
      me.privacy.hidePhotosUntilMatch = incoming.hidePhotosUntilMatch;
    }
    if (typeof incoming.hideFromSearch === 'boolean') {
      me.privacy.hideFromSearch = incoming.hideFromSearch;
    }

    await me.save({ validateBeforeSave: false });
    res.json({ success: true, privacy: me.privacy });
  } catch (err) { next(err); }
}
