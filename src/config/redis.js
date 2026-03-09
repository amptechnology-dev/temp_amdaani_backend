import { RedisClient } from 'bun';

const client = new RedisClient(process.env.REDIS_URL, {
  enableOfflineQueue: false,
});

export default client;
