import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const users = await mongoose.connection.collection('users').find({}).toArray();
  for (const user of users) {
    console.log({
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      age: user.age,
      gender: user.gender,
      interestedIn: user.interestedIn,
      isActive: user.isActive,
      showMe: user.settings?.showMe,
      location: user.location,
      photoURL: user.photoURL,
      photos: user.photos,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
    });
  }
  await mongoose.disconnect();
}

main();
