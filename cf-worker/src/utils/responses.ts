import { Context } from "hono";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";

/**
 * Type-safe response helpers
 */

export type SuccessResponse<T> = {
  data: T;
  success: true;
};

export type ErrorResponse = {
  error: string;
  success: false;
  details?: unknown;
};

/**
 * Send a successful JSON response
 */
export function jsonSuccess<T>(c: Context, data: T, status: StatusCode = 200) {
  return c.json<SuccessResponse<T>>(
    {
      data,
      success: true,
    },
    status as ContentfulStatusCode
  );
}

/**
 * Send an error JSON response
 */
export function jsonError(
  c: Context,
  error: string,
  status: StatusCode = 400,
  details?: unknown
) {
  return c.json<ErrorResponse>(
    {
      error,
      success: false,
      ...(details ? { details } : {}),
    },
    status as ContentfulStatusCode
  );
}

/**
 * Validation error response
 */
export function validationError(c: Context, details: unknown) {
  return jsonError(c, "Validation failed", 400, details);
}

/**
 * Not found error response
 */
export function notFoundError(c: Context, resource: string = "Resource") {
  return jsonError(c, `${resource} not found`, 404);
}

/**
 * Unauthorized error response
 */
export function unauthorizedError(c: Context, message?: string) {
  return jsonError(c, message || "Unauthorized", 401);
}

/**
 * Forbidden error response
 */
export function forbiddenError(c: Context, message?: string) {
  return jsonError(c, message || "Forbidden", 403);
}

/**
 * Internal server error response
 */
export function serverError(c: Context, error?: unknown) {
  console.error("Server error:", error);
  return jsonError(
    c,
    "Internal server error",
    500,
    c.env.NODE_ENV === "development" ? error : undefined
  );
}
