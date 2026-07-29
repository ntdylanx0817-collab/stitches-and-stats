import { NextResponse } from "next/server";
import { logger, serializeError } from "./logger";

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

/**
 * An upstream responded with a non-OK status. Carries that status so the
 * route can mirror the meaningful ones (404 in particular) instead of
 * flattening every upstream failure into "the gateway is broken".
 */
export class UpstreamError extends Error {
  readonly upstreamStatus: number;

  constructor(label: string, upstreamStatus: number) {
    super(`${label} fetch failed: ${upstreamStatus}`);
    this.name = "UpstreamError";
    this.upstreamStatus = upstreamStatus;
  }
}

/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * undici reports every connection-level failure (DNS, ECONNREFUSED, TLS) as
 * a bare `TypeError: fetch failed` with the real reason hanging off `cause`,
 * so unwrap that — it is the detail worth having when debugging.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message && cause.message !== err.message) {
      return `${err.message}: ${cause.message}`;
    }
    return err.message;
  }
  if (typeof err === "string") return err;
  return "unknown error";
}

/**
 * Map a thrown value to a status code. Checks `name` rather than the
 * constructor so it holds on runtimes where DOMException does not subclass
 * Error — `AbortSignal.timeout()` rejects with a DOMException named
 * "TimeoutError".
 */
function statusForError(err: unknown): number {
  const name = typeof err === "object" && err !== null ? (err as { name?: unknown }).name : undefined;
  if (name === "TimeoutError" || name === "AbortError") return 504;

  if (err instanceof UpstreamError) {
    // A missing resource is the client's problem, not an outage. Pass through
    // upstream gateway/timeout statuses rather than relabelling them 502.
    if (err.upstreamStatus === 404) return 404;
    if (err.upstreamStatus === 504 || err.upstreamStatus === 503) return err.upstreamStatus;
  }
  return 502;
}

/**
 * Build a standardized error response from a thrown value.
 *
 * The detail is logged rather than returned: upstream messages are useful in
 * logs but an unexpected internal error (a TypeError, say) should not have
 * its text echoed to the caller.
 */
export function errorResponse(err: unknown, status?: number): NextResponse<ApiErrorBody> {
  const resolved = status ?? statusForError(err);
  logger.error("request failed", { status: resolved, ...serializeError(err) });

  const clientMessage =
    err instanceof UpstreamError || resolved === 504
      ? errorMessage(err)
      : "internal error";

  return NextResponse.json({ error: clientMessage, status: resolved }, { status: resolved });
}

/** Throw if a fetch Response is not OK — gives a useful message for `errorResponse`. */
export async function assertOk(res: Response, label: string): Promise<Response> {
  if (!res.ok) {
    // Release the body so undici does not hold the connection open.
    void res.body?.cancel().catch(() => {});
    throw new UpstreamError(label, res.status);
  }
  return res;
}

/**
 * Assert several responses fetched in parallel. If any failed, every body —
 * including those that succeeded — is released before throwing, so a partial
 * failure does not strand the sibling connections.
 */
export async function assertAllOk(entries: Array<[Response, string]>): Promise<void> {
  const failed = entries.find(([res]) => !res.ok);
  if (!failed) return;

  for (const [res] of entries) {
    void res.body?.cancel().catch(() => {});
  }
  throw new UpstreamError(failed[1], failed[0].status);
}
