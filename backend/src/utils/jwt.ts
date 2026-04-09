import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

export function signToken(userId: Types.ObjectId | string): string {
  return jwt.sign(
    { id: userId.toString() },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } as jwt.SignOptions
  );
}
