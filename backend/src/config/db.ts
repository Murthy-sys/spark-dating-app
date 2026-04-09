import mongoose from 'mongoose';

const MAX_RETRIES    = 5;
const RETRY_DELAY_MS = 3_000;

export async function connectDB(attempt = 1): Promise<void> {
  const uri = process.env.MONGO_URI!;

  try {
    await mongoose.connect(uri, {
      maxPoolSize:              10,
      serverSelectionTimeoutMS: 8_000,  // wait up to 8 s per attempt
      socketTimeoutMS:          45_000,
    });

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected — attempting to reconnect...');
      // Mongoose handles reconnection automatically with default settings,
      // but log clearly so it's visible in the terminal.
    });
  } catch (err: any) {
    console.error(`❌ MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}):`, err.message);

    if (attempt < MAX_RETRIES) {
      console.log(`   Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }

    // All retries exhausted — crash loudly so the problem is obvious
    console.error('💥 Could not connect to MongoDB after', MAX_RETRIES, 'attempts. Is it running?');
    console.error('   URI:', uri);
    console.error('   → Run:  mongod  (or start MongoDB from System Preferences)');
    process.exit(1);
  }
}
