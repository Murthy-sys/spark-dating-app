import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Crossing from '../models/Crossing';
import LocationHistory from '../models/LocationHistory';
import User from '../models/User';
import Like from '../models/Like';
import { AuthRequest } from '../middleware/auth';

const CROSSING_RADIUS_METERS = 10_000;

// ─── Report Location & Detect Crossings ──────────────────────────────────────

/**
 * POST /crossings/location
 *
 * Called by the mobile app every ~30 seconds.
 * 1. Updates user's live location
 * 2. Saves a LocationHistory record (TTL: 30 days)
 * 3. Runs MongoDB $near to find users within CROSSING_RADIUS_METERS
 * 4. Upserts Crossing records with bulkWrite (single DB round-trip)
 */
export async function reportLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude, accuracy, speed } = req.body;
    const myId = req.user!._id;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'latitude and longitude required' });
    }

    const coordinates: [number, number] = [longitude, latitude]; // GeoJSON: [lng, lat]

    // 1. Update live location + lastSeen (fire-and-forget style with Promise.all)
    await Promise.all([
      User.findByIdAndUpdate(myId, {
        location: { type: 'Point', coordinates },
        lastSeen: new Date(),
      }),

      // 2. Persist to location history (TTL index auto-deletes after 30 days)
      LocationHistory.create({
        user:     myId,
        location: { type: 'Point', coordinates },
        accuracy: accuracy ?? null,
        speed:    speed    ?? null,
      }),
    ]);

    // 3. Find nearby active users via 2dsphere $near query
    const nearbyUsers = await User.find({
      _id:               { $ne: myId },
      'settings.showMe':  true,
      isActive:           true,
      blockedUsers:       { $nin: [myId] },  // skip users who blocked me
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates },
          $maxDistance: CROSSING_RADIUS_METERS,
        },
      },
    }).select('_id');

    // 4. Upsert crossing records in a single bulkWrite round-trip
    if (nearbyUsers.length > 0) {
      const crossingOps = nearbyUsers.map((other) => {
        // BUG FIX: was [myId, other._id].map(String).sort() — storing strings.
        // Crossing schema defines users as ObjectId[], so we must keep ObjectIds.
        // Sort by string representation to ensure consistent pair ordering
        // (so [A,B] and [B,A] always resolve to the same document).
        const pair = [new mongoose.Types.ObjectId(myId.toString()), new mongoose.Types.ObjectId(other._id.toString())]
          .sort((a, b) => a.toString().localeCompare(b.toString()));
        return {
          updateOne: {
            filter: { users: pair },
            update: {
              $inc:         { crossingCount: 1 },
              $set:         { crossedAt: new Date(), location: { type: 'Point', coordinates } },
              $setOnInsert: { users: pair },
            },
            upsert: true,
          },
        };
      });

      await Crossing.bulkWrite(crossingOps as any);
    }

    res.json({ success: true, crossingsDetected: nearbyUsers.length });
  } catch (err) {
    next(err);
  }
}

// ─── Get My Crossed-Paths Feed ────────────────────────────────────────────────

export async function getCrossedPaths(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myId  = req.user!._id;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    // Get UIDs the current user already liked/passed
    const interacted = await Like.find({ from: myId }).select('to');
    const interactedIds = interacted.map((l) => l.to);

    // Get crossings involving me, excluding already-interacted users
    const crossings = await Crossing.find({ users: myId })
      .sort({ crossedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path:   'users',
        match:  {
          _id:      { $ne: myId, $nin: interactedIds },
          isActive: true,
          'settings.showMe': true,
        },
        select: 'displayName photoURL photos bio age gender occupation lastSeen',
      });

    // Filter out crossings where the other user didn't populate (blocked/inactive)
    const feed = crossings
      .map((c) => {
        const otherUser = (c.users as any[]).find(
          (u: any) => u && u._id.toString() !== myId.toString()
        );
        if (!otherUser) return null;
        return { user: otherUser, crossingCount: c.crossingCount, crossedAt: c.crossedAt };
      })
      .filter(Boolean);

    res.json({ success: true, data: feed, page, limit });
  } catch (err) {
    next(err);
  }
}
