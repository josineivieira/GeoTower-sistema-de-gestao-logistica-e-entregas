const mongoose = require('mongoose');

let connected = false;

async function connectIfNeeded() {
  if (connected) return mongoose;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not provided');

  mongoose.set('strictQuery', false);

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // DEBUG: imprimir informações reais de conexão para diagnóstico
  try {
    console.log('[MONGO] uri:', (process.env.MONGODB_URI || '').replace(/\/\/.*@/, '//***@'));
    console.log('[MONGO] db name:', mongoose.connection.name);
    console.log('[MONGO] host:', mongoose.connection.host);
  } catch (e) {
    console.warn('[MONGO] debug log failed', e && e.message);
  }

  connected = true;
  console.log('✓ Connected to MongoDB');
  return mongoose;
}

module.exports = {
  connectIfNeeded,
  mongoose
};
