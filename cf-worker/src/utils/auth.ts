import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import { Bindings } from "src/types";

/**
 * Better Auth Instance
 */
export const auth = (env: Bindings): ReturnType<typeof betterAuth> => {
  console.log("env", env.DB);
  const db = getDb(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3002",
      "https://superfast-ai.vercel.app",
    ],
  });
};
