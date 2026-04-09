/**
 * LocationHistory.ts
 *
 * Persists every location ping from the app.
 * Used for:
 *  - Audit trail / safety features
 *  - Future analytics (heatmaps, commute detection)
 *  - "Where we crossed" details on a crossing record
 *
 * Indexed on (user + timestamp) for fast per-user time-range queries.
 * TTL index auto-deletes records older than 30 days to control storage.
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ILocationHistory extends Document {
  user:      mongoose.Types.ObjectId;
  location: {
    type:        string;
    coordinates: [number, number]; // [longitude, latitude] — GeoJSON order
  };
  accuracy:  number | null;       // GPS accuracy in meters (optional)
  speed:     number | null;       // m/s from device
  createdAt: Date;
}

const LocationHistorySchema = new Schema<ILocationHistory>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    location: {
      type: {
        type:    String,
        enum:    ['Point'],
        default: 'Point',
      },
      coordinates: {
        type:     [Number],   // [longitude, latitude]
        required: true,
      },
    },
    accuracy: { type: Number, default: null },
    speed:    { type: Number, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // only createdAt needed
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// 2dsphere enables geospatial queries on location history (e.g. "where was user X near Y?")
LocationHistorySchema.index({ location: '2dsphere' });

// Compound index: fast retrieval of a user's recent history in time order
LocationHistorySchema.index({ user: 1, createdAt: -1 });

// TTL index: MongoDB auto-deletes documents older than 30 days
// This prevents unbounded collection growth without any manual cleanup job
LocationHistorySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }  // 30 days
);

export default mongoose.model<ILocationHistory>('LocationHistory', LocationHistorySchema);
