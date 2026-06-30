/**
 * Converts Prisma models (Decimal, Date, etc.) into plain JSON-safe values
 * before passing data from Server Components / Server Actions to the client.
 */
function isDecimalLike(val: unknown): val is { toString(): string } {
  if (val === null || typeof val !== "object" || Array.isArray(val)) return false;

  const obj = val as { constructor?: { name?: string }; toFixed?: unknown; toString?: unknown };
  if (obj.constructor?.name === "Decimal" || obj.constructor?.name === "Decimal2") {
    return true;
  }

  return typeof obj.toFixed === "function" && typeof obj.toString === "function";
}

export function serializeForClient<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (val === null || val === undefined) return val;
      if (typeof val === "bigint") return val.toString();
      if (val instanceof Date) return val.toISOString();
      if (isDecimalLike(val)) return val.toString();
      return val;
    })
  ) as T;
}
