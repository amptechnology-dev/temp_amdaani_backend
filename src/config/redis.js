import { createClient } from 'redis';
 
const client = createClient({
  url: process.env.REDIS_URL, // now points directly to the static IP, e.g. redis://172.28.0.2:6379
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});
 
client.on('error', (err) => {
  console.log('❌ Redis Error:', err?.message || err);
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
    console.log('❌ Redis Connection Failed:', err?.message || err);
  }
})();
 
export default client;