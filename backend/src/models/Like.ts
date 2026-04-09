import mongoose, { Document, Schema } from 'mongoose';

export type LikeStatus = 'liked' | 'crushed' | 'passed';

export interface ILike extends Document {
  from:      mongoose.Types.ObjectId;
  to:        mongoose.Types.ObjectId;
  status:    LikeStatus;
  starred:   boolean;
  createdAt: Date;
}

const LikeSchema = new Schema<ILike>(
  {
    from:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    to:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type:     String,
      enum:     ['liked', 'crushed', 'passed'],
      required: true,
      default:  'liked',
    },
    starred: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One like record per (from → to) pair
LikeSchema.index({ from: 1, to: 1 }, { unique: true });
LikeSchema.index({ to: 1, status: 1 });   // fast lookup of "who liked me"

export default mongoose.model<ILike>('Like', LikeSchema);
