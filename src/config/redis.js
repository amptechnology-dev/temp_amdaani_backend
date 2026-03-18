import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL, // ✅ correct
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

client.on('error', (err) => {
  console.log('❌ Redis Error:', err);
});

client.on('connect', () => {
  console.log('🔄 Connecting to Redis...');
});

client.on('ready', () => {
  console.log('✅ Redis Connected');
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.log('❌ Redis Connection Failed:', err);
  }
})();

export default client;
