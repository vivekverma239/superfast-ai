import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const serverRequest = async <T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const cookieStore = await cookies();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL environment variable is not set");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
      Cookie: cookieStore.toString(),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch ${path}:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url: `${apiUrl}${path}`,
    });
    throw new Error(
      `Failed to fetch ${path}: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json() as Promise<T>;
};

export async function getServerSession() {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`,
      {
        headers: {
          cookie: cookieHeader,
        },
        cache: "force-cache",
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const session = await response.json();
    return session;
  } catch (error) {
    console.error("Failed to get server session:", error);
    return null;
  }
}

export async function requireAuth() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireAuthWithRedirect(redirectTo: string) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect(redirectTo);
  }

  return session;
}
