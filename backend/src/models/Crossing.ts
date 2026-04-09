/**
 * Crossing — recorded when two users come within CROSSING_RADIUS of each other.
 * The pair is stored as a sorted array so the document is always unique per pair.
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ICrossing extends Document {
  users:         [mongoose.Types.ObjectId, mongoose.Types.ObjectId];
  crossingCount: number;
  crossedAt:     Date;
  location: {
    type:        string;
    coordinates: [number, number];
  };
}

const CrossingSchema = new Schema<ICrossing>(
  {
    // Always store as [smallerObjectId, largerObjectId] to ensure uniqueness
    users: {
      type:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (v: any[]) => v.length === 2,
        message: 'Crossing must have exactly 2 users',
      },
    },
    crossingCount: { type: Number, default: 1, min: 1 },
    crossedAt:     { type: Date, default: Date.now },
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  { timestamps: true }
);

// Compound unique index — one doc per pair of users
CrossingSchema.index({ users: 1 }, { unique: true });
CrossingSchema.index({ crossedAt: -1 });

export default mongoose.model<ICrossing>('Crossing', CrossingSchema);
