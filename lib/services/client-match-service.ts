/**
 * Fuzzy match extracted client names against existing clients.
 */

interface ClientCandidate {
  id: string;
  displayName: string;
  legalName: string | null;
  taxId: string | null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(d\.?o\.?o\.?|doo|llc|ltd|gmbh|inc)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalize(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function matchClient(
  extracted: {
    displayName?: string | null;
    legalName?: string | null;
    taxId?: string | null;
  },
  clients: ClientCandidate[]
): { clientId: string | null; score: number; matchedName: string | null } {
  if (clients.length === 0) {
    return { clientId: null, score: 0, matchedName: null };
  }

  const taxId = extracted.taxId?.trim();
  if (taxId) {
    const byTax = clients.find(
      (c) => c.taxId && c.taxId.replace(/\s/g, "") === taxId.replace(/\s/g, "")
    );
    if (byTax) {
      return { clientId: byTax.id, score: 1, matchedName: byTax.displayName };
    }
  }

  const names = [extracted.displayName, extracted.legalName].filter(Boolean) as string[];
  if (names.length === 0) {
    return { clientId: null, score: 0, matchedName: null };
  }

  let best: { clientId: string; score: number; matchedName: string } | null = null;

  for (const client of clients) {
    const clientNames = [client.displayName, client.legalName].filter(Boolean) as string[];
    for (const extractedName of names) {
      for (const clientName of clientNames) {
        const exact =
          normalize(extractedName) === normalize(clientName) ? 1 : 0;
        const overlap = tokenOverlap(extractedName, clientName);
        const contains =
          normalize(clientName).includes(normalize(extractedName)) ||
          normalize(extractedName).includes(normalize(clientName))
            ? 0.85
            : 0;
        const score = Math.max(exact, overlap, contains);

        if (!best || score > best.score) {
          best = { clientId: client.id, score, matchedName: client.displayName };
        }
      }
    }
  }

  if (!best || best.score < 0.5) {
    return { clientId: null, score: best?.score ?? 0, matchedName: null };
  }

  return best;
}
