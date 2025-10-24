import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import { Bindings } from "src/types";

/**
 * Better Auth Instance
 */
export const auth = (env: Bindings): ReturnType<typeof betterAuth> => {
  const db = getDb(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    redirectUri: `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    oauthConfig: {
      skipStateCookieCheck: true,
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://superfast-ai.curiouskid.dev",
    ],
    logger: {
      level: "debug",
      log: (level, message, ...args) => {
        console.log(`[${level}] ${message} ${JSON.stringify(args)}`);
      },
    },
    advanced: {
      disableCSRFCheck: true,
      crossSubDomainCookies: {
        enabled: true,
      },
    },
    // onAPIError: {
    //   throw: true,
    //   onError: (error, ctx) => {
    //     // Custom error handling
    //     console.error("Auth error:", error);
    //   },
    //   errorURL: "/auth/error",
    // },
  });
};
