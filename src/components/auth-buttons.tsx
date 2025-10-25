"use client";

import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { LogOut, Mail, User } from "lucide-react";
import { authClient } from "@/lib/auth";
import { useAuth } from "./auth-provider";
import Image from "next/image";
import { toast } from "sonner";

export const SignInButton = () => {
  return (
    <Button
      onClick={async () => {
        const response = await authClient.signIn.social({
          provider: "google",
          callbackURL: `${window.location.origin}/`,
          errorCallbackURL: `${window.location.origin}/`,
          disableRedirect: true,
        });
        console.log("response", response);
        if (response.data?.url) {
          window.open(response.data.url, "_blank");
        } else {
          toast.error("Failed to sign in");
        }
      }}
    >
      Sign in
    </Button>
  );
};

export function AuthButtons() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return <SignInButton />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 h-9 px-3 hover:bg-accent/50 transition-colors"
        >
          <div className="h-10 w-10 rounded-md overflow-hidden relative">
            <Image
              src={`https://api.dicebear.com/9.x/glass/svg?seed=${user?.email}`}
              alt="User"
              width={24}
              height={24}
              className="h-10 w-10 rounded-md"
              unoptimized
            />
            <User className="h-6 w-6 text-neutral-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
          </div>
          {/* <span className="hidden sm:inline text-sm font-medium">
            {session?.user?.name?.split(" ")[0] || "User"}
          </span> */}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-md overflow-hidden shadow-lg relative">
              <Image
                src={`https://api.dicebear.com/9.x/glass/svg?seed=${user?.email}`}
                alt="User"
                width={48}
                height={48}
                className="h-12 w-12 rounded-md"
                unoptimized
              />
              <User className="h-6 w-6 text-neutral-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground truncate">
                {user?.name || "User"}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 px-3 hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Sign out</span>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
