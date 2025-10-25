import { cookies } from "next/headers";

export const serverRequest = async <T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const cookieStore = await cookies();
  console.log("cookieStore", cookieStore);
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
