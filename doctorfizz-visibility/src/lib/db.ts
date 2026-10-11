import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
const g = globalThis as unknown as { dfPool?: Pool };
export const pool =
  g.dfPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_SIZE || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
if (process.env.NODE_ENV !== "production") g.dfPool = pool;
export const db = drizzle(pool);
export async function query<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  return (await pool.query(sql, args)).rows;
}
