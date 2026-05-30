import mongoose, { Document, Schema } from 'mongoose';

/**
 * Razorpay subscription lifecycle states (mirrors Razorpay's docs):
 *  - created       : subscription created, payment not yet authorized
 *  - authenticated : first payment authorized, awaiting first charge
 *  - active        : autopay running; user has access
 *  - paused        : suspended (e.g. by admin); no charges
 *  - halted        : payment failed past retry limit
 *  - cancelled     : user (or system) cancelled — no further charges
 *  - completed     : ran for total_count cycles (we use unlimited so rare)
 *  - expired       : authentication never completed in time
 */
export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'paused'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface ISubscription extends Document {
  user:                  mongoose.Types.ObjectId;
  razorpaySubscriptionId: string;
  razorpayPlanId:        string;
  razorpayCustomerId?:   string;
  status:                SubscriptionStatus;
  tier:                  'tier1' | 'tier2';   // age band at signup
  amount:                number;              // paise (e.g. 49900 = ₹499)
  currency:              string;              // 'INR'

  // Lifecycle timestamps (ISO from Razorpay)
  currentStart?:    Date | null;
  currentEnd?:      Date | null;   // when user loses access if not renewed
  chargeAt?:        Date | null;   // next autopay attempt
  startAt?:         Date | null;
  endAt?:           Date | null;
  endedAt?:         Date | null;
  cancelledAt?:     Date | null;
  paidCount:        number;
  remainingCount?:  number | null;

  cancelAtPeriodEnd: boolean;       // user requested cancel; access until currentEnd

  notes?:           Record<string, string>;

  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    razorpaySubscriptionId: {
      type:     String,
      required: true,
      unique:   true,
    },
    razorpayPlanId:    { type: String, required: true },
    razorpayCustomerId: { type: String },
    status: {
      type:    String,
      enum:    ['created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired'],
      default: 'created',
      index:   true,
    },
    tier: {
      type:     String,
      enum:     ['tier1', 'tier2'],
      required: true,
    },
    amount:   { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    currentStart:    { type: Date, default: null },
    currentEnd:      { type: Date, default: null },
    chargeAt:        { type: Date, default: null },
    startAt:         { type: Date, default: null },
    endAt:           { type: Date, default: null },
    endedAt:         { type: Date, default: null },
    cancelledAt:     { type: Date, default: null },
    paidCount:       { type: Number, default: 0 },
    remainingCount:  { type: Number, default: null },

    cancelAtPeriodEnd: { type: Boolean, default: false },

    notes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Lookups: "is this user currently active?"
SubscriptionSchema.index({ user: 1, status: 1 });

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
