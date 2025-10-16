"use client";

import { Button } from "./ui/button";
import { authClient } from "@/lib/auth";

export function AuthButtons() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!session?.user) {
    return (
      <Button
        onClick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/`,
          })
        }
      >
        Sign in with Google
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{session?.user?.email}</span>
      <Button variant="outline" onClick={() => authClient.signOut()}>
        Sign out
      </Button>
    </div>
  );
}
