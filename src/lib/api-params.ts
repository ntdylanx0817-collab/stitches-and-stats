export interface NumberParamOptions {
  defaultValue?: number;
  min?: number;
  max?: number;
}

/** Parse a complete base-10 integer without accepting exponents or decimals. */
export function integerParam(
  value: string | null,
  { defaultValue, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: NumberParamOptions = {}
): number | null {
  if (value === null || value === "") return defaultValue ?? null;
  if (!/^-?\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/** Parse a finite decimal constrained to an explicit range. */
export function numberParam(
  value: string | null,
  { defaultValue, min = -Number.MAX_VALUE, max = Number.MAX_VALUE }: NumberParamOptions = {}
): number | null {
  if (value === null || value === "") return defaultValue ?? null;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function enumParam<const T extends readonly string[]>(
  value: string | null,
  allowed: T,
  defaultValue: T[number]
): T[number] | null {
  if (value === null || value === "") return defaultValue;
  return allowed.includes(value) ? (value as T[number]) : null;
}

/** Accept only a real calendar date in canonical YYYY-MM-DD form. */
export function dateParam(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

export function stringParam(
  value: string | null,
  { defaultValue = "", maxLength = 80, pattern }: { defaultValue?: string; maxLength?: number; pattern?: RegExp } = {}
): string | null {
  if (value === null) return defaultValue;
  const parsed = value.trim();
  if (parsed.length > maxLength || (pattern && !pattern.test(parsed))) return null;
  return parsed;
}
