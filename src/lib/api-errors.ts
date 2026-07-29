import { NextResponse } from "next/server";

/**
 * Shared helpers for API route error handling.
 *
 * Every route in `src/app/api` should funnel failures through `errorResponse`
 * so clients get one predictable JSON shape instead of a mix of hand-rolled
 * objects (and, for unguarded routes, raw Next.js 500 HTML).
 */

export interface ApiErrorBody {
  error: string;
  status: number;
}

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown error";
}

/**
 * Upstream fetches that time out surface as `AbortError` / `TimeoutError`.
 * Those deserve 504 rather than a generic 502 so callers can distinguish
 * "upstream was slow" from "upstream returned garbage".
 */
function statusForError(err: unknown): number {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return 504;
  }
  return 502;
}

/** Build a standardized error response from a thrown value. */
export function errorResponse(err: unknown, status?: number): NextResponse<ApiErrorBody> {
  const resolved = status ?? statusForError(err);
  return NextResponse.json({ error: errorMessage(err), status: resolved }, { status: resolved });
}

/** Throw if a fetch Response is not OK — gives a useful message for `errorResponse`. */
export async function assertOk(res: Response, label: string): Promise<Response> {
  if (!res.ok) throw new Error(`${label} fetch failed: ${res.status}`);
  return res;
}
