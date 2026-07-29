import { test, expect, describe, afterEach } from "bun:test";
import { logger, serializeError } from "@/lib/logger";

/**
 * Capture what the logger writes. The level threshold and pretty/JSON choice
 * are read per call, so env can be varied between assertions.
 */
function capture(fn: () => void): string[] {
  const lines: string[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const sink = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  console.log = sink;
  console.warn = sink;
  console.error = sink;
  try {
    fn();
  } finally {
    Object.assign(console, original);
  }
  return lines;
}

// Next.js types NODE_ENV as readonly, but these tests need to exercise both
// the production and development output paths.
const env = process.env as Record<string, string | undefined>;

const originalEnv = { LOG_LEVEL: env.LOG_LEVEL, NODE_ENV: env.NODE_ENV };
afterEach(() => {
  env.LOG_LEVEL = originalEnv.LOG_LEVEL;
  env.NODE_ENV = originalEnv.NODE_ENV;
});

describe("level filtering", () => {
  test("suppresses levels below the configured threshold", () => {
    env.LOG_LEVEL = "warn";
    const lines = capture(() => {
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");
    });
    expect(lines).toHaveLength(2);
    expect(lines.join(" ")).toContain("w");
    expect(lines.join(" ")).toContain("e");
  });

  test("silent suppresses everything, including errors", () => {
    env.LOG_LEVEL = "silent";
    const lines = capture(() => {
      logger.error("should not appear");
    });
    expect(lines).toHaveLength(0);
  });

  test("debug threshold lets everything through", () => {
    env.LOG_LEVEL = "debug";
    const lines = capture(() => {
      logger.debug("d");
      logger.error("e");
    });
    expect(lines).toHaveLength(2);
  });

  test("an unrecognised LOG_LEVEL falls back rather than dropping logs", () => {
    env.LOG_LEVEL = "nonsense";
    env.NODE_ENV = "production";
    const lines = capture(() => logger.error("still logged"));
    expect(lines).toHaveLength(1);
  });
});

describe("production output", () => {
  test("emits one parseable JSON object per line", () => {
    env.NODE_ENV = "production";
    env.LOG_LEVEL = "debug";
    const [line] = capture(() => logger.info("hello", { route: "/api/x", n: 3 }));

    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.route).toBe("/api/x");
    expect(parsed.n).toBe(3);
    expect(typeof parsed.ts).toBe("string");
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
  });

  test("never throws on an unserializable field", () => {
    env.NODE_ENV = "production";
    env.LOG_LEVEL = "debug";
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const [line] = capture(() => logger.info("circular", { circular }));
    const parsed = JSON.parse(line);
    expect(parsed.logError).toBe("unserializable fields");
    expect(parsed.msg).toBe("circular");
  });
});

describe("child loggers", () => {
  test("stamp bound fields onto every line", () => {
    env.NODE_ENV = "production";
    env.LOG_LEVEL = "debug";
    const child = logger.child({ route: "/api/team" });
    const [line] = capture(() => child.warn("degraded", { upstreamStatus: 503 }));

    const parsed = JSON.parse(line);
    expect(parsed.route).toBe("/api/team");
    expect(parsed.upstreamStatus).toBe(503);
  });

  test("per-call fields override bound fields", () => {
    env.NODE_ENV = "production";
    env.LOG_LEVEL = "debug";
    const child = logger.child({ route: "/api/a" });
    const [line] = capture(() => child.info("m", { route: "/api/b" }));
    expect(JSON.parse(line).route).toBe("/api/b");
  });

  test("a child does not mutate its parent", () => {
    env.NODE_ENV = "production";
    env.LOG_LEVEL = "debug";
    logger.child({ scoped: true });
    const [line] = capture(() => logger.info("plain"));
    expect(JSON.parse(line).scoped).toBeUndefined();
  });
});

describe("serializeError", () => {
  test("extracts message and name", () => {
    const fields = serializeError(new TypeError("bad access"));
    expect(fields.error).toBe("bad access");
    expect(fields.errorName).toBe("TypeError");
  });

  test("walks the cause chain", () => {
    const root = new Error("ECONNREFUSED");
    const mid = new Error("connect failed", { cause: root });
    const top = new Error("fetch failed", { cause: mid });

    expect(serializeError(top).errorCause).toEqual([
      "Error: connect failed",
      "Error: ECONNREFUSED",
    ]);
  });

  test("omits errorCause when there is no cause", () => {
    expect(serializeError(new Error("flat")).errorCause).toBeUndefined();
  });

  test("terminates on a self-referential cause", () => {
    const err = new Error("loop") as Error & { cause?: unknown };
    err.cause = err;
    // Must return rather than spin.
    expect(serializeError(err).error).toBe("loop");
  });

  test("caps a long cause chain", () => {
    let err = new Error("root");
    for (let i = 0; i < 20; i++) err = new Error(`layer${i}`, { cause: err });
    expect((serializeError(err).errorCause as string[]).length).toBeLessThanOrEqual(5);
  });

  test("handles a non-Error throw", () => {
    expect(serializeError("plain string").error).toBe("plain string");
    expect(serializeError(42).error).toBe("42");
  });
});
