// ─── User Types ──────────────────────────────────────────────────────────────

/**
 * Primary intent — single-choice, drives intent-first matching.
 * Distinct from `lookingFor` (multi-select labels for display).
 */
export type Intent = 'serious' | 'casual' | 'friends' | 'networking';

// Phase 3 — micro-communities. Predefined, mirrored on the backend enum.
export type Community =
  | 'tech'
  | 'fitness'
  | 'startup'
  | 'travel'
  | 'foodies'
  | 'creators'
  | 'gamers'
  | 'bookworms'
  | 'musicians'
  | 'artists';

// ─── Phase 2: Safety types ───────────────────────────────────────────────────

export interface SosContact {
  name:  string;
  phone: string;
}

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface VerificationState {
  status:       VerificationStatus;
  mediaURL?:    string;
  submittedAt?: string;
  reviewedAt?:  string;
  reviewNote?:  string;
}

export type Visibility = 'everyone' | 'verified_only' | 'matches_only';

export interface PrivacySettings {
  visibility:           Visibility;
  hidePhotosUntilMatch: boolean;
  hideFromSearch:       boolean;
}

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
  intent?: Intent | null;                                   // primary intent (single)
  communities?: Community[];                                // Phase 3: micro-communities
  engagementScore?: number;                                 // 0–100 anti-ghost score
  // Phase 2 — safety
  sosContacts?: SosContact[];
  verification?: VerificationState;
  trustScore?: number;
  privacy?: PrivacySettings;
  photosHidden?: boolean;                                   // server-set when hidePhotosUntilMatch is on
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

export interface DailyStatus {
  used:      number;
  limit:     number;
  remaining: number;
  resetAt:   string;   // ISO date
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
  lastSenderId?: string | null;       // who sent the latest message
  replyDueAt?: string | null;          // ISO — anti-ghost reply deadline
  autoUnmatchAt?: string | null;       // ISO — when match closes if unanswered
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
