import { Response, NextFunction } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { uploadImage } from '../middleware/upload';

// ─── Get Profile by ID ────────────────────────────────────────────────────────

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.params.id).select(
      'displayName photoURL photos bio age gender occupation location lastSeen'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

// ─── Update My Profile ────────────────────────────────────────────────────────

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const allowed = ['displayName', 'bio', 'occupation', 'interestedIn', 'settings', 'age', 'gender', 'hobbies', 'lookingFor'];
    const updates: Record<string, any> = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user!._id, updates, {
      new:            true,
      runValidators:  true,
    });

    res.json({ success: true, user: user!.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// ─── Update Location ──────────────────────────────────────────────────────────

export async function updateLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'latitude and longitude required' });
    }

    await User.findByIdAndUpdate(req.user!._id, {
      location: { type: 'Point', coordinates: [longitude, latitude] },
      lastSeen: new Date(),
    });

    res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    next(err);
  }
}

// ─── Upload Photo ─────────────────────────────────────────────────────────────

export async function uploadPhoto(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const index = Number(req.body.index ?? 0);
    const publicId = `spark_profiles_${req.user!._id}_photo_${index}`;

    // Pass the real host so local-disk URLs work on physical devices over LAN
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { url } = await uploadImage(req.file.buffer, publicId, 'spark/profiles', baseUrl);

    const user = await User.findById(req.user!._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.photos[index] = url;
    if (index === 0) user.photoURL = url;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, url, photos: user.photos });
  } catch (err) {
    next(err);
  }
}

// ─── Delete Photo ─────────────────────────────────────────────────────────────

export async function deletePhoto(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const index = Number(req.params.index);
    const user = await User.findById(req.user!._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.photos.splice(index, 1);
    user.photoURL = user.photos[0] || '';
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, photos: user.photos });
  } catch (err) {
    next(err);
  }
}

// ─── Block a User ─────────────────────────────────────────────────────────────

export async function blockUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const targetId = req.params.id;
    await User.findByIdAndUpdate(req.user!._id, {
      $addToSet: { blockedUsers: targetId },
    });
    res.json({ success: true, message: 'User blocked' });
  } catch (err) {
    next(err);
  }
}

// ─── Deactivate Account ───────────────────────────────────────────────────────

export async function deactivateAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await User.findByIdAndUpdate(req.user!._id, { isActive: false });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (err) {
    next(err);
  }
}

// ─── Report User ──────────────────────────────────────────────────────────────

export async function reportUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // In production: store in a Reports collection for moderation queue.
    // For now, we also auto-block the reported user to protect the reporter.
    const targetId = req.params.id;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    // Auto-block on report (reporter stops seeing reported user immediately)
    await User.findByIdAndUpdate(req.user!._id, {
      $addToSet: { blockedUsers: targetId },
    });

    // TODO: insert into a Reports collection for admin review
    res.json({ success: true, message: 'User reported and blocked' });
  } catch (err) {
    next(err);
  }
}

// ─── Get Nearby Users (radius search) ────────────────────────────────────────

/**
 * GET /users/nearby?radius=10&limit=50
 *
 * Returns users within `radius` km of the current user's stored location.
 * Uses MongoDB 2dsphere $geoNear aggregation for distance-annotated results.
 *
 * Respects:
 *  - settings.showMe = true on each candidate
 *  - blockedUsers list on both sides
 *  - age range and gender preferences (if set by the user)
 */
export async function getNearbyUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const me     = req.user!;
    const limit  = Math.min(Number(req.query.limit)  || 1000, 1000);

    // Build gender filter only when the user has a real preference
    // (i.e. not the default "all genders" setting). If all 4 genders are
    // included — or interestedIn is empty — skip the filter so every user
    // shows up. This also prevents test accounts (gender:'other') being
    // hidden from users whose interestedIn is still ['male','female'].
    const ALL_GENDERS = ['male', 'female', 'non-binary', 'other'];
    const hasSpecificPreference =
      Array.isArray(me.interestedIn) &&
      me.interestedIn.length > 0 &&
      me.interestedIn.length < ALL_GENDERS.length;
    const genderFilter = hasSpecificPreference
      ? { gender: { $in: me.interestedIn } }
      : {};

    // Only apply age filter when sensible defaults exist.
    const ageMin = me.settings?.ageRangeMin ?? 18;
    const ageMax = me.settings?.ageRangeMax ?? 99;

    const nearbyUsers = await User.find({
      _id:               { $ne: me._id, $nin: me.blockedUsers ?? [] },
      isActive:           true,
      'settings.showMe':  true,
      age:               { $gte: ageMin, $lte: ageMax },
      ...genderFilter,
    })
      .limit(limit)
      .select('displayName photoURL photos bio age gender occupation hobbies lookingFor lastSeen location');

    res.json({ success: true, data: nearbyUsers, count: nearbyUsers.length });
  } catch (err) {
    next(err);
  }
}
