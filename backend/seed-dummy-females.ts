/**
 * seed-dummy-females.ts — inserts ~12 dummy female test accounts so the
 * Nearby feed has something to render during development.
 *
 * Run:  npm run seed:females
 *
 * Re-running is safe: existing dummies (email matches *@spark.test) are
 * deleted first, then re-inserted fresh. Real users are never touched.
 *
 * Photos: omitted — UserAvatar falls back to a gendered DiceBear avatar
 * keyed off the user's _id, which works without any upload pipeline.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';

dotenv.config();

// Anchor location — change these two numbers to seed near a different city.
const CENTER_LAT = 12.9716;
const CENTER_LNG = 77.5946;
const SCATTER_KM = 3; // dummies are placed within ~3km of the anchor

// 1km ≈ 0.009 degrees of latitude (and ~0.009 / cos(lat) degrees of longitude)
const KM_TO_LAT = 0.009;
const KM_TO_LNG = 0.009 / Math.cos((CENTER_LAT * Math.PI) / 180);

function jitter(): { lat: number; lng: number } {
  const r = Math.random() * SCATTER_KM;
  const theta = Math.random() * Math.PI * 2;
  return {
    lat: CENTER_LAT + Math.cos(theta) * r * KM_TO_LAT,
    lng: CENTER_LNG + Math.sin(theta) * r * KM_TO_LNG,
  };
}

type Dummy = {
  displayName: string;
  age: number;
  bio: string;
  occupation: string;
  hobbies: string[];
  intent: 'serious' | 'casual' | 'friends' | 'networking';
  communities: string[];
  lookingFor: ('friendship' | 'casual' | 'serious')[];
};

const dummies: Dummy[] = [
  {
    displayName: 'Aisha',
    age: 24,
    bio: 'Coffee, books, and long walks. Looking for someone who actually replies.',
    occupation: 'UX Designer',
    hobbies: ['reading', 'pottery', 'hiking'],
    intent: 'serious',
    communities: ['creators', 'bookworms'],
    lookingFor: ['serious'],
  },
  {
    displayName: 'Priya',
    age: 27,
    bio: 'Engineer by day, salsa dancer by night. Tell me your favorite weird hobby.',
    occupation: 'Software Engineer',
    hobbies: ['dancing', 'gaming', 'cooking'],
    intent: 'casual',
    communities: ['tech', 'gamers'],
    lookingFor: ['casual', 'friendship'],
  },
  {
    displayName: 'Maya',
    age: 22,
    bio: 'Art student. Always somewhere with a sketchbook. ☕',
    occupation: 'Illustrator',
    hobbies: ['painting', 'photography', 'thrifting'],
    intent: 'friends',
    communities: ['artists', 'creators'],
    lookingFor: ['friendship'],
  },
  {
    displayName: 'Riya',
    age: 26,
    bio: 'Marathon runner & weekend baker. Trying both at once was a mistake.',
    occupation: 'Marketing Lead',
    hobbies: ['running', 'baking', 'travel'],
    intent: 'serious',
    communities: ['fitness', 'foodies'],
    lookingFor: ['serious'],
  },
  {
    displayName: 'Ananya',
    age: 29,
    bio: 'Founder. Long days, longer coffee orders. Need someone with patience.',
    occupation: 'Startup Founder',
    hobbies: ['startups', 'yoga', 'podcasts'],
    intent: 'networking',
    communities: ['startup', 'tech'],
    lookingFor: ['friendship'],
  },
  {
    displayName: 'Ishita',
    age: 25,
    bio: 'Indie musician. Ask me about my band before I bring it up unprovoked.',
    occupation: 'Musician',
    hobbies: ['guitar', 'songwriting', 'vinyl'],
    intent: 'casual',
    communities: ['musicians', 'creators'],
    lookingFor: ['casual'],
  },
  {
    displayName: 'Tara',
    age: 31,
    bio: 'Doctor. Tired but funny. Bring snacks.',
    occupation: 'Pediatrician',
    hobbies: ['cycling', 'crosswords', 'travel'],
    intent: 'serious',
    communities: ['fitness', 'travel'],
    lookingFor: ['serious'],
  },
  {
    displayName: 'Sana',
    age: 23,
    bio: 'Foodie + gym girl. Will rate your dosa.',
    occupation: 'Food Blogger',
    hobbies: ['cooking', 'fitness', 'video editing'],
    intent: 'casual',
    communities: ['foodies', 'fitness'],
    lookingFor: ['casual', 'friendship'],
  },
  {
    displayName: 'Nikita',
    age: 28,
    bio: 'Always planning the next trip. 38 countries down, many more to go.',
    occupation: 'Travel Photographer',
    hobbies: ['travel', 'photography', 'languages'],
    intent: 'casual',
    communities: ['travel', 'creators'],
    lookingFor: ['casual', 'friendship'],
  },
  {
    displayName: 'Kiara',
    age: 30,
    bio: 'PM. I read too much, walk too much, and overshare on first dates.',
    occupation: 'Product Manager',
    hobbies: ['reading', 'walking', 'movies'],
    intent: 'serious',
    communities: ['tech', 'bookworms'],
    lookingFor: ['serious'],
  },
  {
    displayName: 'Diya',
    age: 24,
    bio: 'Gamer. Streamer. Will absolutely beat you at Mario Kart.',
    occupation: 'Game Designer',
    hobbies: ['gaming', 'anime', 'streaming'],
    intent: 'friends',
    communities: ['gamers', 'creators'],
    lookingFor: ['friendship', 'casual'],
  },
  {
    displayName: 'Aarohi',
    age: 26,
    bio: 'Art teacher. Plant mom. Slow Sundays only.',
    occupation: 'Art Teacher',
    hobbies: ['painting', 'gardening', 'yoga'],
    intent: 'serious',
    communities: ['artists', 'fitness'],
    lookingFor: ['serious', 'friendship'],
  },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Clean up previous dummies — match by the .test email suffix only,
  // so real accounts (gmail/outlook/etc.) are never touched.
  const removed = await User.deleteMany({ email: /@spark\.test$/i });
  console.log(`Removed ${removed.deletedCount} existing dummy account(s)`);

  const docs = dummies.map((d) => {
    const { lat, lng } = jitter();
    const slug = d.displayName.toLowerCase().replace(/[^a-z]/g, '');
    return {
      displayName: d.displayName,
      email: `${slug}.test@spark.test`,
      password: 'password123', // hashed by pre-save hook
      age: d.age,
      gender: 'female' as const,
      interestedIn: ['male'],
      bio: d.bio,
      occupation: d.occupation,
      hobbies: d.hobbies,
      lookingFor: d.lookingFor,
      intent: d.intent,
      communities: d.communities,
      photos: [],
      photoURL: '',
      location: {
        type: 'Point' as const,
        coordinates: [lng, lat] as [number, number], // GeoJSON: [lng, lat]
      },
      lastSeen: new Date(),
      isActive: true,
      settings: {
        maxDistance: 50,
        ageRangeMin: 18,
        ageRangeMax: 99,
        showMe: true,
        notifications: true,
      },
      verification: { status: 'verified' as const },
      trustScore: 60 + Math.floor(Math.random() * 40),
    };
  });

  // Use .create() (not insertMany) so the bcrypt pre-save hook runs and
  // passwords land hashed. insertMany skips Mongoose middleware.
  const created = await User.create(docs);
  console.log(`Created ${created.length} dummy female account(s):`);
  for (const u of created) {
    const [lng, lat] = u.location.coordinates;
    console.log(
      `  - ${u.displayName} (${u.age})  ${u.email}  @ ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    );
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
