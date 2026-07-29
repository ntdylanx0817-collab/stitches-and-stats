import { test, expect, describe } from "bun:test";
import {
  UpstreamError,
  errorMessage,
  errorResponse,
  assertOk,
  assertAllOk,
} from "@/lib/api-errors";

/** Build a Response with a body, so body-cancellation can be observed. */
function res(status: number): Response {
  return new Response(status === 204 ? null : "body", { status });
}

describe("errorMessage", () => {
  test("uses the message of a plain Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  test("unwraps a cause, which is where undici hides the real reason", () => {
    const err = new Error("fetch failed", { cause: new Error("ECONNREFUSED") });
    expect(errorMessage(err)).toBe("fetch failed: ECONNREFUSED");
  });

  test("does not duplicate an identical cause message", () => {
    const err = new Error("same", { cause: new Error("same") });
    expect(errorMessage(err)).toBe("same");
  });

  test("passes a thrown string through", () => {
    expect(errorMessage("just a string")).toBe("just a string");
  });

  test("falls back for a non-Error, non-string throw", () => {
    expect(errorMessage({ weird: true })).toBe("unknown error");
    expect(errorMessage(null)).toBe("unknown error");
  });
});

describe("status mapping", () => {
  test("defaults to 502", () => {
    expect(errorResponse(new Error("generic")).status).toBe(502);
  });

  test("maps a timeout to 504", () => {
    // AbortSignal.timeout() rejects with a DOMException named TimeoutError.
    const timeout = new DOMException("The operation was aborted", "TimeoutError");
    expect(errorResponse(timeout).status).toBe(504);
  });

  test("maps an abort to 504", () => {
    const aborted = new DOMException("aborted", "AbortError");
    expect(errorResponse(aborted).status).toBe(504);
  });

  test("maps an upstream 404 to 404, not a 502 outage", () => {
    expect(errorResponse(new UpstreamError("team", 404)).status).toBe(404);
  });

  test("passes through upstream 503 and 504", () => {
    expect(errorResponse(new UpstreamError("x", 503)).status).toBe(503);
    expect(errorResponse(new UpstreamError("x", 504)).status).toBe(504);
  });

  test("still reports other upstream failures as 502", () => {
    expect(errorResponse(new UpstreamError("x", 403)).status).toBe(502);
    expect(errorResponse(new UpstreamError("x", 500)).status).toBe(502);
  });

  test("an explicit status wins", () => {
    expect(errorResponse(new Error("x"), 400).status).toBe(400);
  });
});

describe("response body", () => {
  test("keeps the specific message for an upstream failure", async () => {
    const body = await errorResponse(new UpstreamError("standings", 403)).json();
    expect(body).toEqual({ error: "standings fetch failed: 403", status: 502 });
  });

  test("hides internal error text from the client", async () => {
    const body = await errorResponse(new TypeError("cannot read x of undefined")).json();
    expect(body.error).toBe("internal error");
    expect(body.status).toBe(502);
  });

  test("keeps the timeout message, which is not sensitive", async () => {
    const body = await errorResponse(new DOMException("timed out", "TimeoutError")).json();
    expect(body.status).toBe(504);
    expect(body.error).toBe("timed out");
  });
});

describe("assertOk", () => {
  test("passes an OK response straight through", async () => {
    const ok = res(200);
    expect(await assertOk(ok, "thing")).toBe(ok);
  });

  test("throws UpstreamError carrying the status", async () => {
    let caught: unknown;
    try {
      await assertOk(res(404), "team");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UpstreamError);
    expect((caught as UpstreamError).upstreamStatus).toBe(404);
    expect((caught as Error).message).toBe("team fetch failed: 404");
  });

  test("releases the body of a failed response", async () => {
    const bad = res(500);
    await expect(assertOk(bad, "x")).rejects.toThrow();
    // A cancelled stream is no longer readable; undici would otherwise hold
    // the connection open until GC.
    expect(bad.bodyUsed || bad.body?.locked).toBeTruthy();
  });
});

describe("assertAllOk", () => {
  test("resolves when every response is OK", async () => {
    await assertAllOk([[res(200), "a"], [res(200), "b"]]);
  });

  test("reports the first failure", async () => {
    let caught: unknown;
    try {
      await assertAllOk([[res(200), "a"], [res(404), "b"]]);
    } catch (err) {
      caught = err;
    }
    expect((caught as UpstreamError).upstreamStatus).toBe(404);
    expect((caught as Error).message).toBe("b fetch failed: 404");
  });

  test("releases the sibling body too, so a partial failure strands nothing", async () => {
    const good = res(200);
    const bad = res(500);
    await expect(assertAllOk([[good, "good"], [bad, "bad"]])).rejects.toThrow();
    expect(good.bodyUsed || good.body?.locked).toBeTruthy();
    expect(bad.bodyUsed || bad.body?.locked).toBeTruthy();
  });
});
