"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to folders page
    router.push("/folders");
  }, [router]);

  return (
    <div className="flex h-full bg-background items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">
          Redirecting to folders...
        </p>
      </div>
    </div>
  );
}
