// import { RedisClient } from 'bun';
import { createClient } from "redis";

const client = createClient(process.env.REDIS_URL, {
  enableOfflineQueue: false,
});
try {
  await client.connect();
  console.log("✅ Redis Connected");
} catch (err) {
  console.log("❌ Redis Connection Failed:", err);
}

export default client;