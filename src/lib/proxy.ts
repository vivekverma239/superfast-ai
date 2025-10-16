// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";

// const CLOUDFLARE_WORKER_URL =
//   process.env.CLOUDFLARE_WORKER_URL || "http://localhost:8787";

// export async function proxyRequest(
//   request: NextRequest,
//   path: string,
//   method: string = "GET"
// ): Promise<NextResponse> {
//   try {
//     const url = new URL(path, CLOUDFLARE_WORKER_URL);

//     // Copy query parameters
//     request.nextUrl.searchParams.forEach((value, key) => {
//       url.searchParams.set(key, value);
//     });

//     const session = await auth.api.getSession({ headers: request.headers });
//     const authHeader = session?.user?.id ? `Bearer ${session.user.id}` : "";

//     const response = await fetch(url.toString(), {
//       method,
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: authHeader,
//       },
//       body: method !== "GET" ? await request.text() : undefined,
//     });

//     const data = await response.json();
//     return NextResponse.json(data, { status: response.status });
//   } catch (error) {
//     console.error(`Error proxying ${method} ${path}:`, error);
//     return NextResponse.json(
//       { error: "Failed to connect to backend service" },
//       { status: 503 }
//     );
//   }
// }

// export async function proxyStreamRequest(
//   request: NextRequest,
//   path: string,
//   method: string = "POST"
// ): Promise<Response> {
//   try {
//     const url = new URL(path, CLOUDFLARE_WORKER_URL);
//     const session = await auth.api.getSession({ headers: request.headers });
//     const authHeader = session?.user?.id ? `Bearer ${session.user.id}` : "";

//     const response = await fetch(url.toString(), {
//       method,
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: authHeader,
//       },
//       body: await request.text(),
//     });

//     // For streaming responses, pass through the response directly
//     if (response.headers.get("content-type")?.includes("text/plain")) {
//       return new Response(response.body, {
//         status: response.status,
//         headers: {
//           "Content-Type": response.headers.get("content-type") || "text/plain",
//           "Cache-Control": "no-cache",
//         },
//       });
//     }

//     const data = await response.json();
//     return new Response(JSON.stringify(data), {
//       status: response.status,
//       headers: {
//         "Content-Type": "application/json",
//       },
//     });
//   } catch (error) {
//     console.error(`Error proxying stream ${method} ${path}:`, error);
//     return new Response(
//       JSON.stringify({ error: "Failed to connect to backend service" }),
//       { status: 503, headers: { "Content-Type": "application/json" } }
//     );
//   }
// }
