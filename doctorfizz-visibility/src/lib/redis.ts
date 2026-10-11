import Redis from "ioredis";
import { Queue } from "bullmq";
const g = globalThis as unknown as { dfRedis?: Redis };
export function redis() {
  return (g.dfRedis ??= new Redis(
    process.env.REDIS_URL || "redis://127.0.0.1:6379",
    { maxRetriesPerRequest: null, lazyConnect: true },
  ));
}
export function providerQueue(id: string) {
  return new Queue("provider-" + id, { connection: redis() });
}
export function deadlineQueue() {
  return new Queue("deadlines", { connection: redis() });
}
