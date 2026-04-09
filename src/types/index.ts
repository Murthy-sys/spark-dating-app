// ─── User Types ──────────────────────────────────────────────────────────────

export interface UserProfile {
  _id: string;        // MongoDB ObjectId as string — single source of truth
  displayName: string;
  email: string;
  photoURL: string;
  photos: string[];   // up to 6 Cloudinary URLs
  bio: string;
  age: number;
  gender: 'male' | 'female' | 'non-binary' | 'other';
  interestedIn: ('male' | 'female' | 'non-binary' | 'other')[];
  occupation: string;
  hobbies?: string[];                                       // added in onboarding step 3
  lookingFor?: ('friendship' | 'casual' | 'serious')[];    // added in onboarding step 4
  location: GeoPoint | null;
  lastSeen: string;   // ISO date string as returned by JSON serialization
  createdAt: string;
  settings: UserSettings;
}

export interface UserSettings {
  maxDistance: number;         // km
  ageRangeMin: number;
  ageRangeMax: number;
  showMe: boolean;             // visible to others
  notifications: boolean;
}

// ─── Location Types ───────────────────────────────────────────────────────────

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface LocationRecord {
  userId: string;
  location: GeoPoint;
  timestamp: Date;
}

// ─── Crossing / Match Types ───────────────────────────────────────────────────

/**
 * A "crossing" is created when two users are within CROSSING_RADIUS_METERS
 * of each other. It persists so users can see who they've crossed paths with.
 */
export interface Crossing {
  id: string;
  userIds: [string, string];   // always sorted alphabetically
  crossedAt: Date;
  crossingCount: number;       // number of times they've crossed paths
  location: GeoPoint;
}

export type LikeStatus = 'liked' | 'crushed' | 'passed';

export interface Like {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: LikeStatus;          // 'crushed' = super-like
  createdAt: Date;
}

export interface Match {
  _id: string;              // MongoDB ObjectId — used as matchId in navigation
  users: UserProfile[];     // populated by backend (only the OTHER user after filter)
  matchedAt: string;
  lastMessage?: string;
  lastMessageAt?: string | null;
  unreadCount: Record<string, number>;
  isActive: boolean;
}

// ─── Chat Types ───────────────────────────────────────────────────────────────

export interface Message {
  _id: string;       // MongoDB ObjectId
  match: string;     // matchId
  sender: string;    // senderId (matches backend field name)
  text: string;
  imageURL?: string;
  createdAt: string;
  readAt?: string | null;
}

// ─── Navigation Types ─────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  SetupProfile: undefined;
  Permissions: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Likes: undefined;
  Matches: undefined;
  Profile: undefined;
};

export type ChatStackParamList = {
  MatchList: undefined;
  Chat: { matchId: string; otherUser: UserProfile };
  ViewProfile: { userId: string };
};
