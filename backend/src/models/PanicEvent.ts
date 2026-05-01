import mongoose, { Document, Schema } from 'mongoose';

/**
 * PanicEvent — recorded every time a user hits the panic button.
 *
 * The actual SMS/notification delivery happens client-side via the device's
 * native SMS app (deep-link), so this model is a server-side audit log:
 * who triggered, when, where, and which contacts were notified.
 *
 * The `resolved` flag exists so a future safety dashboard can track open
 * incidents — for now nothing in the app reads it.
 */
export interface IPanicEvent extends Document {
  user:             mongoose.Types.ObjectId;
  triggeredAt:      Date;
  location:         { type: 'Point'; coordinates: [number, number] } | null;
  notifiedContacts: { name: string; phone: string }[];
  resolved:         boolean;
  resolvedAt:       Date | null;
  createdAt:        Date;
}

const PanicEventSchema = new Schema<IPanicEvent>(
  {
    user:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    triggeredAt: { type: Date, default: Date.now },
    location: {
      type: {
        type:    String,
        enum:    ['Point'],
      },
      coordinates: { type: [Number] },
      _id: false,
    },
    notifiedContacts: [{
      name:  String,
      phone: String,
      _id:   false,
    }],
    resolved:   { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PanicEventSchema.index({ triggeredAt: -1 });

export default mongoose.model<IPanicEvent>('PanicEvent', PanicEventSchema);
