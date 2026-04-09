import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function clearDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const collections = [
    'users',
    'likes',
    'matches',
    'messages',
    'crossings',
    'locationhistories',
  ];

  for (const name of collections) {
    try {
      await mongoose.connection.collection(name).deleteMany({});
      console.log(`Cleared collection: ${name}`);
    } catch (err) {
      console.error(`Error clearing ${name}:`, err);
    }
  }

  await mongoose.disconnect();
  console.log('Database cleared.');
}

clearDatabase();
