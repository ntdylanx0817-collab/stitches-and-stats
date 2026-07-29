/**
 * Minimal structured logger.
 *
 * Deliberately dependency-free: the app otherwise pulls nothing at runtime for
 * logging, and a JSON-lines writer is small enough that adding pino/winston
 * would cost more than it returns here.
 *
 * - Production emits one JSON object per line, so a log shipper can parse it.
 * - Development pretty-prints, because a wall of JSON is unreadable while
 *   working locally.
 * - `LOG_LEVEL` (debug | info | warn | error | silent) filters output. Defaults
 *   to `debug` outside production and `info` in production.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/** Arbitrary structured context attached to a log line. */
export type LogFields = Record<string, unknown>;

function resolveThreshold(): number {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVEL_ORDER) {
    return LEVEL_ORDER[configured as LogLevel | "silent"];
  }
  return process.env.NODE_ENV === "production" ? LEVEL_ORDER.info : LEVEL_ORDER.debug;
}

function isPretty(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Flatten an Error into plain fields, walking the `cause` chain.
 *
 * undici reports connection failures as a bare `TypeError: fetch failed` with
 * the real reason on `cause`, so dropping the chain loses the only useful part.
 * The walk is depth-capped so a self-referential cause cannot spin.
 */
export function serializeError(err: unknown): LogFields {
  if (!(err instanceof Error)) {
    return { error: typeof err === "string" ? err : String(err) };
  }

  const causes: string[] = [];
  let current: unknown = (err as { cause?: unknown }).cause;
  const seen = new Set<unknown>([err]);
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    causes.push(`${current.name}: ${current.message}`);
    current = (current as { cause?: unknown }).cause;
  }

  const fields: LogFields = {
    error: err.message,
    errorName: err.name,
  };
  if (causes.length > 0) fields.errorCause = causes;
  if (err.stack) fields.stack = err.stack;
  return fields;
}

function write(level: LogLevel, msg: string, fields: LogFields): void {
  if (LEVEL_ORDER[level] < resolveThreshold()) return;

  const record = { ts: new Date().toISOString(), level, msg, ...fields };

  // Route through console so Next.js server output and any platform log
  // capture (Vercel, Docker) pick it up without extra wiring.
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isPretty()) {
    const rest = { ...fields };
    delete rest.stack;
    const suffix = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    sink(`[${level}] ${msg}${suffix}`);
    if (typeof fields.stack === "string" && level === "error") sink(fields.stack);
    return;
  }

  try {
    sink(JSON.stringify(record));
  } catch {
    // Circular or otherwise unserializable field — never let logging throw.
    sink(JSON.stringify({ ts: record.ts, level, msg, logError: "unserializable fields" }));
  }
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Derive a logger that stamps every line with the given fields. */
  child(bound: LogFields): Logger;
}

function makeLogger(bound: LogFields): Logger {
  return {
    debug: (msg, fields) => write("debug", msg, { ...bound, ...fields }),
    info: (msg, fields) => write("info", msg, { ...bound, ...fields }),
    warn: (msg, fields) => write("warn", msg, { ...bound, ...fields }),
    error: (msg, fields) => write("error", msg, { ...bound, ...fields }),
    child: (extra) => makeLogger({ ...bound, ...extra }),
  };
}

export const logger: Logger = makeLogger({});

/** Logger bound to an API route, so every line carries the route name. */
export function routeLogger(route: string): Logger {
  return logger.child({ route });
}
