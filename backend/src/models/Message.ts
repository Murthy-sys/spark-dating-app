import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  match:     mongoose.Types.ObjectId;
  sender:    mongoose.Types.ObjectId;
  text:      string;
  imageURL:  string;
  readAt:    Date | null;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    match:    { type: Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    sender:   { type: Schema.Types.ObjectId, ref: 'User',  required: true },
    text:     { type: String, default: '', maxlength: [1000, 'Message too long'] },
    imageURL: { type: String, default: '' },
    readAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ match: 1, createdAt: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
