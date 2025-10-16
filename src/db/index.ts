import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const getDb = (env: D1Database) => {
  return drizzle(env, { schema });
};

export type Database = ReturnType<typeof getDb>;
