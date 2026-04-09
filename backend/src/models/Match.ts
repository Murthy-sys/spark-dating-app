import mongoose, { Document, Schema } from 'mongoose';

export interface IMatch extends Document {
  users:           [mongoose.Types.ObjectId, mongoose.Types.ObjectId];
  matchedAt:       Date;
  lastMessage:     string;
  lastMessageAt:   Date | null;
  unreadCount:     Map<string, number>;
  isActive:        boolean;
  createdAt:       Date;
  updatedAt:       Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    users: {
      type:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (v: any[]) => v.length === 2,
        message: 'Match must have exactly 2 users',
      },
    },
    matchedAt:     { type: Date, default: Date.now },
    lastMessage:   { type: String, default: '' },
    lastMessageAt: { type: Date, default: null },
    unreadCount:   { type: Map, of: Number, default: {} },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique pair index
MatchSchema.index({ users: 1 }, { unique: true });
MatchSchema.index({ lastMessageAt: -1 });

export default mongoose.model<IMatch>('Match', MatchSchema);
