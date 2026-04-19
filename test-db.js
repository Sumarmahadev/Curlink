import 'dotenv/config';
import mongoose from 'mongoose';

console.log('Connecting to:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('✅ Mongo connected!'); process.exit(0); })
  .catch(e => { console.error('❌ Failed:', e.message); process.exit(1); });