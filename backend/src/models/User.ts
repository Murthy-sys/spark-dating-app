import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  displayName:  string;
  email:        string;
  password:     string;
  photos:       string[];         // Cloudinary URLs
  photoURL:     string;           // Primary photo (photos[0])
  bio:          string;
  age:          number;
  dateOfBirth?: Date;
  gender:       'male' | 'female' | 'non-binary' | 'other';
  interestedIn: string[];
  occupation:   string;
  hobbies:      string[];
  lookingFor:   string[];
  intent:       'serious' | 'casual' | 'friends' | 'networking' | null;
  communities:  string[];         // Phase 3: micro-community membership
  engagementScore:    number;     // 0–100; replies fast → up, ghosts → down
  dailyLikesUsed:     number;
  dailyLikesResetAt:  Date;

  // ─── Phase 2: Women-first safety ────────────────────────────────────────
  sosContacts: { name: string; phone: string }[];
  verification: {
    status:       'unverified' | 'pending' | 'verified' | 'rejected';
    mediaURL?:    string;
    submittedAt?: Date;
    reviewedAt?:  Date;
    reviewNote?:  string;
  };
  trustScore:  number;            // 0–100 derived score
  privacy: {
    visibility:           'everyone' | 'verified_only' | 'matches_only';
    hidePhotosUntilMatch: boolean;
    hideFromSearch:       boolean;
  };

  location: {
    type:        string;
    coordinates: [number, number]; // [longitude, latitude] — GeoJSON order
  };
  lastSeen:     Date;
  settings: {
    maxDistance:  number;          // km
    ageRangeMin:  number;
    ageRangeMax:  number;
    showMe:       boolean;
    notifications: boolean;
  };
  blockedUsers:      mongoose.Types.ObjectId[];
  isActive:          boolean;
  createdAt:         Date;
  updatedAt:         Date;
  resetOTP:          string | undefined;
  resetOTPExpiry:    Date   | undefined;

  // Methods
  comparePassword(candidate: string): Promise<boolean>;
  toSafeObject(): Partial<IUser>;
}

const UserSchema = new Schema<IUser>(
  {
    displayName: {
      type:     String,
      required: [true, 'Display name is required'],
      trim:     true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,
      lowercase: true,
      trim:     true,
      match:    [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:    false,       // never returned in queries by default
    },
    photos:      { type: [String], default: [] },
    photoURL:    { type: String, default: '' },
    bio:         { type: String, default: '', maxlength: [300, 'Bio cannot exceed 300 characters'] },
    age: {
      type:     Number,
      required: [true, 'Age is required'],
      min:      [18, 'Must be at least 18'],
      max:      [100, 'Age seems too high'],
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type:     String,
      required: [true, 'Gender is required'],
      enum:     ['male', 'female', 'non-binary', 'other'],
    },
    interestedIn: {
      type:    [String],
      default: ['male', 'female', 'non-binary', 'other'],
      enum:    ['male', 'female', 'non-binary', 'other'],
    },
    occupation:  { type: String,   default: '', trim: true },
    hobbies:     { type: [String], default: [] },
    lookingFor:  {
      type:    [String],
      default: [],
      enum:    ['friendship', 'casual', 'serious'],
    },

    // Primary intent — single source of truth for intent-first matching.
    // `lookingFor` (multi) is kept for backward compat / display.
    intent: {
      type:    String,
      enum:    ['serious', 'casual', 'friends', 'networking', null],
      default: null,
    },

    // Phase 3: micro-communities. Predefined list — server validates so a
    // typo'd or made-up name can't pollute the dataset. Add to this enum
    // when you want a new community to exist.
    communities: {
      type:    [String],
      default: [],
      enum:    [
        'tech',
        'fitness',
        'startup',
        'travel',
        'foodies',
        'creators',
        'gamers',
        'bookworms',
        'musicians',
        'artists',
      ],
    },

    engagementScore:   { type: Number, default: 100, min: 0, max: 100 },
    dailyLikesUsed:    { type: Number, default: 0 },
    dailyLikesResetAt: { type: Date,   default: () => new Date() },

    // ─── Phase 2: Safety ────────────────────────────────────────────────
    sosContacts: {
      type: [{
        name:  { type: String, required: true, trim: true, maxlength: 60 },
        phone: { type: String, required: true, trim: true, maxlength: 20 },
        _id:   false,
      }],
      default:  [],
      validate: {
        validator: (v: any[]) => v.length <= 3,
        message:   'You can save up to 3 SOS contacts',
      },
    },

    verification: {
      status: {
        type:    String,
        enum:    ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified',
      },
      mediaURL:    { type: String },
      submittedAt: { type: Date },
      reviewedAt:  { type: Date },
      reviewNote:  { type: String },
    },

    trustScore: { type: Number, default: 0, min: 0, max: 100 },

    privacy: {
      visibility: {
        type:    String,
        enum:    ['everyone', 'verified_only', 'matches_only'],
        default: 'everyone',
      },
      hidePhotosUntilMatch: { type: Boolean, default: false },
      hideFromSearch:       { type: Boolean, default: false },
    },

    // GeoJSON Point for MongoDB geospatial queries
    location: {
      type: {
        type:    String,
        enum:    ['Point'],
        default: 'Point',
      },
      coordinates: {
        type:    [Number],   // [longitude, latitude]
        default: [0, 0],
      },
    },

    lastSeen: { type: Date, default: Date.now },

    settings: {
      maxDistance:   { type: Number, default: 10 },
      ageRangeMin:   { type: Number, default: 18 },
      ageRangeMax:   { type: Number, default: 45 },
      showMe:        { type: Boolean, default: true },
      notifications: { type: Boolean, default: true },
    },

    blockedUsers:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isActive:        { type: Boolean, default: true },
    resetOTP:        { type: String,  select: false },
    resetOTPExpiry:  { type: Date,    select: false },
  },
  { timestamps: true }
);

// ─── Geospatial Index ─────────────────────────────────────────────────────────
// Enables $geoNear, $near, and $geoWithin queries (used for crossing detection)
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ 'settings.showMe': 1 });

// ─── Hash password before save ────────────────────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // Salt rounds 10 = industry standard (~100 ms).  12 was ~400 ms which
  // caused localtunnel's upstream timeout to fire before we responded.
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Compare passwords ────────────────────────────────────────────────────────
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// ─── Strip sensitive fields ───────────────────────────────────────────────────
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.blockedUsers;
  return obj;
};

export default mongoose.model<IUser>('User', UserSchema);
