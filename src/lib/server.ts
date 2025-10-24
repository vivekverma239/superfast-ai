import { cookies } from "next/headers";

export const serverRequest = async <T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const cookieStore = await cookies();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
      Cookie: cookieStore.toString(),
    },

    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    console.error("Failed to fetch:", response.statusText);
    const error = await response.text();
    throw new Error(`Failed to fetch ${path}: ${error}`);
  }
  return response.json() as Promise<T>;
};
