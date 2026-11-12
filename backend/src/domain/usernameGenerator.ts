const COMMON_TITLES = new Set([
  'dr', 'drg', 'dra', 'drs', 'prof', 'h', 'hj', 'ir', 'kh', 'spd', 'mpd', 'st', 'se', 'sh', 'skm', 'skom', 'mm', 'msi'
]);

/**
 * Sanitizes a full name into a list of clean lowercase word tokens,
 * stripping punctuation and standard titles/prefixes.
 */
export function sanitizeNameTokens(fullName: string): string[] {
  if (!fullName || typeof fullName !== 'string') return [];

  // Remove degrees/credentials commonly separated by commas (e.g., ", S.Kom", ", M.M.")
  const baseName = fullName.split(',')[0].trim();

  // Split by non-alphanumeric characters
  const rawParts = baseName.toLowerCase().split(/[^a-z0-9]+/);

  const tokens: string[] = [];
  for (const part of rawParts) {
    if (!part) continue;
    // Skip common honorific prefixes or abbreviations of 1-2 letters (like "dr", "h", "m")
    if (COMMON_TITLES.has(part) && tokens.length === 0) continue;
    if (part.length < 3 && rawParts.length > 1) {
      // If single/double letter prefix (e.g., "M. Rizki"), skip if it's the first token
      if (tokens.length === 0) continue;
    }
    tokens.push(part);
  }

  // Fallback if all tokens got filtered out
  if (tokens.length === 0) {
    const fallbackParts = fullName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
    for (const part of fallbackParts) {
      if (part.length >= 3) {
        tokens.push(part);
      }
    }
    if (tokens.length === 0 && fallbackParts[0]) {
      tokens.push(fallbackParts[0]);
    }
  }

  return tokens;
}

/**
 * Generates smart, human-friendly usernames for a batch of employees based on their full names.
 *
 * Rules:
 * 1. Default to the first name token.
 * 2. If the first name is shared among multiple employees or exists in the database,
 *    advance to the second word (e.g. "Muhammad Ali" & "Muhammad Bagus" -> "ali" & "bagus").
 * 3. If second words also collide, advance to third word.
 * 4. If tokens are exhausted or single-word collision, append numeric suffix ("ali", "ali1", ...).
 * 5. Minimum 3 characters, lowercase alphanumeric.
 */
export function generateSmartUsernames(
  employees: Array<{ id: number; fullName: string }>,
  existingUsernames: Set<string>
): Map<number, string> {
  const result = new Map<number, string>();
  const allocated = new Set<string>(existingUsernames);

  // Pre-tokenize all employees
  const employeeTokens = employees.map(emp => {
    let tokens = sanitizeNameTokens(emp.fullName);
    if (tokens.length === 0) {
      tokens = [`user${emp.id}`];
    }
    // Ensure all tokens are at least 3 chars; if not, pad or format
    tokens = tokens.map(t => (t.length < 3 ? `${t}${emp.id}` : t));
    return {
      id: emp.id,
      fullName: emp.fullName,
      tokens,
    };
  });

  // Track maximum token depth
  const maxTokens = Math.max(1, ...employeeTokens.map(e => e.tokens.length));

  // Determine starting token index per employee by checking prefix collisions
  const employeeTokenIndex = new Map<number, number>();
  for (const emp of employeeTokens) {
    employeeTokenIndex.set(emp.id, 0);
  }

  // Iteratively advance token index for colliding prefixes across the batch and against DB
  for (let depth = 0; depth < maxTokens; depth++) {
    // Count occurrences of candidate token at current depth for active collisions
    const counts = new Map<string, number>();

    for (const emp of employeeTokens) {
      const idx = employeeTokenIndex.get(emp.id)!;
      if (idx === depth) {
        const token = emp.tokens[Math.min(idx, emp.tokens.length - 1)];
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }

    for (const emp of employeeTokens) {
      const idx = employeeTokenIndex.get(emp.id)!;
      if (idx === depth) {
        const token = emp.tokens[Math.min(idx, emp.tokens.length - 1)];
        const isDuplicateInBatch = (counts.get(token) || 0) > 1;
        const existsInDb = existingUsernames.has(token);

        // If duplicate in batch or already exists in DB, and employee has more tokens, advance!
        if ((isDuplicateInBatch || existsInDb) && emp.tokens.length > idx + 1) {
          employeeTokenIndex.set(emp.id, idx + 1);
        }
      }
    }
  }

  // Now allocate unique usernames
  for (const emp of employeeTokens) {
    let chosenIdx = employeeTokenIndex.get(emp.id)!;
    let baseCandidate = emp.tokens[Math.min(chosenIdx, emp.tokens.length - 1)];

    // If still in allocated, try remaining tokens if any
    while (allocated.has(baseCandidate) && chosenIdx + 1 < emp.tokens.length) {
      chosenIdx++;
      baseCandidate = emp.tokens[chosenIdx];
    }

    // If still in allocated, append numeric suffix
    let finalUsername = baseCandidate;
    if (allocated.has(finalUsername)) {
      let suffix = 1;
      while (allocated.has(`${baseCandidate}${suffix}`)) {
        suffix++;
      }
      finalUsername = `${baseCandidate}${suffix}`;
    }

    allocated.add(finalUsername);
    result.set(emp.id, finalUsername);
  }

  return result;
}

